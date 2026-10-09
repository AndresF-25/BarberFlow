import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireBusinessContext } from '../middleware/auth.js';
import { createError } from '../middleware/errorHandler.js';
import { addDays, appointmentStatusFromUi, nowInBusinessTz, parseDateOnly, timeToMinutes } from '../lib/utils.js';
import {
  changeAppointment,
  createAppointmentIfFree,
  listAppointments,
  mapAppointmentToUi,
} from '../services/appointmentService.js';
import { cleanName } from '../services/clientService.js';

const router = Router();

router.use(authenticate, requireBusinessContext);

const MAX_DAYS_AHEAD = 365; // no se agenda a más de un año vista
const MINUTES_PER_DAY = 24 * 60;

const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled', 'Pendiente', 'Confirmada', 'Finalizada', 'Cancelada'];
const statusSchema = z.enum(STATUSES, { errorMap: () => ({ message: 'Estado no válido. Usa Pendiente, Confirmada, Finalizada o Cancelada.' }) });

const first = (v) => (Array.isArray(v) ? v[0] : v);

const listQuerySchema = z.object({
  date: z.preprocess(first, z.string().optional()),
  from: z.preprocess(first, z.string().optional()),
  to: z.preprocess(first, z.string().optional()),
  status: z.preprocess(first, statusSchema.optional()),
  employeeId: z.preprocess(first, z.string().optional()),
});

const createSchema = z.object({
  clientName: z.string().transform(cleanName).pipe(
    z.string().min(1, 'El nombre del cliente es obligatorio.').max(80, 'El nombre del cliente es demasiado largo (máximo 80 caracteres).'),
  ),
  clientPhone: z.string().trim()
    .refine((v) => v === '' || /^[0-9+()\-\s]{7,20}$/.test(v), 'El teléfono solo puede tener números, espacios, +, - y paréntesis (7 a 20 caracteres).')
    .optional(),
  serviceId: z.string().uuid(),
  employeeId: z.string().uuid(),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida.'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (usa HH:MM).'),
});

const patchSchema = z.object({
  status: statusSchema.optional(),
  paymentMethod: z.enum(['cash', 'card', 'transfer'], { errorMap: () => ({ message: 'Método de pago no válido. Usa efectivo, tarjeta o transferencia.' }) }).optional(),
});

router.get('/', async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query);

    const appointments = await listAppointments(req.businessId, {
      date: query.date,
      from: query.from,
      to: query.to,
      status: query.status ? appointmentStatusFromUi(query.status) : undefined,
      // Un empleado solo ve sus propias citas.
      employeeId: req.user.role === 'employee' ? req.user.id : query.employeeId,
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

    parseDateOnly(data.appointmentDate); // 400 si la fecha no existe (30 de febrero…)
    const now = nowInBusinessTz();
    if (data.appointmentDate < now.date || (data.appointmentDate === now.date && data.startTime < now.time)) {
      throw createError(400, 'No se pueden crear citas en el pasado.', 'PAST_APPOINTMENT');
    }
    if (data.appointmentDate > addDays(now.date, MAX_DAYS_AHEAD)) {
      throw createError(400, 'No se puede agendar a más de un año vista.', 'TOO_FAR');
    }

    const [service, employee] = await Promise.all([
      prisma.service.findFirst({ where: { id: data.serviceId, businessId: req.businessId, isActive: true } }),
      prisma.user.findFirst({ where: { id: data.employeeId, businessId: req.businessId, role: 'employee', isActive: true } }),
    ]);

    if (!service) throw createError(404, 'Servicio no encontrado.', 'NOT_FOUND');
    if (!employee) throw createError(404, 'Empleado no encontrado.', 'NOT_FOUND');

    if (timeToMinutes(data.startTime) + service.durationMinutes > MINUTES_PER_DAY) {
      throw createError(400, 'La cita terminaría después de medianoche: elige una hora más temprana o un servicio más corto.', 'PAST_MIDNIGHT');
    }

    const appointment = await createAppointmentIfFree({
      businessId: req.businessId,
      userId: req.user.id,
      service,
      employee,
      date: data.appointmentDate,
      startTime: data.startTime,
      clientName: data.clientName,
      clientPhone: data.clientPhone || '',
    });

    res.status(201).json({ appointment: mapAppointmentToUi(appointment) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const data = patchSchema.parse(req.body);
    const appointment = await changeAppointment({
      id: req.params.id,
      businessId: req.businessId,
      user: req.user,
      status: data.status ? appointmentStatusFromUi(data.status) : undefined,
      paymentMethod: data.paymentMethod,
    });
    res.json({ appointment: mapAppointmentToUi(appointment) });
  } catch (err) {
    next(err);
  }
});

export default router;
