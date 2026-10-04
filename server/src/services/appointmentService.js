import { prisma } from '../lib/prisma.js';
import { appointmentStatusToUi, formatDateOnly, parseDateOnly } from '../lib/utils.js';
import { upsertClientFromInteraction } from './clientService.js';

export function mapAppointmentToUi(appt) {
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
  };
}

export async function completeAppointment(appointmentId, businessId, paymentMethod = 'cash') {
  return prisma.$transaction(async (tx) => {
    const appt = await tx.appointment.findFirst({
      where: { id: appointmentId, businessId },
      include: { service: true },
    });

    if (!appt) {
      const err = new Error('Cita no encontrada.');
      err.status = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (appt.status === 'completed') {
      return tx.appointment.findUnique({
        where: { id: appointmentId },
        include: { service: true, employee: true },
      });
    }

    if (appt.status === 'cancelled') {
      const err = new Error('No se puede completar una cita cancelada.');
      err.status = 400;
      err.code = 'INVALID_STATUS';
      throw err;
    }

    let clientId = appt.clientId;
    if (!clientId) {
      const client = await upsertClientFromInteraction(businessId, {
        name: appt.clientName,
        phone: appt.clientPhone,
      }, tx);
      clientId = client?.id || null;
    }

    const existingTx = await tx.serviceTransaction.findUnique({
      where: { appointmentId: appt.id },
    });

    if (!existingTx) {
      await tx.serviceTransaction.create({
        data: {
          businessId,
          appointmentId: appt.id,
          serviceId: appt.serviceId,
          clientId,
          employeeId: appt.employeeId,
          amountCents: appt.service.priceCents,
          paymentMethod,
        },
      });

      await tx.service.update({
        where: { id: appt.serviceId },
        data: { timesPerformed: { increment: 1 } },
      });
    }

    return tx.appointment.update({
      where: { id: appt.id },
      data: { status: 'completed', clientId },
      include: { service: true, employee: true },
    });
  });
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
    include: { service: true, employee: true },
    orderBy: [{ appointmentDate: 'asc' }, { startTime: 'asc' }],
  });

  return rows.map(mapAppointmentToUi);
}
