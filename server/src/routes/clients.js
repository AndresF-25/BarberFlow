import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireBusinessContext, requireRole } from '../middleware/auth.js';
import { createError } from '../middleware/errorHandler.js';
import {
  cleanName, enrichClients, getClientHistory, normalizePhone, normalizeText,
} from '../services/clientService.js';

const router = Router();

router.use(authenticate, requireBusinessContext);

const TAGS = ['Todos', 'Nuevo', 'Frecuente', 'VIP', 'Inactivo'];

const listQuerySchema = z.object({
  // Si el parámetro llega repetido (?search=a&search=b) se usa el primero.
  search: z.preprocess((v) => (Array.isArray(v) ? v[0] : v), z.string().trim().max(100, 'La búsqueda es demasiado larga (máximo 100 caracteres).').optional()),
  tag: z.preprocess((v) => (Array.isArray(v) ? v[0] : v), z.enum(TAGS, { errorMap: () => ({ message: 'Etiqueta no válida. Usa Todos, Nuevo, Frecuente, VIP o Inactivo.' }) }).optional()),
});

const patchSchema = z.object({
  name: z.string().transform(cleanName).pipe(z.string().min(1, 'El nombre del cliente es obligatorio.').max(80, 'El nombre del cliente es demasiado largo (máximo 80 caracteres).')).optional(),
  phone: z.string().trim()
    .refine((v) => v === '' || /^[0-9+()\-\s]{7,20}$/.test(v), 'El teléfono solo puede tener números, espacios, +, - y paréntesis (7 a 20 caracteres).')
    .optional(),
  notes: z.string().trim().max(500, 'Las notas son demasiado largas (máximo 500 caracteres).').optional(),
});

/** ¿La ficha coincide con lo buscado? Sin distinguir mayúsculas ni tildes; el teléfono ignora espacios, guiones y el +57. */
function matchesSearch(client, search) {
  const text = normalizeText(search);
  if (normalizeText(client.name).includes(text)) return true;
  const digits = normalizePhone(search);
  return digits.length > 0 && normalizePhone(client.phone).includes(digits);
}

// Más reciente primero (los que nunca vinieron, al final); en empate, por nombre.
const byRecency = (a, b) => {
  const [x, y] = [a.ultima === '—' ? '' : a.ultima, b.ultima === '—' ? '' : b.ultima];
  return y.localeCompare(x) || a.nombre.localeCompare(b.nombre, 'es');
};

router.get('/', async (req, res, next) => {
  try {
    const { search, tag } = listQuerySchema.parse(req.query);
    let clients = await prisma.client.findMany({ where: { businessId: req.businessId } });
    if (search) clients = clients.filter((c) => matchesSearch(c, search));

    const enriched = await enrichClients(req.businessId, clients);
    const filtered = tag && tag !== 'Todos' ? enriched.filter((c) => c.etiqueta === tag) : enriched;

    res.json({ clients: filtered.sort(byRecency) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const client = await prisma.client.findFirst({
      where: { id: req.params.id, businessId: req.businessId },
    });

    if (!client) throw createError(404, 'Cliente no encontrado.', 'NOT_FOUND');

    const [enriched] = await enrichClients(req.businessId, [client]);
    const historial = await getClientHistory(req.businessId, client.id);

    res.json({ client: enriched, historial });
  } catch (err) {
    next(err);
  }
});

// Corregir la ficha (nombre, teléfono, notas). Las visitas, el gasto y la etiqueta se calculan solos.
router.patch('/:id', requireRole('owner'), async (req, res, next) => {
  try {
    const data = patchSchema.parse(req.body);
    const client = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`clients:${req.businessId}`}))`;
      const existing = await tx.client.findFirst({ where: { id: req.params.id, businessId: req.businessId } });
      if (!existing) throw createError(404, 'Cliente no encontrado.', 'NOT_FOUND');

      const key = data.phone ? normalizePhone(data.phone) : '';
      if (key) {
        const others = await tx.client.findMany({ where: { businessId: req.businessId, NOT: { phone: '' } } });
        if (others.some((c) => c.id !== existing.id && normalizePhone(c.phone) === key)) {
          throw createError(409, 'Ya hay un cliente con ese teléfono.', 'DUPLICATE_PHONE');
        }
      }

      return tx.client.update({
        where: { id: existing.id },
        data: { name: data.name, phone: data.phone, notes: data.notes },
      });
    }, { maxWait: 15000, timeout: 15000 });

    const [enriched] = await enrichClients(req.businessId, [client]);
    res.json({ client: enriched });
  } catch (err) {
    next(err);
  }
});

export default router;
