import { Router } from 'express';
import { authenticate, requireBusinessContext, requireRole } from '../middleware/auth.js';
import {
  getAlerts,
  getDashboardAnalytics,
  getMetricsAnalytics,
  getRevenueAnalytics,
} from '../services/analyticsService.js';

const router = Router();

router.use(authenticate, requireBusinessContext, requireRole('owner'));

const periodOf = (req) => (req.query.period === 'month' ? 'month' : 'week');

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
