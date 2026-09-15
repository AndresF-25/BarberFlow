import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireBusinessContext, requireRole } from '../middleware/auth.js';
import { publicBusiness } from '../lib/utils.js';

const router = Router();

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  logoUrl: z.string().nullable().optional(),
  description: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

router.get('/me', authenticate, requireBusinessContext, async (req, res, next) => {
  try {
    const business = await prisma.business.findUnique({ where: { id: req.businessId } });
    res.json({ business: publicBusiness(business) });
  } catch (err) {
    next(err);
  }
});

router.patch('/me', authenticate, requireRole('owner'), requireBusinessContext, async (req, res, next) => {
  try {
    const data = patchSchema.parse(req.body);
    const business = await prisma.business.update({
      where: { id: req.businessId },
      data: {
        name: data.name,
        logoUrl: data.logoUrl,
        description: data.description,
        phone: data.phone,
        address: data.address,
      },
    });
    res.json({ business: publicBusiness(business) });
  } catch (err) {
    next(err);
  }
});

export default router;
