import { verifyToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { createError } from './errorHandler.js';

export async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw createError(401, 'No autenticado.', 'UNAUTHORIZED');
    }

    const token = header.slice(7);
    const payload = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { business: true, staffProfile: true },
    });

    if (!user || !user.isActive) {
      throw createError(401, 'Sesión inválida.', 'UNAUTHORIZED');
    }

    req.user = user;
    req.businessId = user.businessId;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return next(createError(401, 'Token inválido o expirado.', 'UNAUTHORIZED'));
    }
    next(err);
  }
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(createError(403, 'No tenés permiso para esta acción.', 'FORBIDDEN'));
    }
    next();
  };
}

export function requireBusinessContext(req, _res, next) {
  if (!req.businessId) {
    return next(createError(403, 'Operación requiere un negocio asociado.', 'NO_BUSINESS'));
  }
  next();
}
