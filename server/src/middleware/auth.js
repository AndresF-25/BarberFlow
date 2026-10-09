import { verifyToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { createError } from './errorHandler.js';

// El esquema ("Bearer") no distingue mayúsculas (RFC 7235).
export function bearerToken(header) {
  const m = /^Bearer\s+(\S+)\s*$/i.exec(header || '');
  return m ? m[1] : null;
}

export async function authenticate(req, _res, next) {
  try {
    const token = bearerToken(req.headers.authorization);
    if (!token) {
      throw createError(401, 'No autenticado.', 'UNAUTHORIZED');
    }

    const payload = verifyToken(token);

    const [user, revoked] = await Promise.all([
      prisma.user.findUnique({
        where: { id: payload.sub },
        include: { business: true, staffProfile: true },
      }),
      // Sesión cerrada con "Cerrar sesión": el token no sirve aunque aún no haya caducado.
      payload.jti ? prisma.revokedToken.findUnique({ where: { jti: payload.jti } }) : null,
    ]);

    if (!user || !user.isActive || revoked) {
      throw createError(401, 'Sesión inválida.', 'UNAUTHORIZED');
    }
    // Cambiar o restablecer la contraseña cierra las sesiones anteriores (iat en segundos: se compara por segundo).
    if (user.sessionsValidFrom && payload.iat < Math.floor(user.sessionsValidFrom.getTime() / 1000)) {
      throw createError(401, 'Sesión inválida.', 'UNAUTHORIZED');
    }

    req.user = user;
    req.businessId = user.businessId;
    req.tokenPayload = payload;
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
      return next(createError(403, 'No tienes permiso para esta acción.', 'FORBIDDEN'));
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
