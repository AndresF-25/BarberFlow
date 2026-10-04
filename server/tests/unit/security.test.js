import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertJwtSecret, signToken, verifyToken } from '../../src/lib/jwt.js';
import { DUMMY_HASH, hashPassword, verifyPassword } from '../../src/lib/password.js';
import { createError, errorHandler } from '../../src/middleware/errorHandler.js';

const original = { secret: process.env.JWT_SECRET, env: process.env.NODE_ENV };
afterEach(() => {
  process.env.JWT_SECRET = original.secret;
  process.env.NODE_ENV = original.env;
  vi.restoreAllMocks();
});

describe('JWT_SECRET', () => {
  it.each([undefined, '', 'corto'])('se rechaza cuando es %j', (valor) => {
    if (valor === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = valor;
    expect(() => assertJwtSecret()).toThrow(/JWT_SECRET/);
  });

  it('en producción rechaza el valor de ejemplo', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'change-this-to-a-long-random-secret-in-production';
    expect(() => assertJwtSecret()).toThrow(/valor de ejemplo/);
  });

  it('fuera de producción solo avisa con el valor de ejemplo', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.NODE_ENV = 'development';
    process.env.JWT_SECRET = 'change-this-to-a-long-random-secret-in-production';
    expect(() => assertJwtSecret()).not.toThrow();
  });

  it('firma y verifica un token, y rechaza uno manipulado', () => {
    const token = signToken({ sub: 'u1', role: 'owner' });
    expect(verifyToken(token)).toMatchObject({ sub: 'u1', role: 'owner' });
    expect(() => verifyToken(token.slice(0, -2) + 'xx')).toThrow();
  });

  it('un token firmado con otro secreto no es válido', () => {
    const token = signToken({ sub: 'u1' });
    process.env.JWT_SECRET = 'otro-secreto-completamente-distinto-123';
    expect(() => verifyToken(token)).toThrow();
  });
});

describe('contraseñas', () => {
  it('hashea y verifica; el hash no contiene la contraseña', async () => {
    const hash = await hashPassword('Clave1234');
    expect(hash).not.toContain('Clave1234');
    expect(await verifyPassword('Clave1234', hash)).toBe(true);
    expect(await verifyPassword('clave1234', hash)).toBe(false);
  });

  it('DUMMY_HASH es un hash bcrypt válido (para igualar tiempos en el login)', async () => {
    expect(DUMMY_HASH).toHaveLength(60);
    expect(await verifyPassword('cualquiera', DUMMY_HASH)).toBe(false);
  });
});

describe('errorHandler', () => {
  const res = () => {
    const r = { status: vi.fn(() => r), json: vi.fn(() => r) };
    return r;
  };

  it('errores de zod -> 400', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = res();
    errorHandler({ name: 'ZodError', errors: [{ message: 'Fecha inválida.' }] }, {}, r, () => {});
    expect(r.status).toHaveBeenCalledWith(400);
    expect(r.json).toHaveBeenCalledWith({ error: 'Fecha inválida.', code: 'VALIDATION_ERROR' });
  });

  it('errores con status conservan su código', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = res();
    errorHandler(createError(409, 'Duplicado', 'CONFLICT'), {}, r, () => {});
    expect(r.status).toHaveBeenCalledWith(409);
    expect(r.json).toHaveBeenCalledWith({ error: 'Duplicado', code: 'CONFLICT' });
  });

  it('errores desconocidos -> 500 sin filtrar detalles internos', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = res();
    errorHandler(new Error('detalle interno de la base de datos'), {}, r, () => {});
    expect(r.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(r.json.mock.calls)).not.toContain('detalle interno');
  });
});
