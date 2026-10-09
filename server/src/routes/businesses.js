import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireBusinessContext, requireRole } from '../middleware/auth.js';
import { publicBusiness } from '../lib/utils.js';

const router = Router();

const MAX_LOGO_URL = 2048;

// Solo http(s): "javascript:" y "data:" serían un vector de XSS al mostrar el logo en <img src> o <a href>.
const isHttpUrl = (value) => {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};

const logoSchema = z
  .string()
  .trim()
  .max(MAX_LOGO_URL, `La dirección del logo es demasiado larga (máximo ${MAX_LOGO_URL} caracteres).`)
  .refine((v) => v === '' || isHttpUrl(v), 'El logo debe ser una dirección web válida (http o https).')
  .transform((v) => (v === '' ? null : v))
  .nullable();

const patchSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'El nombre del negocio es obligatorio.')
    .max(80, 'El nombre del negocio es demasiado largo (máximo 80 caracteres).')
    .optional(),
  logoUrl: logoSchema.optional(),
  // `logo` es el nombre con que GET devuelve el campo; se acepta también al escribir.
  logo: logoSchema.optional(),
  description: z.string().trim().max(500, 'La descripción es demasiado larga (máximo 500 caracteres).').optional(),
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || /^[0-9+()\-\s]{7,20}$/.test(v), 'El teléfono solo puede tener números, espacios, +, - y paréntesis (7 a 20 caracteres).')
    .optional(),
  address: z.string().trim().max(200, 'La dirección es demasiado larga (máximo 200 caracteres).').optional(),
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
        logoUrl: data.logoUrl !== undefined ? data.logoUrl : data.logo,
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
