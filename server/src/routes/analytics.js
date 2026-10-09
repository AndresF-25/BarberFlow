import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireBusinessContext, requireRole } from '../middleware/auth.js';
import {
  getAlerts,
  getDashboardAnalytics,
  getMetricsAnalytics,
  getRevenueAnalytics,
} from '../services/analyticsService.js';

const router = Router();

router.use(authenticate, requireBusinessContext, requireRole('owner'));

// `period` es «week» (por defecto) o «month»; cualquier otra cosa es un error, no se toma «week» en silencio.
const first = (v) => (Array.isArray(v) ? v[0] : v);
const periodSchema = z.preprocess(
  (v) => (first(v) === '' ? undefined : first(v)),
  z.enum(['week', 'month'], { errorMap: () => ({ message: 'Período no válido. Usa week o month.' }) }).default('week'),
);
const periodOf = (req) => periodSchema.parse(req.query.period);

router.get('/dashboard', async (req, res, next) => {
  try {
    res.json(await getDashboardAnalytics(req.businessId, req.query.date?.toString()));
  } catch (err) {
    next(err);
  }
});

router.get('/revenue', async (req, res, next) => {
  try {
    res.json(await getRevenueAnalytics(req.businessId, periodOf(req), req.query.anchorDate?.toString()));
  } catch (err) {
    next(err);
  }
});

router.get('/metrics', async (req, res, next) => {
  try {
    res.json(await getMetricsAnalytics(req.businessId, periodOf(req), req.query.anchorDate?.toString()));
  } catch (err) {
    next(err);
  }
});

router.get('/alerts', async (req, res, next) => {
  try {
    res.json({ alerts: await getAlerts(req.businessId) });
  } catch (err) {
    next(err);
  }
});

export default router;
