import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireBusinessContext, requireRole } from '../middleware/auth.js';
import { createError } from '../middleware/errorHandler.js';
import { amountToCents, centsToAmount, nowInBusinessTz, parseDateOnly } from '../lib/utils.js';

const router = Router();

router.use(authenticate, requireBusinessContext);

// Topes: el precio cabe de sobra en el entero de 32 bits de la base (en centavos) y la duración
// no pasa de la jornada de 10 h que usan las métricas de ocupación.
const MAX_PRECIO = 10_000_000;
const MAX_DURACION = 600;

const serviceSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre del servicio es obligatorio.').max(80, 'El nombre del servicio es demasiado largo (máximo 80 caracteres).'),
  categoria: z.string().trim().min(1, 'La categoría es obligatoria.').max(40, 'La categoría es demasiado larga (máximo 40 caracteres).'),
  precio: z.number().int('El precio debe ser un número entero de pesos.').nonnegative('El precio no puede ser negativo.')
    .max(MAX_PRECIO, 'El precio es demasiado alto (máximo $10.000.000).'),
  duracion: z.number().int('La duración debe ser un número entero de minutos.').positive('La duración debe ser mayor que cero.')
    .max(MAX_DURACION, 'La duración es demasiado larga (máximo 600 minutos).'),
});

function mapServiceToUi(service) {
  return {
    id: service.id,
    nombre: service.name,
    categoria: service.category,
    precio: centsToAmount(service.priceCents),
    duracion: service.durationMinutes,
    veces: service.timesPerformed,
  };
}

const sameName = (a, b) => a.trim().toLocaleLowerCase('es') === b.trim().toLocaleLowerCase('es');

/** Falla con 409 si otro servicio activo del negocio ya usa ese nombre (sin distinguir mayúsculas ni espacios). */
async function assertNameFree(tx, businessId, name, exceptId) {
  const activos = await tx.service.findMany({ where: { businessId, isActive: true }, select: { id: true, name: true } });
  if (activos.some((s) => s.id !== exceptId && sameName(s.name, name))) {
    throw createError(409, 'Ya existe un servicio con ese nombre.', 'DUPLICATE_NAME');
  }
}

// Las altas y cambios de nombre se comprueban bajo un cerrojo por negocio para que dos peticiones
// simultáneas no dejen dos servicios con el mismo nombre.
const TX_OPTS = { maxWait: 15000, timeout: 15000 }; // una ráfaga de altas hace cola en el cerrojo
const lockNames = (tx, businessId) => tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`services:${businessId}`}))`;

const hoy = () => parseDateOnly(nowInBusinessTz().date);

/** Citas de hoy en adelante, sin finalizar ni cancelar, que usan el servicio. */
const countPending = (businessId, serviceId) => prisma.appointment.count({
  where: { businessId, serviceId, status: { in: ['pending', 'confirmed'] }, appointmentDate: { gte: hoy() } },
});

/** Cuántos pares de citas futuras de un mismo barbero se pisan, contando solo los que incluyen este servicio. */
async function countScheduleConflicts(businessId, serviceId) {
  const own = await prisma.appointment.findMany({
    where: { businessId, serviceId, status: { in: ['pending', 'confirmed'] }, appointmentDate: { gte: hoy() } },
    select: { employeeId: true, appointmentDate: true },
  });
  if (own.length === 0) return 0;
  const rows = await prisma.appointment.findMany({
    where: {
      businessId,
      status: { in: ['pending', 'confirmed'] },
      employeeId: { in: [...new Set(own.map((a) => a.employeeId))] },
      appointmentDate: { in: [...new Map(own.map((a) => [+a.appointmentDate, a.appointmentDate])).values()] },
    },
    include: { service: { select: { durationMinutes: true } } },
  });
  const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const byDay = new Map();
  for (const a of rows) {
    const key = `${a.employeeId}|${+a.appointmentDate}`;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push({ start: toMin(a.startTime), end: toMin(a.startTime) + a.service.durationMinutes, mine: a.serviceId === serviceId });
  }
  let conflicts = 0;
  for (const day of byDay.values()) {
    for (let i = 0; i < day.length; i += 1) {
      for (let j = i + 1; j < day.length; j += 1) {
        const [x, y] = [day[i], day[j]];
        if ((x.mine || y.mine) && x.start < y.end && y.start < x.end) conflicts += 1;
      }
    }
  }
  return conflicts;
}

router.get('/', async (req, res, next) => {
  try {
    const services = await prisma.service.findMany({
      where: { businessId: req.businessId, isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json({ services: services.map(mapServiceToUi) });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('owner'), async (req, res, next) => {
  try {
    const data = serviceSchema.parse(req.body);
    const service = await prisma.$transaction(async (tx) => {
      await lockNames(tx, req.businessId);
      await assertNameFree(tx, req.businessId, data.nombre);
      return tx.service.create({
        data: {
          businessId: req.businessId,
          name: data.nombre,
          category: data.categoria,
          priceCents: amountToCents(data.precio),
          durationMinutes: data.duracion,
        },
      });
    }, TX_OPTS);
    res.status(201).json({ service: mapServiceToUi(service) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireRole('owner'), async (req, res, next) => {
  try {
    const data = serviceSchema.partial().parse(req.body);
    const service = await prisma.$transaction(async (tx) => {
      await lockNames(tx, req.businessId);
      const existing = await tx.service.findFirst({
        where: { id: req.params.id, businessId: req.businessId, isActive: true },
      });
      if (!existing) throw createError(404, 'Servicio no encontrado.', 'NOT_FOUND');
      if (data.nombre !== undefined) await assertNameFree(tx, req.businessId, data.nombre, existing.id);

      return tx.service.update({
        where: { id: existing.id },
        data: {
          name: data.nombre,
          category: data.categoria,
          priceCents: data.precio !== undefined ? amountToCents(data.precio) : undefined,
          durationMinutes: data.duracion,
        },
      });
    }, TX_OPTS);
    // Alargar un servicio puede pisar citas ya agendadas: no se bloquea el cambio, se avisa.
    const scheduleConflicts = data.duracion !== undefined ? await countScheduleConflicts(req.businessId, service.id) : 0;
    res.json({ service: mapServiceToUi(service), scheduleConflicts });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRole('owner'), async (req, res, next) => {
  try {
    const existing = await prisma.service.findFirst({
      where: { id: req.params.id, businessId: req.businessId, isActive: true },
    });
    if (!existing) throw createError(404, 'Servicio no encontrado.', 'NOT_FOUND');

    await prisma.service.update({
      where: { id: existing.id },
      data: { isActive: false },
    });
    // Las citas ya agendadas siguen en pie: se avisa cuántas quedan para que el dueño las revise.
    res.json({ ok: true, pendingAppointments: await countPending(req.businessId, existing.id) });
  } catch (err) {
    next(err);
  }
});

export default router;
