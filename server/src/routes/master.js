import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { publicBusiness, publicUser } from '../lib/utils.js';

const router = Router();

router.use(authenticate, requireRole('master'));

router.get('/businesses', async (req, res, next) => {
  try {
    const search = (req.query.search || '').toString().trim();
    const businesses = await prisma.business.findMany({
      where: search
        ? { name: { contains: search, mode: 'insensitive' } }
        : undefined,
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      businesses: businesses.map(publicBusiness),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/users', async (req, res, next) => {
  try {
    const where = {};
    if (req.query.role) where.role = req.query.role.toString();
    if (req.query.businessId) where.businessId = req.query.businessId.toString();

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      users: users.map(publicUser),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
