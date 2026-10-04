import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../lib/jwt.js';
import { DUMMY_HASH, hashPassword, verifyPassword } from '../lib/password.js';
import { authenticate, requireBusinessContext, requireRole } from '../middleware/auth.js';
import { pickStaffColor, publicBusiness, publicUser } from '../lib/utils.js';

const router = Router();

const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(72, 'La contraseña es demasiado larga.')
  .regex(/[A-Za-z]/, 'La contraseña debe incluir al menos una letra.')
  .regex(/\d/, 'La contraseña debe incluir al menos un número.');

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: passwordSchema,
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const employeeSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: passwordSchema,
  specialty: z.string().optional(),
});

function authResponse(user, business, token) {
  return {
    ok: true,
    token,
    user: publicUser(user),
    business: publicBusiness(business),
  };
}

router.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const email = data.email.toLowerCase();

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return res.status(409).json({ ok: false, error: 'Ya existe una cuenta con este correo.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          name: `Barbería de ${data.name}`,
        },
      });

      const user = await tx.user.create({
        data: {
          name: data.name,
          email,
          passwordHash: await hashPassword(data.password),
          role: 'owner',
          businessId: business.id,
        },
      });

      return { user, business };
    });

    const token = signToken({ sub: result.user.id, role: result.user.role, businessId: result.business.id });
    res.status(201).json(authResponse(result.user, result.business, token));
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const email = data.email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email },
      include: { business: true },
    });

    const passwordOk = await verifyPassword(data.password, user?.passwordHash || DUMMY_HASH);
    if (!user || !passwordOk) {
      return res.status(401).json({ ok: false, error: 'Correo o contraseña incorrectos.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ ok: false, error: 'Cuenta desactivada.' });
    }

    const token = signToken({ sub: user.id, role: user.role, businessId: user.businessId });
    res.json({
      ok: true,
      token,
      user: publicUser(user),
      business: publicBusiness(user.business),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (_req, res) => {
  res.json({ ok: true });
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const business = req.user.businessId
      ? await prisma.business.findUnique({ where: { id: req.user.businessId } })
      : null;

    res.json({
      user: publicUser(req.user),
      business: publicBusiness(business),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/employees', authenticate, requireRole('owner'), requireBusinessContext, async (req, res, next) => {
  try {
    const data = employeeSchema.parse(req.body);
    const email = data.email.toLowerCase();

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return res.status(409).json({ ok: false, error: 'Ya existe una cuenta con este correo.' });
    }

    const employeeCount = await prisma.user.count({
      where: { businessId: req.businessId, role: 'employee' },
    });

    const employee = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: data.name,
          email,
          passwordHash: await hashPassword(data.password),
          role: 'employee',
          businessId: req.businessId,
        },
      });

      await tx.staffProfile.create({
        data: {
          userId: user.id,
          specialty: data.specialty || '',
          color: pickStaffColor(employeeCount),
          displayOrder: employeeCount,
        },
      });

      return user;
    });

    res.status(201).json({ ok: true, user: publicUser(employee) });
  } catch (err) {
    next(err);
  }
});

router.get('/employees', authenticate, requireBusinessContext, async (req, res, next) => {
  try {
    const where = {
      businessId: req.businessId,
      role: 'employee',
      isActive: true,
    };

    const employees = await prisma.user.findMany({
      where,
      include: { staffProfile: true },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      employees: employees.map((e) => ({
        ...publicUser(e),
        specialty: e.staffProfile?.specialty || '',
        color: e.staffProfile?.color || '#C79A5B',
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
