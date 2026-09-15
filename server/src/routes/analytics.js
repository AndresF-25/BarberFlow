import { Router } from 'express';
import { authenticate, requireBusinessContext, requireRole } from '../middleware/auth.js';
import {
  getAlerts,
  getDashboardAnalytics,
  getMetricsAnalytics,
  getPaymentMethods,
  getRevenueAnalytics,
  getServicesRevenueComparison,
} from '../services/analyticsService.js';
import { formatDateOnly } from '../lib/utils.js';

const router = Router();

router.use(authenticate, requireBusinessContext, requireRole('owner'));

router.get('/dashboard', async (req, res, next) => {
  try {
    const date = req.query.date?.toString() || formatDateOnly(new Date());
    const data = await getDashboardAnalytics(req.businessId, date);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/revenue', async (req, res, next) => {
  try {
    const period = req.query.period === 'month' ? 'month' : 'week';
    const anchorDate = req.query.anchorDate?.toString();
    const revenue = await getRevenueAnalytics(req.businessId, period, anchorDate);
    const paymentMethods = await getPaymentMethods(req.businessId);
    const servicesComparison = await getServicesRevenueComparison(req.businessId);
    res.json({ ...revenue, paymentMethods, servicesComparison });
  } catch (err) {
    next(err);
  }
});

router.get('/metrics', async (req, res, next) => {
  try {
    const period = req.query.period === 'month' ? 'month' : 'week';
    const anchorDate = req.query.anchorDate?.toString();
    const data = await getMetricsAnalytics(req.businessId, period, anchorDate);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/alerts', async (req, res, next) => {
  try {
    const alerts = await getAlerts(req.businessId);
    res.json({ alerts });
  } catch (err) {
    next(err);
  }
});

export default router;
