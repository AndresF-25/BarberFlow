import { prisma } from '../lib/prisma.js';
import { appointmentStatusToUi, formatDateOnly, parseDateOnly, timeToMinutes } from '../lib/utils.js';
import { upsertClientFromInteraction } from './clientService.js';

const TX_OPTS = { maxWait: 15000, timeout: 15000 }; // una ráfaga hace cola en los cerrojos

export const APPOINTMENT_INCLUDE = { service: true, employee: true, serviceTransaction: true };

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

export function mapAppointmentToUi(appt) {
  const cobro = appt.serviceTransaction;
  return {
    id: appt.id,
    hora: appt.startTime,
    fecha: formatDateOnly(new Date(appt.appointmentDate)),
    cliente: appt.clientName,
    telefono: appt.clientPhone,
    servicio: appt.service?.name || '',
    serviceId: appt.serviceId,
    barbero: appt.employee?.name || '',
    employeeId: appt.employeeId,
    estado: appointmentStatusToUi(appt.status),
    status: appt.status,
    clientId: appt.clientId,
    // Lo cobrado al finalizar: solo existe en las citas finalizadas.
    metodoPago: cobro ? cobro.paymentMethod : null,
    valor: cobro ? Math.round(cobro.amountCents / 100) : null,
  };
}

/**
 * Crea la cita si el barbero está libre. La comprobación y la inserción van bajo un cerrojo por barbero y día:
 * dos peticiones simultáneas al mismo horario ya no pueden reservarlo las dos.
 */
export async function createAppointmentIfFree({ businessId, userId, service, employee, date, startTime, clientName, clientPhone }) {
  const day = parseDateOnly(date);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`appointments:${employee.id}:${date}`}))`;

    const sameDay = await tx.appointment.findMany({
      where: { businessId, employeeId: employee.id, appointmentDate: day, status: { not: 'cancelled' } },
      include: { service: true },
    });
    const newStart = timeToMinutes(startTime);
    const newEnd = newStart + service.durationMinutes;
    const overlaps = sameDay.some((a) => {
      const start = timeToMinutes(a.startTime);
      return newStart < start + a.service.durationMinutes && start < newEnd;
    });
    if (overlaps) throw httpError(409, 'El barbero ya tiene una cita en ese horario.', 'APPOINTMENT_CONFLICT');

    const client = await upsertClientFromInteraction(businessId, { name: clientName, phone: clientPhone }, tx);

    return tx.appointment.create({
      data: {
        businessId,
        clientId: client?.id || null,
        serviceId: service.id,
        employeeId: employee.id,
        appointmentDate: day,
        startTime,
        status: 'pending',
        clientName,
        clientPhone,
        createdById: userId,
      },
      include: APPOINTMENT_INCLUDE,
    });
  }, TX_OPTS);
}

/**
 * Cambia el estado de una cita y/o corrige el método de pago, bajo un bloqueo de la fila (así «finalizar» y
 * «cancelar» a la vez no pueden dejar una cita cancelada con cobro).
 * Pendiente y confirmada pasan a cualquier estado; finalizada y cancelada no se reabren (repetir el mismo estado es inocuo).
 */
export async function changeAppointment({ id, businessId, user, status, paymentMethod }) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM appointments WHERE id = ${id} AND business_id = ${businessId} FOR UPDATE`;
    const appt = await tx.appointment.findFirst({ where: { id, businessId }, include: APPOINTMENT_INCLUDE });
    if (!appt) throw httpError(404, 'Cita no encontrada.', 'NOT_FOUND');
    if (user.role === 'employee' && appt.employeeId !== user.id) {
      throw httpError(403, 'No tienes permiso para modificar esta cita.', 'FORBIDDEN');
    }

    const target = status || appt.status;

    if (target !== appt.status) {
      if (appt.status === 'completed') {
        throw httpError(400, target === 'cancelled' ? 'No se puede cancelar una cita finalizada.' : 'Una cita finalizada no se puede cambiar.', 'INVALID_STATUS');
      }
      if (appt.status === 'cancelled') {
        throw httpError(400, target === 'completed' ? 'No se puede completar una cita cancelada.' : 'Una cita cancelada no se puede reabrir: agenda una nueva.', 'INVALID_STATUS');
      }
    }

    if (paymentMethod && target !== 'completed') {
      throw httpError(400, 'El método de pago solo se indica al finalizar la cita.', 'INVALID_PAYMENT');
    }

    if (target === 'completed') {
      if (appt.status !== 'completed') {
        let clientId = appt.clientId;
        if (!clientId) {
          const client = await upsertClientFromInteraction(businessId, { name: appt.clientName, phone: appt.clientPhone }, tx);
          clientId = client?.id || null;
        }
        await tx.serviceTransaction.create({
          data: {
            businessId,
            appointmentId: appt.id,
            serviceId: appt.serviceId,
            clientId,
            employeeId: appt.employeeId,
            amountCents: appt.service.priceCents,
            paymentMethod: paymentMethod || 'cash',
          },
        });
        await tx.service.update({ where: { id: appt.serviceId }, data: { timesPerformed: { increment: 1 } } });
        await tx.appointment.update({ where: { id: appt.id }, data: { status: 'completed', clientId } });
      } else if (paymentMethod && appt.serviceTransaction && appt.serviceTransaction.paymentMethod !== paymentMethod) {
        // Corregir cómo pagó el cliente: el monto y el conteo no cambian.
        await tx.serviceTransaction.update({ where: { id: appt.serviceTransaction.id }, data: { paymentMethod } });
      }
    } else if (target !== appt.status) {
      await tx.appointment.update({ where: { id: appt.id }, data: { status: target } });
    }

    return tx.appointment.findUnique({ where: { id: appt.id }, include: APPOINTMENT_INCLUDE });
  }, TX_OPTS);
}

export async function listAppointments(businessId, { from, to, date, status, employeeId }) {
  const where = { businessId };

  if (date) {
    where.appointmentDate = parseDateOnly(date);
  } else if (from || to) {
    where.appointmentDate = {};
    if (from) where.appointmentDate.gte = parseDateOnly(from);
    if (to) where.appointmentDate.lte = parseDateOnly(to);
  }

  if (status) where.status = status;
  if (employeeId) where.employeeId = employeeId;

  const rows = await prisma.appointment.findMany({
    where,
    include: APPOINTMENT_INCLUDE,
    orderBy: [{ appointmentDate: 'asc' }, { startTime: 'asc' }],
  });

  return rows.map(mapAppointmentToUi);
}
