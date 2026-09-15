import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireBusinessContext, requireRole } from '../middleware/auth.js';
import { createError } from '../middleware/errorHandler.js';
import { amountToCents, centsToAmount } from '../lib/utils.js';

const router = Router();

router.use(authenticate, requireBusinessContext);

const serviceSchema = z.object({
  nombre: z.string().min(1),
  categoria: z.string().min(1),
  precio: z.number().nonnegative(),
  duracion: z.number().int().positive(),
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
    const service = await prisma.service.create({
      data: {
        businessId: req.businessId,
        name: data.nombre,
        category: data.categoria,
        priceCents: amountToCents(data.precio),
        durationMinutes: data.duracion,
      },
    });
    res.status(201).json({ service: mapServiceToUi(service) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireRole('owner'), async (req, res, next) => {
  try {
    const data = serviceSchema.partial().parse(req.body);
    const existing = await prisma.service.findFirst({
      where: { id: req.params.id, businessId: req.businessId },
    });
    if (!existing) throw createError(404, 'Servicio no encontrado.', 'NOT_FOUND');

    const service = await prisma.service.update({
      where: { id: req.params.id },
      data: {
        name: data.nombre,
        category: data.categoria,
        priceCents: data.precio !== undefined ? amountToCents(data.precio) : undefined,
        durationMinutes: data.duracion,
      },
    });
    res.json({ service: mapServiceToUi(service) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRole('owner'), async (req, res, next) => {
  try {
    const existing = await prisma.service.findFirst({
      where: { id: req.params.id, businessId: req.businessId },
    });
    if (!existing) throw createError(404, 'Servicio no encontrado.', 'NOT_FOUND');

    await prisma.service.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
