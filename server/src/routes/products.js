import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireBusinessContext, requireRole } from '../middleware/auth.js';
import { createError } from '../middleware/errorHandler.js';
import { amountToCents, centsToAmount, formatDateOnly } from '../lib/utils.js';
import { upsertClientFromInteraction } from '../services/clientService.js';

const router = Router();

router.use(authenticate, requireBusinessContext);

const productSchema = z.object({
  nombre: z.string().min(1),
  categoria: z.string().min(1),
  stock: z.number().int().nonnegative(),
  stockMinimo: z.number().int().nonnegative(),
  unidad: z.string().min(1),
  precioVenta: z.number().nonnegative(),
  precioCosto: z.number().nonnegative().optional(),
});

function mapProductToUi(product) {
  return {
    id: product.id,
    nombre: product.name,
    categoria: product.category,
    stock: product.stock,
    stockMinimo: product.stockMin,
    unidad: product.unit,
    precioVenta: centsToAmount(product.salePriceCents),
    precioCosto: centsToAmount(product.costPriceCents),
  };
}

router.get('/', async (req, res, next) => {
  try {
    const where = { businessId: req.businessId, isActive: true };
    if (req.query.category) where.category = req.query.category.toString();

    let products = await prisma.product.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    if (req.query.lowStock === 'true') {
      products = products.filter((p) => p.stock <= p.stockMin);
    }

    res.json({ products: products.map(mapProductToUi) });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('owner'), async (req, res, next) => {
  try {
    const data = productSchema.parse(req.body);
    const product = await prisma.product.create({
      data: {
        businessId: req.businessId,
        name: data.nombre,
        category: data.categoria,
        stock: data.stock,
        stockMin: data.stockMinimo,
        unit: data.unidad,
        salePriceCents: amountToCents(data.precioVenta),
        costPriceCents: amountToCents(data.precioCosto || 0),
      },
    });
    res.status(201).json({ product: mapProductToUi(product) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireRole('owner'), async (req, res, next) => {
  try {
    const data = productSchema.partial().parse(req.body);
    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, businessId: req.businessId },
    });
    if (!existing) throw createError(404, 'Producto no encontrado.', 'NOT_FOUND');

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        name: data.nombre,
        category: data.categoria,
        stock: data.stock,
        stockMin: data.stockMinimo,
        unit: data.unidad,
        salePriceCents: data.precioVenta !== undefined ? amountToCents(data.precioVenta) : undefined,
        costPriceCents: data.precioCosto !== undefined ? amountToCents(data.precioCosto) : undefined,
      },
    });
    res.json({ product: mapProductToUi(product) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRole('owner'), async (req, res, next) => {
  try {
    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, businessId: req.businessId },
    });
    if (!existing) throw createError(404, 'Producto no encontrado.', 'NOT_FOUND');

    await prisma.product.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/adjust-stock', requireRole('owner'), async (req, res, next) => {
  try {
    const schema = z.object({
      delta: z.number().int(),
      reason: z.enum(['manual', 'correction']).default('manual'),
    });
    const data = schema.parse(req.body);

    const product = await prisma.product.findFirst({
      where: { id: req.params.id, businessId: req.businessId, isActive: true },
    });
    if (!product) throw createError(404, 'Producto no encontrado.', 'NOT_FOUND');

    const updated = await prisma.$transaction(async (tx) => {
      const nextStock = Math.max(0, product.stock + data.delta);
      const row = await tx.product.update({
        where: { id: product.id },
        data: { stock: nextStock },
      });
      await tx.stockAdjustment.create({
        data: {
          productId: product.id,
          delta: data.delta,
          reason: data.reason,
        },
      });
      return row;
    });

    res.json({ product: mapProductToUi(updated) });
  } catch (err) {
    next(err);
  }
});

export default router;
