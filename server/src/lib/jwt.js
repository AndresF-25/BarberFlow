import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const PLACEHOLDER_SECRET = /^(dev-secret|change-this|change-me)/i;

let warnedPlaceholder = false;

export function assertJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('JWT_SECRET no está definido o es muy corto (mínimo 16 caracteres). Configúralo en server/.env.');
  }

  // El valor de ejemplo de .env.example es público: en producción se rechaza; en desarrollo solo se avisa.
  if (PLACEHOLDER_SECRET.test(secret)) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET es el valor de ejemplo. Genera uno propio (ver README) antes de desplegar.');
    }
    if (!warnedPlaceholder) {
      warnedPlaceholder = true;
      console.warn('[seguridad] JWT_SECRET es el valor de ejemplo. Cámbialo por uno propio (ver README); en producción el servidor no arrancará con él.');
    }
  }
  return secret;
}

// Cada token lleva un id único (jti): es lo que permite cerrar UNA sesión sin afectar a las demás del mismo usuario.
export function signToken(payload) {
  return jwt.sign(payload, assertJwtSecret(), { expiresIn: JWT_EXPIRES_IN, jwtid: randomUUID() });
}

export function verifyToken(token) {
  return jwt.verify(token, assertJwtSecret());
}
