import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { signToken, verifyToken } from '../lib/jwt.js';
import { DUMMY_HASH, hashPassword, verifyPassword } from '../lib/password.js';
import { authenticate, bearerToken, requireBusinessContext, requireRole } from '../middleware/auth.js';
import { createError } from '../middleware/errorHandler.js';
import { nowInBusinessTz, parseDateOnly, pickStaffColor, publicBusiness, publicUser } from '../lib/utils.js';

const router = Router();

// bcrypt solo usa los primeros 72 BYTES de la clave: si dejáramos pasar más, dos claves distintas
// (que solo difieran después del byte 72) serían equivalentes. Los acentos y la ñ ocupan 2 bytes.
const MAX_PASSWORD_BYTES = 72;

const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .regex(/[A-Za-z]/, 'La contraseña debe incluir al menos una letra.')
  .regex(/\d/, 'La contraseña debe incluir al menos un número.')
  .refine((v) => Buffer.byteLength(v, 'utf8') <= MAX_PASSWORD_BYTES, 'La contraseña es demasiado larga (máximo 72 bytes; las letras con tilde y la ñ cuentan doble).');

// Se recorta antes de validar: "   " no es un nombre y los espacios sobrantes no se guardan.
const nameSchema = z
  .string()
  .trim()
  .min(2, 'El nombre debe tener al menos 2 caracteres.')
  .max(80, 'El nombre es demasiado largo (máximo 80 caracteres).');

const emailSchema = z.string().trim().max(254, 'El correo es demasiado largo.').email('Ingresa un correo válido.');

const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Ingresa tu contraseña.'),
});

// La especialidad (p. ej. "Fade y barba") se recorta y tiene un máximo razonable.
const specialtySchema = z.string().trim().max(60, 'La especialidad es demasiado larga (máximo 60 caracteres).');

const employeeSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  specialty: specialtySchema.optional(),
});

// El dueño edita a un empleado: nombre, especialidad, activarlo/desactivarlo o restablecer su contraseña.
const employeePatchSchema = z.object({
  name: nameSchema.optional(),
  specialty: specialtySchema.optional(),
  active: z.boolean().optional(),
  password: passwordSchema.optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Ingresa tu contraseña actual.'),
  newPassword: passwordSchema,
});

const EMAIL_TAKEN = { ok: false, error: 'Ya existe una cuenta con este correo.' };

// Prisma P2002 = violación de índice único: el correo lo tomó otra petición en paralelo.
const isUniqueViolation = (err) => err?.code === 'P2002';

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
      return res.status(409).json(EMAIL_TAKEN);
    }

    // El hash (bcrypt, muy costoso en CPU) se calcula ANTES de tocar la base de datos: dentro de una
    // transacción, varias altas simultáneas la dejaban abierta tanto tiempo que Prisma fallaba con
    // P2028 ("no se pudo iniciar la transacción a tiempo") y la API respondía 500.
    const passwordHash = await hashPassword(data.password);

    // Una sola escritura anidada: negocio + dueño son atómicos sin necesidad de transacción interactiva.
    const business = await prisma.business.create({
      data: {
        name: `Barbería de ${data.name}`,
        users: { create: { name: data.name, email, passwordHash, role: 'owner' } },
      },
      include: { users: true },
    });
    const user = business.users[0];

    const token = signToken({ sub: user.id, role: user.role, businessId: business.id });
    res.status(201).json(authResponse(user, business, token));
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json(EMAIL_TAKEN);
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

    // Una clave de más de 72 bytes no puede ser válida: bcrypt la truncaría y coincidiría con otra distinta.
    // Se compara igual contra un hash para que el tiempo de respuesta no delate el motivo.
    const tooLong = Buffer.byteLength(data.password, 'utf8') > MAX_PASSWORD_BYTES;
    const passwordOk = (await verifyPassword(tooLong ? '' : data.password, user?.passwordHash || DUMMY_HASH)) && !tooLong;
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

// Cierra ESTA sesión: el token queda revocado hasta que caduque. Siempre responde 200 (es idempotente):
// con un token inválido, caducado o ausente no hay nada que revocar y el cliente borra su copia igual.
router.post('/logout', async (req, res, next) => {
  try {
    const token = bearerToken(req.headers.authorization);
    if (token) {
      let payload = null;
      try { payload = verifyToken(token); } catch { /* token inválido: nada que revocar */ }
      if (payload?.jti && payload.exp) {
        await prisma.revokedToken.upsert({
          where: { jti: payload.jti },
          create: { jti: payload.jti, expiresAt: new Date(payload.exp * 1000) },
          update: {},
        });
        // Limpieza oportunista: un token ya caducado no necesita seguir en la lista.
        await prisma.revokedToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      }
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
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

// Vista de un empleado para el dueño: incluye si está activo, su especialidad y su color en la agenda.
const employeeView = (e) => ({
  ...publicUser(e),
  active: e.isActive,
  specialty: e.staffProfile?.specialty || '',
  color: e.staffProfile?.color || pickStaffColor(0),
});

router.post('/employees', authenticate, requireRole('owner'), requireBusinessContext, async (req, res, next) => {
  try {
    const data = employeeSchema.parse(req.body);
    const email = data.email.toLowerCase();

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return res.status(409).json(EMAIL_TAKEN);
    }

    const passwordHash = await hashPassword(data.password); // fuera de la base de datos: ver /register

    // El orden y el color dependen de cuántos empleados hay: se cuenta y se crea bajo un cerrojo por negocio
    // para que dos altas simultáneas no se lleven el mismo orden ni el mismo color.
    const employee = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${req.businessId}))`;
      const employeeCount = await tx.user.count({ where: { businessId: req.businessId, role: 'employee' } });
      return tx.user.create({
        data: {
          name: data.name,
          email,
          passwordHash,
          role: 'employee',
          businessId: req.businessId,
          staffProfile: {
            create: { specialty: data.specialty || '', color: pickStaffColor(employeeCount), displayOrder: employeeCount },
          },
        },
        include: { staffProfile: true },
      });
      // El trabajo de la transacción es mínimo; lo que se alarga es el arranque cuando varios hashes bcrypt acaparan el
      // proceso. Con el plazo por defecto (2 s) una ráfaga de altas fallaba a veces con P2028.
    }, { maxWait: 15000, timeout: 15000 });

    res.status(201).json({ ok: true, user: employeeView(employee) });
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json(EMAIL_TAKEN);
    next(err);
  }
});

// Lista del equipo en el orden del equipo (displayOrder). Los desactivados solo los ve el dueño, con ?includeInactive=true.
router.get('/employees', authenticate, requireBusinessContext, async (req, res, next) => {
  try {
    const incluirInactivos = req.user.role === 'owner' && req.query.includeInactive === 'true';
    const employees = await prisma.user.findMany({
      where: { businessId: req.businessId, role: 'employee', ...(incluirInactivos ? {} : { isActive: true }) },
      include: { staffProfile: true },
      orderBy: [{ staffProfile: { displayOrder: 'asc' } }, { createdAt: 'asc' }],
    });
    res.json({ employees: employees.map(employeeView) });
  } catch (err) {
    next(err);
  }
});

router.patch('/employees/:id', authenticate, requireRole('owner'), requireBusinessContext, async (req, res, next) => {
  try {
    const data = employeePatchSchema.parse(req.body);

    // Solo empleados del propio negocio: un id ajeno, de un dueño o inexistente da 404 (no se revela cuál).
    const target = await prisma.user.findFirst({
      where: { id: req.params.id, businessId: req.businessId, role: 'employee' },
      include: { staffProfile: true },
    });
    if (!target) throw createError(404, 'Empleado no encontrado.', 'NOT_FOUND');

    const userData = {};
    if (data.name !== undefined) userData.name = data.name;
    if (data.active !== undefined) {
      userData.isActive = data.active;
      // Dar de baja cierra sus sesiones para siempre: reactivarlo NO resucita un token anterior (tendrá que iniciar sesión).
      if (data.active === false && target.isActive) userData.sessionsValidFrom = new Date();
    }
    if (data.password !== undefined) {
      userData.passwordHash = await hashPassword(data.password);
      userData.sessionsValidFrom = new Date(); // cierra las sesiones que el empleado ya tenía abiertas
    }
    if (data.specialty !== undefined) {
      userData.staffProfile = {
        upsert: {
          create: { specialty: data.specialty, color: pickStaffColor(0), displayOrder: 0 },
          update: { specialty: data.specialty },
        },
      };
    }

    const updated = Object.keys(userData).length
      ? await prisma.user.update({ where: { id: target.id }, data: userData, include: { staffProfile: true } })
      : target;

    const body = { ok: true, user: employeeView(updated) };
    if (data.active === false && target.isActive) {
      // Al desactivar se avisa cuántas citas futuras le quedan asignadas, para que el dueño las reasigne.
      body.pendingAppointments = await prisma.appointment.count({
        where: {
          employeeId: target.id,
          status: { in: ['pending', 'confirmed'] },
          appointmentDate: { gte: parseDateOnly(nowInBusinessTz().date) },
        },
      });
    }
    res.json(body);
  } catch (err) {
    next(err);
  }
});

// Cambio de contraseña del propio usuario (cualquier rol). Cierra todas sus demás sesiones y devuelve una nueva.
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const data = changePasswordSchema.parse(req.body);

    // 400 y no 401: un 401 haría creer al cliente que la sesión caducó.
    if (!(await verifyPassword(data.currentPassword, req.user.passwordHash))) {
      throw createError(400, 'La contraseña actual no es correcta.', 'INVALID_CURRENT_PASSWORD');
    }
    if (data.newPassword === data.currentPassword) {
      throw createError(400, 'La nueva contraseña debe ser distinta de la actual.', 'SAME_PASSWORD');
    }

    const passwordHash = await hashPassword(data.newPassword);
    await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash, sessionsValidFrom: new Date() } });

    // La sesión actual también se revoca (evita la ventana de un segundo del `iat`) y se entrega un token nuevo.
    const { jti, exp } = req.tokenPayload;
    if (jti && exp) {
      await prisma.revokedToken.upsert({ where: { jti }, create: { jti, expiresAt: new Date(exp * 1000) }, update: {} });
    }
    const token = signToken({ sub: req.user.id, role: req.user.role, businessId: req.user.businessId });
    res.json({ ok: true, token });
  } catch (err) {
    next(err);
  }
});

export default router;
