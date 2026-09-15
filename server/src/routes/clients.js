import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireBusinessContext } from '../middleware/auth.js';
import { createError } from '../middleware/errorHandler.js';
import { enrichClients, getClientHistory } from '../services/clientService.js';

const router = Router();

router.use(authenticate, requireBusinessContext);

router.get('/', async (req, res, next) => {
  try {
    const search = (req.query.search || '').toString().trim();
    const clients = await prisma.client.findMany({
      where: {
        businessId: req.businessId,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });

    const enriched = await enrichClients(req.businessId, clients);
    const tag = req.query.tag?.toString();
    const filtered = tag && tag !== 'Todos'
      ? enriched.filter((c) => c.etiqueta === tag)
      : enriched;

    res.json({ clients: filtered });
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

export default router;
