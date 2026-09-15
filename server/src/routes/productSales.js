import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireBusinessContext } from '../middleware/auth.js';
import { createError } from '../middleware/errorHandler.js';
import { centsToAmount, formatDateOnly } from '../lib/utils.js';
import { upsertClientFromInteraction } from '../services/clientService.js';

const router = Router();

router.use(authenticate, requireBusinessContext);

const saleSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  clientId: z.string().uuid().optional(),
  clientName: z.string().optional(),
});

function mapSaleToUi(sale, productName) {
  return {
    id: sale.id,
    fecha: formatDateOnly(new Date(sale.soldAt)),
    productoId: sale.productId,
    producto: productName,
    cantidad: sale.quantity,
    precioUnitario: centsToAmount(sale.unitPriceCents),
    total: centsToAmount(sale.totalCents),
    cliente: sale.clientName || '',
  };
}

router.get('/', async (req, res, next) => {
  try {
    const where = { businessId: req.businessId };
    if (req.query.from || req.query.to) {
      where.soldAt = {};
      if (req.query.from) where.soldAt.gte = new Date(`${req.query.from}T00:00:00.000Z`);
      if (req.query.to) where.soldAt.lte = new Date(`${req.query.to}T23:59:59.999Z`);
    }

    const sales = await prisma.productSale.findMany({
      where,
      include: { product: true },
      orderBy: { soldAt: 'desc' },
    });

    res.json({
      ventas: sales.map((s) => mapSaleToUi(s, s.product.name)),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const data = saleSchema.parse(req.body);

    const product = await prisma.product.findFirst({
      where: { id: data.productId, businessId: req.businessId, isActive: true },
    });
    if (!product) throw createError(404, 'Producto no encontrado.', 'NOT_FOUND');
    if (product.stock < data.quantity) {
      throw createError(400, 'Stock insuficiente.', 'INSUFFICIENT_STOCK');
    }

    let clientId = data.clientId || null;
    let clientName = data.clientName?.trim() || null;

    if (clientName && !clientId) {
      const client = await upsertClientFromInteraction(req.businessId, {
        name: clientName,
        phone: '',
        serviceName: product.name,
        amountCents: product.salePriceCents * data.quantity,
      });
      clientId = client?.id || null;
    }

    const sale = await prisma.$transaction(async (tx) => {
      const created = await tx.productSale.create({
        data: {
          businessId: req.businessId,
          productId: product.id,
          clientId,
          clientName,
          quantity: data.quantity,
          unitPriceCents: product.salePriceCents,
          totalCents: product.salePriceCents * data.quantity,
          soldById: req.user.id,
        },
        include: { product: true },
      });

      await tx.product.update({
        where: { id: product.id },
        data: { stock: { decrement: data.quantity } },
      });

      await tx.stockAdjustment.create({
        data: {
          productId: product.id,
          delta: -data.quantity,
          reason: 'sale',
          referenceId: created.id,
        },
      });

      return created;
    });

    res.status(201).json({ venta: mapSaleToUi(sale, product.name) });
  } catch (err) {
    next(err);
  }
});

export default router;
