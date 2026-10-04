import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireBusinessContext } from '../middleware/auth.js';
import { createError } from '../middleware/errorHandler.js';
import { appointmentStatusFromUi, nowInBusinessTz, parseDateOnly, timeToMinutes } from '../lib/utils.js';
import {
  completeAppointment,
  listAppointments,
  mapAppointmentToUi,
} from '../services/appointmentService.js';
import { upsertClientFromInteraction } from '../services/clientService.js';

const router = Router();

router.use(authenticate, requireBusinessContext);

const createSchema = z.object({
  clientName: z.string().min(1),
  clientPhone: z.string().optional(),
  serviceId: z.string().uuid(),
  employeeId: z.string().uuid(),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida.'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (usa HH:MM).'),
});

const patchSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'completed', 'cancelled', 'Pendiente', 'Confirmada', 'Finalizada', 'Cancelada']).optional(),
  paymentMethod: z.enum(['cash', 'card', 'transfer']).optional(),
});

router.get('/', async (req, res, next) => {
  try {
    let status = req.query.status?.toString();
    if (status && !['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) {
      status = appointmentStatusFromUi(status);
    }

    const appointments = await listAppointments(req.businessId, {
      date: req.query.date?.toString(),
      from: req.query.from?.toString(),
      to: req.query.to?.toString(),
      status,
      // Un empleado solo ve sus propias citas.
      employeeId: req.user.role === 'employee' ? req.user.id : req.query.employeeId?.toString(),
    });

    res.json({ appointments });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    if (req.user.role === 'employee') data.employeeId = req.user.id;

    const date = parseDateOnly(data.appointmentDate);
    const now = nowInBusinessTz();
    if (data.appointmentDate < now.date || (data.appointmentDate === now.date && data.startTime < now.time)) {
      throw createError(400, 'No se pueden crear citas en el pasado.', 'PAST_APPOINTMENT');
    }

    const [service, employee] = await Promise.all([
      prisma.service.findFirst({ where: { id: data.serviceId, businessId: req.businessId, isActive: true } }),
      prisma.user.findFirst({ where: { id: data.employeeId, businessId: req.businessId, role: 'employee', isActive: true } }),
    ]);

    if (!service) throw createError(404, 'Servicio no encontrado.', 'NOT_FOUND');
    if (!employee) throw createError(404, 'Empleado no encontrado.', 'NOT_FOUND');

    const sameDay = await prisma.appointment.findMany({
      where: {
        businessId: req.businessId,
        employeeId: employee.id,
        appointmentDate: date,
        status: { not: 'cancelled' },
      },
      include: { service: true },
    });
    const newStart = timeToMinutes(data.startTime);
    const newEnd = newStart + service.durationMinutes;
    const overlaps = sameDay.some((a) => {
      const start = timeToMinutes(a.startTime);
      return newStart < start + a.service.durationMinutes && start < newEnd;
    });
    if (overlaps) {
      throw createError(409, 'El barbero ya tiene una cita en ese horario.', 'APPOINTMENT_CONFLICT');
    }

    const client = await upsertClientFromInteraction(req.businessId, {
      name: data.clientName,
      phone: data.clientPhone || '',
    });

    const appointment = await prisma.appointment.create({
      data: {
        businessId: req.businessId,
        clientId: client?.id || null,
        serviceId: service.id,
        employeeId: employee.id,
        appointmentDate: date,
        startTime: data.startTime,
        status: 'pending',
        clientName: data.clientName.trim(),
        clientPhone: data.clientPhone?.trim() || '',
        createdById: req.user.id,
      },
      include: { service: true, employee: true },
    });

    res.status(201).json({ appointment: mapAppointmentToUi(appointment) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const data = patchSchema.parse(req.body);
    let status = data.status;
    if (status) status = appointmentStatusFromUi(status);

    const existing = await prisma.appointment.findFirst({
      where: { id: req.params.id, businessId: req.businessId },
    });
    if (!existing) throw createError(404, 'Cita no encontrada.', 'NOT_FOUND');
    if (req.user.role === 'employee' && existing.employeeId !== req.user.id) {
      throw createError(403, 'No tienes permiso para modificar esta cita.', 'FORBIDDEN');
    }

    if (status === 'completed') {
      const completed = await completeAppointment(req.params.id, req.businessId, data.paymentMethod || 'cash');
      const full = await prisma.appointment.findUnique({
        where: { id: completed.id },
        include: { service: true, employee: true },
      });
      return res.json({ appointment: mapAppointmentToUi(full) });
    }

    if (status === 'cancelled' && existing.status === 'completed') {
      throw createError(400, 'No se puede cancelar una cita finalizada.', 'INVALID_STATUS');
    }

    const appointment = await prisma.appointment.update({
      where: { id: req.params.id },
      data: { status: status || undefined },
      include: { service: true, employee: true },
    });

    res.json({ appointment: mapAppointmentToUi(appointment) });
  } catch (err) {
    next(err);
  }
});

export default router;
