import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireBusinessContext, requireRole } from '../middleware/auth.js';
import { createError } from '../middleware/errorHandler.js';
import { amountToCents, centsToAmount } from '../lib/utils.js';

const router = Router();

router.use(authenticate, requireBusinessContext);

// Topes: caben de sobra en el entero de 32 bits de la base (los precios van en centavos).
const MAX_STOCK = 1_000_000;
const MAX_PRECIO = 10_000_000;

const texto = (campo, max, articulo = 'El') => z.string().trim()
  .min(1, `${articulo === 'La' ? 'La' : 'El'} ${campo} es obligatori${articulo === 'La' ? 'a' : 'o'}.`)
  .max(max, `${articulo === 'La' ? 'La' : 'El'} ${campo} es demasiado larg${articulo === 'La' ? 'a' : 'o'} (máximo ${max} caracteres).`);
const cantidad = (campo) => z.number().int(`${campo} debe ser un número entero.`).nonnegative(`${campo} no puede ser negativo.`)
  .max(MAX_STOCK, `${campo} es demasiado alto (máximo 1.000.000).`);
const precio = (campo) => z.number().int(`${campo} debe ser un número entero de pesos.`).nonnegative(`${campo} no puede ser negativo.`)
  .max(MAX_PRECIO, `${campo} es demasiado alto (máximo $10.000.000).`);

const productSchema = z.object({
  nombre: texto('nombre del producto', 80),
  categoria: texto('categoría', 40, 'La'),
  stock: cantidad('El stock'),
  stockMinimo: cantidad('El stock mínimo'),
  unidad: texto('unidad', 20, 'La'),
  precioVenta: precio('El precio de venta'),
  precioCosto: precio('El precio de costo').optional(),
});

const adjustSchema = z.object({
  delta: z.number().int('El ajuste debe ser un número entero.')
    .min(-MAX_STOCK, 'El ajuste es demasiado grande (máximo 1.000.000).')
    .max(MAX_STOCK, 'El ajuste es demasiado grande (máximo 1.000.000).')
    .refine((d) => d !== 0, 'El ajuste no puede ser cero.'),
  reason: z.enum(['manual', 'correction']).default('manual'),
});

// El precio de costo es del dueño: el barbero ve el catálogo (para vender) pero no lo que costó.
function mapProductToUi(product, { withCost = true } = {}) {
  const ui = {
    id: product.id,
    nombre: product.name,
    categoria: product.category,
    stock: product.stock,
    stockMinimo: product.stockMin,
    unidad: product.unit,
    precioVenta: centsToAmount(product.salePriceCents),
  };
  if (withCost) ui.precioCosto = centsToAmount(product.costPriceCents);
  return ui;
}

const TX_OPTS = { maxWait: 15000, timeout: 15000 }; // una ráfaga hace cola en los cerrojos
const sameName = (a, b) => a.trim().toLocaleLowerCase('es') === b.trim().toLocaleLowerCase('es');

// Las altas y cambios de nombre se comprueban bajo un cerrojo por negocio para que dos peticiones
// simultáneas no dejen dos productos con el mismo nombre.
const lockNames = (tx, businessId) => tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`products:${businessId}`}))`;

async function assertNameFree(tx, businessId, name, exceptId) {
  const activos = await tx.product.findMany({ where: { businessId, isActive: true }, select: { id: true, name: true } });
  if (activos.some((p) => p.id !== exceptId && sameName(p.name, name))) {
    throw createError(409, 'Ya existe un producto con ese nombre.', 'DUPLICATE_NAME');
  }
}

/** Bloquea la fila del producto activo y devuelve su stock actual (o null si no existe, es de otro negocio o está eliminado). */
async function lockStock(tx, productId, businessId) {
  const rows = await tx.$queryRaw`SELECT stock FROM products WHERE id = ${productId} AND business_id = ${businessId} AND is_active = true FOR UPDATE`;
  return rows.length ? rows[0].stock : null;
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

    const withCost = req.user.role !== 'employee';
    res.json({ products: products.map((p) => mapProductToUi(p, { withCost })) });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('owner'), async (req, res, next) => {
  try {
    const data = productSchema.parse(req.body);
    const product = await prisma.$transaction(async (tx) => {
      await lockNames(tx, req.businessId);
      await assertNameFree(tx, req.businessId, data.nombre);
      const created = await tx.product.create({
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
      // El stock inicial entra al historial: así la suma de ajustes siempre es igual al stock.
      if (data.stock > 0) {
        await tx.stockAdjustment.create({ data: { productId: created.id, delta: data.stock, reason: 'manual' } });
      }
      return created;
    }, TX_OPTS);
    res.status(201).json({ product: mapProductToUi(product) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireRole('owner'), async (req, res, next) => {
  try {
    const data = productSchema.partial().parse(req.body);
    const product = await prisma.$transaction(async (tx) => {
      await lockNames(tx, req.businessId);
      const currentStock = await lockStock(tx, req.params.id, req.businessId);
      if (currentStock === null) throw createError(404, 'Producto no encontrado.', 'NOT_FOUND');
      if (data.nombre !== undefined) await assertNameFree(tx, req.businessId, data.nombre, req.params.id);

      const row = await tx.product.update({
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
      // Corregir el stock a mano deja constancia en el historial (delta = diferencia).
      if (data.stock !== undefined && data.stock !== currentStock) {
        await tx.stockAdjustment.create({ data: { productId: row.id, delta: data.stock - currentStock, reason: 'correction' } });
      }
      return row;
    }, TX_OPTS);
    res.json({ product: mapProductToUi(product) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRole('owner'), async (req, res, next) => {
  try {
    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, businessId: req.businessId, isActive: true },
    });
    if (!existing) throw createError(404, 'Producto no encontrado.', 'NOT_FOUND');

    await prisma.product.update({
      where: { id: existing.id },
      data: { isActive: false },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

const MOTIVO_UI = { sale: 'venta', manual: 'ajuste', correction: 'correccion' };
const historySchema = z.object({
  limit: z.coerce.number().int('El límite debe ser un número entero.').min(1, 'El límite debe ser al menos 1.').max(200, 'El límite no puede pasar de 200.').default(50),
});

// Historial de movimientos de stock (los más recientes primero). `saldo` es el stock que quedó después de cada
// movimiento: se calcula hacia atrás desde el stock actual, así es coherente aunque el producto sea anterior al historial.
router.get('/:id/stock-history', requireRole('owner'), async (req, res, next) => {
  try {
    const { limit } = historySchema.parse(req.query);
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, businessId: req.businessId, isActive: true },
    });
    if (!product) throw createError(404, 'Producto no encontrado.', 'NOT_FOUND');

    const [rows, total] = await Promise.all([
      prisma.stockAdjustment.findMany({
        where: { productId: product.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
      }),
      prisma.stockAdjustment.count({ where: { productId: product.id } }),
    ]);

    let saldo = product.stock;
    const movements = rows.map((r) => {
      const item = { id: r.id, fecha: r.createdAt.toISOString(), motivo: MOTIVO_UI[r.reason], cambio: r.delta, saldo, ventaId: r.reason === 'sale' ? r.referenceId : null };
      saldo -= r.delta;
      return item;
    });
    res.json({ movements, total });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/adjust-stock', requireRole('owner'), async (req, res, next) => {
  try {
    const data = adjustSchema.parse(req.body);

    const updated = await prisma.$transaction(async (tx) => {
      // Fila bloqueada: dos ajustes (o un ajuste y una venta) simultáneos se ponen en fila y ninguno pisa al otro.
      const stock = await lockStock(tx, req.params.id, req.businessId);
      if (stock === null) throw createError(404, 'Producto no encontrado.', 'NOT_FOUND');

      const next = Math.max(0, stock + data.delta);
      if (next > MAX_STOCK) throw createError(400, 'El stock no puede pasar de 1.000.000.', 'STOCK_LIMIT');
      const applied = next - stock; // lo que de verdad cambió (si el stock llega al piso de 0, es menos que lo pedido)

      const row = await tx.product.update({ where: { id: req.params.id }, data: { stock: next } });
      if (applied !== 0) {
        await tx.stockAdjustment.create({ data: { productId: row.id, delta: applied, reason: data.reason } });
      }
      return row;
    }, TX_OPTS);

    res.json({ product: mapProductToUi(updated) });
  } catch (err) {
    next(err);
  }
});

export default router;
