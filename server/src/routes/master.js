import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { publicBusiness } from '../lib/utils.js';
import { normalizeText } from '../services/clientService.js';

const router = Router();

router.use(authenticate, requireRole('master'));

const first = (v) => (Array.isArray(v) ? v[0] : v);
const opcional = (schema) => z.preprocess((v) => (first(v) === '' ? undefined : first(v)), schema.optional());

const businessQuery = z.object({
  search: opcional(z.string().trim().max(100, 'La búsqueda es demasiado larga (máximo 100 caracteres).')),
});
const usersQuery = z.object({
  role: opcional(z.enum(['master', 'owner', 'employee'], { errorMap: () => ({ message: 'Rol no válido. Usa master, owner o employee.' }) })),
  businessId: opcional(z.string()),
});

/** Lo que ve el master de un negocio: su perfil, su dueño y cuántos empleados tiene (activos e inactivos). Nunca datos de sesión. */
function masterBusiness(business) {
  const owner = business.users.find((u) => u.role === 'owner');
  const employees = business.users.filter((u) => u.role === 'employee');
  return {
    ...publicBusiness(business),
    createdAt: business.createdAt.toISOString(),
    owner: owner ? { name: owner.name, email: owner.email } : null,
    employees: employees.filter((u) => u.isActive).length,
    inactiveEmployees: employees.filter((u) => !u.isActive).length,
  };
}

router.get('/businesses', async (req, res, next) => {
  try {
    const { search } = businessQuery.parse(req.query);
    const [rows, total] = await Promise.all([
      prisma.business.findMany({
        orderBy: { createdAt: 'desc' },
        include: { users: { select: { name: true, email: true, role: true, isActive: true } } },
      }),
      prisma.business.count(),
    ]);

    // La búsqueda se hace aquí y no con `contains` de la base: allí «%» y «_» son comodines y las tildes cuentan.
    // Encuentra por nombre del negocio o por nombre/correo de su dueño, sin distinguir mayúsculas ni tildes.
    const text = search ? normalizeText(search) : '';
    const found = text
      ? rows.filter((b) => {
        const owner = b.users.find((u) => u.role === 'owner');
        return [b.name, owner?.name, owner?.email].some((v) => v && normalizeText(v).includes(text));
      })
      : rows;

    res.json({ businesses: found.map(masterBusiness), total });
  } catch (err) {
    next(err);
  }
});

router.get('/users', async (req, res, next) => {
  try {
    const { role, businessId } = usersQuery.parse(req.query);
    const where = {};
    if (role) where.role = role;
    if (businessId) where.businessId = businessId;

    const [users, total] = await Promise.all([
      prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, include: { business: { select: { name: true } } } }),
      prisma.user.count(),
    ]);

    res.json({
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        businessId: u.businessId,
        businessName: u.business?.name || null,
        active: u.isActive,
        createdAt: u.createdAt.toISOString(),
      })),
      total,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
