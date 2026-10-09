import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireBusinessContext } from '../middleware/auth.js';
import { createError } from '../middleware/errorHandler.js';
import {
  businessDateOf, businessDayEnd, businessDayStart, businessTimeOf, centsToAmount,
} from '../lib/utils.js';
import { cleanName, upsertClientFromInteraction } from '../services/clientService.js';

const router = Router();

router.use(authenticate, requireBusinessContext);

const TX_OPTS = { maxWait: 15000, timeout: 15000 }; // una ráfaga de ventas hace cola en los bloqueos
const first = (v) => (Array.isArray(v) ? v[0] : v);

const saleSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  clientId: z.string().uuid().optional(),
  // Solo espacios = sin cliente; con texto, 1–80 caracteres y los espacios juntos.
  clientName: z.string().transform(cleanName).pipe(z.string().max(80, 'El nombre del cliente es demasiado largo (máximo 80 caracteres).')).optional(),
});

const listQuerySchema = z.object({
  from: z.preprocess(first, z.string().optional()),
  to: z.preprocess(first, z.string().optional()),
});

// La fecha y la hora de la venta son las del negocio (Bogotá), no las de UTC: una venta de las 9:30 p. m. es de ese día.
function mapSaleToUi(sale) {
  return {
    id: sale.id,
    fecha: businessDateOf(sale.soldAt),
    hora: businessTimeOf(sale.soldAt),
    productoId: sale.productId,
    producto: sale.product?.name || '',
    cantidad: sale.quantity,
    precioUnitario: centsToAmount(sale.unitPriceCents),
    total: centsToAmount(sale.totalCents),
    cliente: sale.clientName || '',
    vendedor: sale.soldBy?.name || '',
  };
}

const SALE_INCLUDE = { product: true, soldBy: { select: { name: true } } };

router.get('/', async (req, res, next) => {
  try {
    const { from, to } = listQuerySchema.parse(req.query);
    const where = { businessId: req.businessId };
    // Un barbero solo ve sus propias ventas (igual que sus citas); el dueño ve todas.
    if (req.user.role === 'employee') where.soldById = req.user.id;
    if (from || to) {
      where.soldAt = {};
      if (from) where.soldAt.gte = businessDayStart(from); // 400 si la fecha no existe
      if (to) where.soldAt.lte = businessDayEnd(to);
    }

    const sales = await prisma.productSale.findMany({
      where,
      include: SALE_INCLUDE,
      orderBy: { soldAt: 'desc' },
    });

    res.json({ ventas: sales.map(mapSaleToUi) });
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

    // Una ficha ajena (o que no existe) no se puede vincular: sería enlazar la venta con el cliente de otro negocio.
    let fixedClient = null;
    if (data.clientId) {
      fixedClient = await prisma.client.findFirst({ where: { id: data.clientId, businessId: req.businessId } });
      if (!fixedClient) throw createError(404, 'Cliente no encontrado.', 'NOT_FOUND');
    }

    if (product.stock < data.quantity) {
      throw createError(400, 'Stock insuficiente.', 'INSUFFICIENT_STOCK');
    }

    const sale = await prisma.$transaction(async (tx) => {
      // Descuento atómico: si dos ventas simultáneas se disputan el último stock, solo una pasa.
      const discounted = await tx.product.updateMany({
        where: { id: product.id, businessId: req.businessId, isActive: true, stock: { gte: data.quantity } },
        data: { stock: { decrement: data.quantity } },
      });
      if (discounted.count === 0) {
        throw createError(400, 'Stock insuficiente.', 'INSUFFICIENT_STOCK');
      }

      // La ficha se crea o se reconoce dentro de la misma transacción: una venta rechazada no deja clientes huérfanos.
      const client = fixedClient
        || (data.clientName ? await upsertClientFromInteraction(req.businessId, { name: data.clientName, phone: '' }, tx) : null);

      const created = await tx.productSale.create({
        data: {
          businessId: req.businessId,
          productId: product.id,
          clientId: client?.id || null,
          clientName: client?.name || null,
          quantity: data.quantity,
          unitPriceCents: product.salePriceCents,
          totalCents: product.salePriceCents * data.quantity,
          soldById: req.user.id,
        },
        include: SALE_INCLUDE,
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
    }, TX_OPTS);

    res.status(201).json({ venta: mapSaleToUi(sale) });
  } catch (err) {
    next(err);
  }
});

export default router;
