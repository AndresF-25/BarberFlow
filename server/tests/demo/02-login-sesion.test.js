/**
 * Módulo 2 — Login y sesión (POST /auth/login, POST /auth/logout, GET /auth/me, middleware
 * `authenticate`, límite de peticiones, CORS y cabeceras de seguridad).
 *
 * Lee las cuentas demo (solo lectura). Lo que crea o modifica usa negocios @test.local.
 * H8–H12 ya están corregidos (ver MEMORY.md): sus pruebas son normales y vigilan que no vuelvan.
 * Los hallazgos sin corregir se marcan con `it.fails('HALLAZGO …')` (ver 01-registro.test.js).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import {
  api, auth, prisma, PASSWORD, uniqueEmail, registerOwner, createEmployee,
  requireSeed, loginDemo, demoSessions, biz, dataset, DEMO_PASSWORD,
} from './helpers-demo.js';
import { signToken, verifyToken } from '../../src/lib/jwt.js';

const login = (body) => api().post('/api/v1/auth/login').send(body);
const secret = () => process.env.JWT_SECRET;

/** App nueva con límites propios (createApp lee el entorno al crearse; la compartida ya está creada). */
async function appCon(env) {
  const previo = {};
  for (const k of Object.keys(env)) { previo[k] = process.env[k]; process.env[k] = String(env[k]); }
  const { createApp } = await import('../../src/app.js');
  const app = createApp();
  for (const k of Object.keys(env)) { if (previo[k] === undefined) delete process.env[k]; else process.env[k] = previo[k]; }
  return request(app);
}

describe('Módulo 2 · login y sesión', () => {
  let s;
  beforeAll(async () => { await requireSeed(); s = await demoSessions(); });

  describe('login correcto en cada rol', () => {
    it('dueño: devuelve { ok, token, user, business } con rol owner y su negocio', async () => {
      const r = await loginDemo(biz('navaja').owner.email);
      expect(r.status).toBe(200);
      expect(Object.keys(r.body).sort()).toEqual(['business', 'ok', 'token', 'user']);
      expect(r.body.user).toMatchObject({ role: 'owner', email: biz('navaja').owner.email, name: 'Andrés Morales' });
      expect(r.body.business.name).toBe('Barbería La Navaja');
      expect(r.body.user.businessId).toBe(r.body.business.id);
    });

    it('barbero: rol employee y el negocio de su dueño', async () => {
      const r = await loginDemo(biz('navaja').staff.find((x) => x.key === 'julian').email);
      expect(r.body.user.role).toBe('employee');
      expect(r.body.business.name).toBe('Barbería La Navaja');
    });

    it('master: sin negocio (business = null y businessId = null)', async () => {
      const r = await loginDemo(dataset.master.email);
      expect(r.status).toBe(200);
      expect(r.body.user.role).toBe('master');
      expect(r.body.user.businessId).toBeNull();
      expect(r.body.business).toBeNull();
    });

    it('nunca expone el hash, ni isActive, en ninguna respuesta de login', async () => {
      const r = await loginDemo(biz('navaja').owner.email);
      expect(JSON.stringify(r.body)).not.toMatch(/passwordHash|password_hash|\$2[aby]\$|isActive/);
    });

    it('el token lleva sub, role y businessId del usuario y caduca en el futuro (máx. 8 días)', async () => {
      const r = await loginDemo(biz('navaja').owner.email);
      const p = verifyToken(r.token);
      expect(p).toMatchObject({ sub: r.body.user.id, role: 'owner', businessId: r.body.user.businessId });
      expect(p.exp * 1000).toBeGreaterThan(Date.now());
      expect(p.exp - p.iat).toBeLessThanOrEqual(8 * 24 * 3600);
    });

    it('el correo no distingue mayúsculas ni espacios alrededor', async () => {
      const email = biz('navaja').owner.email;
      expect((await login({ email: email.toUpperCase(), password: DEMO_PASSWORD })).status).toBe(200);
      expect((await login({ email: `  ${email}  `, password: DEMO_PASSWORD })).status).toBe(200);
    });

    it('cada inicio de sesión emite un token distinto (no se reutiliza)', async () => {
      await new Promise((r) => setTimeout(r, 1100)); // iat tiene resolución de 1 s
      const a = await loginDemo(biz('navaja').owner.email);
      expect(a.token).not.toBe(s.navaja.owner);
    });
  });

  describe('login rechazado', () => {
    it('contraseña incorrecta → 401 con mensaje genérico', async () => {
      const r = await login({ email: biz('navaja').owner.email, password: 'Incorrecta1' });
      expect(r.status).toBe(401);
      expect(r.body).toEqual({ ok: false, error: 'Correo o contraseña incorrectos.' });
    });

    it('usuario inexistente → exactamente la misma respuesta (no se puede averiguar qué correos existen)', async () => {
      const mala = await login({ email: biz('navaja').owner.email, password: 'Incorrecta1' });
      const nadie = await login({ email: 'nadie.existe@demo.barberflow.com', password: 'Incorrecta1' });
      expect(nadie.status).toBe(mala.status);
      expect(nadie.body).toEqual(mala.body);
    });

    it('usuario inexistente tarda como uno real (se compara contra un hash falso): no responde al instante', async () => {
      const t0 = Date.now();
      await login({ email: uniqueEmail('fantasma'), password: 'Incorrecta1' });
      expect(Date.now() - t0).toBeGreaterThan(100);
    });

    it('cuenta desactivada con la clave CORRECTA → 403; con clave incorrecta → 401 (no revela que existe)', async () => {
      const sebas = biz('navaja').staff.find((x) => x.key === 'sebas').email;
      expect((await login({ email: sebas, password: DEMO_PASSWORD })).status).toBe(403);
      const mala = await login({ email: sebas, password: 'Incorrecta1' });
      expect(mala.status).toBe(401);
      expect(mala.body.error).toBe('Correo o contraseña incorrectos.');
    });

    it.each([
      { caso: 'sin cuerpo', body: {} },
      { caso: 'sin correo', body: { password: 'Clave1234' } },
      { caso: 'sin contraseña', body: { email: 'a@test.local' } },
      { caso: 'correo inválido', body: { email: 'no-es-correo', password: 'Clave1234' } },
      { caso: 'contraseña vacía', body: { email: 'a@test.local', password: '' } },
      { caso: 'correo que no es texto', body: { email: 123, password: 'Clave1234' } },
      { caso: 'contraseña que no es texto', body: { email: 'a@test.local', password: 12345678 } },
    ])('$caso → 400 con VALIDATION_ERROR', async ({ body }) => {
      const r = await login(body);
      expect(r.status).toBe(400);
      expect(r.body.code).toBe('VALIDATION_ERROR');
    });

    it('una clave de más de 72 bytes nunca es válida, aunque coincida con los primeros 72 de otra', async () => {
      const base = `A1${'ñ'.repeat(35)}`; // 72 bytes exactos
      const { email } = await registerOwner('largo').then(() => ({ email: uniqueEmail('l72') }));
      expect((await api().post('/api/v1/auth/register').send({ name: 'Largo Prueba', email, password: base })).status).toBe(201);
      expect((await login({ email, password: base })).status).toBe(200);
      expect((await login({ email, password: `${base}xyz` })).status).toBe(401);
    });

    it('un intento fallido no cambia nada: la clave buena sigue funcionando después', async () => {
      const email = biz('navaja').owner.email;
      for (let i = 0; i < 3; i++) await login({ email, password: `Mala${i}Clave1` });
      expect((await login({ email, password: DEMO_PASSWORD })).status).toBe(200);
    });

    it('H12 corregido: los mensajes de validación del login están en español', async () => {
      const a = await login({ email: 'no-es-correo', password: 'x' });
      const b = await login({ email: 'a@test.local', password: '' });
      expect(a.body.error).toMatch(/correo|e-mail|email/i);
      expect(a.body.error).not.toMatch(/Invalid/);
      expect(b.body.error).not.toMatch(/String must|character/i);
    });
  });

  describe('token y middleware authenticate', () => {
    const me = (header) => api().get('/api/v1/auth/me').set('Authorization', header);

    it.each([
      { caso: 'sin cabecera', header: undefined },
      { caso: 'cabecera vacía', header: '' },
      { caso: '"Bearer" sin token', header: 'Bearer ' },
      { caso: 'esquema Basic', header: 'Basic dXNlcjpwYXNz' },
      { caso: 'token basura', header: 'Bearer esto.no.esunjwt' },
      { caso: 'token con una letra cambiada', header: undefined },
    ])('$caso → 401 UNAUTHORIZED', async ({ caso, header }) => {
      const h = caso.startsWith('token con una letra') ? `Bearer ${s.navaja.owner.slice(0, -2)}xx` : header;
      const r = h === undefined ? await api().get('/api/v1/auth/me') : await me(h);
      expect(r.status).toBe(401);
      expect(r.body.code).toBe('UNAUTHORIZED');
    });

    it('token firmado con OTRO secreto → 401', async () => {
      const malo = jwt.sign({ sub: 'x', role: 'owner' }, 'otro-secreto-distinto-123456', { expiresIn: '1h' });
      expect((await me(`Bearer ${malo}`)).status).toBe(401);
    });

    it('token caducado → 401', async () => {
      const owner = await prisma.user.findUnique({ where: { email: biz('navaja').owner.email } });
      const viejo = jwt.sign({ sub: owner.id, role: 'owner' }, secret(), { expiresIn: -10 });
      const r = await me(`Bearer ${viejo}`);
      expect(r.status).toBe(401);
      expect(r.body.error).toMatch(/expirado|inválido/i);
    });

    it('token con algoritmo "none" (sin firma) → 401', async () => {
      const owner = await prisma.user.findUnique({ where: { email: biz('navaja').owner.email } });
      const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
      const falso = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: owner.id, role: 'owner', exp: 9999999999 })}.`;
      expect((await me(`Bearer ${falso}`)).status).toBe(401);
    });

    it('payload manipulado (rol cambiado a master) con la firma original → 401', async () => {
      const [h, , sig] = s.navaja.owner.split('.');
      const owner = await prisma.user.findUnique({ where: { email: biz('navaja').owner.email } });
      const payload = Buffer.from(JSON.stringify({ sub: owner.id, role: 'master', businessId: null, exp: 9999999999 })).toString('base64url');
      expect((await me(`Bearer ${h}.${payload}.${sig}`)).status).toBe(401);
    });

    it('token válido de un usuario que ya no existe → 401', async () => {
      const fantasma = signToken({ sub: '00000000-0000-4000-8000-000000000000', role: 'owner', businessId: null });
      const r = await me(`Bearer ${fantasma}`);
      expect(r.status).toBe(401);
      expect(r.body.error).toBe('Sesión inválida.');
    });

    it('el rol sale de la BASE DE DATOS, no del token: un owner con un token que dice "master" no entra al panel master', async () => {
      const owner = await prisma.user.findUnique({ where: { email: biz('navaja').owner.email } });
      const mentiroso = signToken({ sub: owner.id, role: 'master', businessId: null });
      expect((await api().get('/api/v1/master/users').set(auth(mentiroso))).status).toBe(403);
    });

    it('cuando se desactiva a un usuario, su token deja de servir de inmediato', async () => {
      const { token, email } = await registerOwner('desact');
      expect((await api().get('/api/v1/auth/me').set(auth(token))).status).toBe(200);
      await prisma.user.update({ where: { email }, data: { isActive: false } });
      expect((await api().get('/api/v1/auth/me').set(auth(token))).status).toBe(401);
    });

    it('cuando se cambia el rol en la BD, el nuevo rol rige sin volver a iniciar sesión', async () => {
      const dueno = await registerOwner('degradar');
      const emp = await createEmployee(dueno.token, 'Barbero Rol');
      expect((await api().post('/api/v1/auth/employees').set(auth(emp.token)).send({ name: 'Otro Barbero', email: uniqueEmail('x'), password: PASSWORD })).status).toBe(403);
    });

    it('H9 corregido: el esquema de autorización no distingue mayúsculas ("bearer" y "BEARER" son válidos según RFC 7235)', async () => {
      for (const esquema of ['bearer', 'BEARER']) {
        expect((await me(`${esquema} ${s.navaja.owner}`)).status, esquema).toBe(200);
      }
    });
  });

  describe('logout', () => {
    const me = (t) => api().get('/api/v1/auth/me').set(auth(t));
    const entrar = async (email, password = DEMO_PASSWORD) => (await login({ email, password })).body.token;

    it('responde 200 { ok: true } con o sin token, incluso con un token basura (es idempotente)', async () => {
      expect((await api().post('/api/v1/auth/logout')).body).toEqual({ ok: true });
      expect((await api().post('/api/v1/auth/logout').set('Authorization', 'Bearer basura.basura.basura')).body).toEqual({ ok: true });
    });

    it('H8 corregido: tras cerrar sesión, ese token deja de servir en /me y en el resto de la API', async () => {
      const { token } = await registerOwner('logout');
      expect((await me(token)).status).toBe(200);
      expect((await api().post('/api/v1/auth/logout').set(auth(token))).body).toEqual({ ok: true });
      const r = await me(token);
      expect(r.status).toBe(401);
      expect(r.body.error).toBe('Sesión inválida.');
      expect((await api().get('/api/v1/services').set(auth(token))).status).toBe(401);
    });

    it('cierra SOLO esa sesión: otra sesión abierta del mismo usuario (otro dispositivo) sigue activa', async () => {
      const { email } = await registerOwner('dispositivos');
      const celular = await entrar(email, PASSWORD);
      await new Promise((r) => setTimeout(r, 1100));
      const tablet = await entrar(email, PASSWORD);
      expect(celular).not.toBe(tablet);
      await api().post('/api/v1/auth/logout').set(auth(celular));
      expect((await me(celular)).status).toBe(401);
      expect((await me(tablet)).status).toBe(200);
    });

    it('cerrar sesión dos veces con el mismo token no da error y no duplica la fila', async () => {
      const { token } = await registerOwner('doble');
      await api().post('/api/v1/auth/logout').set(auth(token));
      const otra = await api().post('/api/v1/auth/logout').set(auth(token));
      expect(otra.status).toBe(200);
      expect(await prisma.revokedToken.count({ where: { jti: verifyToken(token).jti } })).toBe(1);
    });

    it('guarda el jti del token con su misma fecha de caducidad', async () => {
      const { token } = await registerOwner('caduca');
      const p = verifyToken(token);
      await api().post('/api/v1/auth/logout').set(auth(token));
      const fila = await prisma.revokedToken.findUnique({ where: { jti: p.jti } });
      expect(fila.expiresAt.getTime()).toBe(p.exp * 1000);
    });

    it('limpia los tokens revocados que ya caducaron', async () => {
      const viejo = `caducado-${Date.now()}`;
      await prisma.revokedToken.create({ data: { jti: viejo, expiresAt: new Date(Date.now() - 60000) } });
      const { token } = await registerOwner('limpieza');
      await api().post('/api/v1/auth/logout').set(auth(token)); // cualquier logout dispara la limpieza
      expect(await prisma.revokedToken.findUnique({ where: { jti: viejo } })).toBeNull();
    });

    it('cada token nuevo lleva un jti distinto', async () => {
      const a = verifyToken(await entrar(biz('navaja').owner.email));
      const b = verifyToken(await entrar(biz('navaja').owner.email));
      expect(a.jti).toBeTruthy();
      expect(a.jti).not.toBe(b.jti);
    });

    it('un token antiguo sin jti sigue valiendo hasta caducar y cerrar sesión con él no falla (limitación conocida)', async () => {
      const owner = await prisma.user.findUnique({ where: { email: biz('navaja').owner.email } });
      const viejo = jwt.sign({ sub: owner.id, role: 'owner', businessId: owner.businessId }, secret(), { expiresIn: '1h' });
      expect((await api().post('/api/v1/auth/logout').set(auth(viejo))).status).toBe(200);
      expect((await me(viejo)).status).toBe(200);
    });
  });

  describe('/me', () => {
    const me = (t) => api().get('/api/v1/auth/me').set(auth(t));

    it('dueño y barbero ven el mismo negocio; el master ninguno', async () => {
      const [o, j, m] = await Promise.all([me(s.navaja.owner), me(s.navaja.julian), me(s.master)]);
      expect(o.body.business.id).toBe(j.body.business.id);
      expect(m.body.business).toBeNull();
    });

    it('devuelve exactamente { user, business } sin datos sensibles', async () => {
      const r = await me(s.navaja.owner);
      expect(Object.keys(r.body).sort()).toEqual(['business', 'user']);
      expect(JSON.stringify(r.body)).not.toMatch(/passwordHash|password_hash|isActive/);
    });

    it('cada sesión ve su propio negocio, nunca el de otro', async () => {
      expect((await me(s.fade.owner)).body.business.name).toBe('Barbería El Fade');
      expect((await me(s.nueva.owner)).body.business.name).toBe('Barbería Nueva');
    });
  });

  describe('salud del servicio', () => {
    it('/health y /api/v1/health responden 200 sin autenticación', async () => {
      const a = await api().get('/health');
      const b = await api().get('/api/v1/health');
      expect(a.status).toBe(200);
      expect(a.body).toEqual({ status: 'ok', service: 'barberflow-api' });
      expect(b.status).toBe(200);
      expect(b.body).toMatchObject({ status: 'ok', version: '1' });
    });
  });

  describe('límite de peticiones (429)', () => {
    it('/auth/login: pasado el máximo responde 429 con las cabeceras RateLimit-*', async () => {
      const app = await appCon({ AUTH_RATE_LIMIT_MAX: 3 });
      const intento = () => app.post('/api/v1/auth/login').send({ email: 'a@test.local', password: 'Clave1234' });
      expect((await intento()).status).toBe(401);
      expect((await intento()).status).toBe(401);
      expect((await intento()).status).toBe(401);
      const r = await intento();
      expect(r.status).toBe(429);
      expect(r.headers['ratelimit-limit']).toBe('3');
      expect(r.headers['ratelimit-remaining']).toBe('0');
      expect(Number(r.headers['retry-after'])).toBeGreaterThan(0);
    });

    it('el contador es por aplicación y los intentos buenos también cuentan (el límite protege contra fuerza bruta)', async () => {
      const app = await appCon({ AUTH_RATE_LIMIT_MAX: 2 });
      const ok = () => app.post('/api/v1/auth/login').send({ email: biz('navaja').owner.email, password: DEMO_PASSWORD });
      expect((await ok()).status).toBe(200);
      expect((await ok()).status).toBe(200);
      expect((await ok()).status).toBe(429);
    });

    it('el límite de /auth cubre solo login y registro: /me, /logout y /employees NO lo gastan (se llaman en cada carga de página)', async () => {
      const app = await appCon({ AUTH_RATE_LIMIT_MAX: 2 });
      for (let i = 0; i < 6; i++) expect((await app.get('/api/v1/auth/me').set(auth(s.navaja.owner))).status).toBe(200);
      expect((await app.get('/api/v1/auth/employees').set(auth(s.navaja.owner))).status).toBe(200);
      expect((await app.post('/api/v1/auth/logout')).status).toBe(200);
    });

    it('login y registro comparten el mismo contador (no se puede evadir cambiando de ruta)', async () => {
      const app = await appCon({ AUTH_RATE_LIMIT_MAX: 2 });
      expect((await app.post('/api/v1/auth/login').send({ email: 'a@test.local', password: 'x' })).status).toBe(401);
      expect((await app.post('/api/v1/auth/register').send({ name: 'Solo Limite', email: uniqueEmail('lim'), password: PASSWORD })).status).toBe(201);
      expect((await app.post('/api/v1/auth/register').send({ name: 'Solo Limite', email: uniqueEmail('lim'), password: PASSWORD })).status).toBe(429);
    });

    it('el límite de /auth NO afecta al resto de la API ni a /health', async () => {
      const app = await appCon({ AUTH_RATE_LIMIT_MAX: 1 });
      await app.post('/api/v1/auth/login').send({ email: 'a@test.local', password: 'x' });
      await app.post('/api/v1/auth/login').send({ email: 'a@test.local', password: 'x' });
      expect((await app.get('/health')).status).toBe(200);
      expect((await app.get('/api/v1/services').set(auth(s.navaja.owner))).status).toBe(200);
    });

    it('límite global: pasado el máximo, toda la API responde 429', async () => {
      const app = await appCon({ RATE_LIMIT_MAX: 3 });
      for (let i = 0; i < 3; i++) expect((await app.get('/api/v1/services')).status).toBe(401);
      expect((await app.get('/api/v1/services')).status).toBe(429);
    });

    it('H10 corregido: el 429 es JSON { error, code, retryAfter } en español y conserva las cabeceras', async () => {
      const app = await appCon({ AUTH_RATE_LIMIT_MAX: 1 });
      await app.post('/api/v1/auth/login').send({ email: 'a@test.local', password: 'x' });
      const r = await app.post('/api/v1/auth/login').send({ email: 'a@test.local', password: 'x' });
      expect(r.status).toBe(429);
      expect(r.headers['content-type']).toMatch(/json/);
      expect(r.body).toMatchObject({ code: 'RATE_LIMITED' });
      expect(r.body.error).toMatch(/Demasiados intentos de acceso\. Vuelve a intentarlo en \d+ minutos?\./);
      expect(r.body.retryAfter).toBeGreaterThan(0);
      expect(r.headers['retry-after']).toBeTruthy();
    });

    it('el 429 global también es JSON en español', async () => {
      const app = await appCon({ RATE_LIMIT_MAX: 1 });
      await app.get('/api/v1/services');
      const r = await app.get('/api/v1/services');
      expect(r.status).toBe(429);
      expect(r.body).toMatchObject({ code: 'RATE_LIMITED' });
      expect(r.body.error).toMatch(/Has hecho demasiadas solicitudes/);
    });
  });

  describe('CORS y cabeceras de seguridad', () => {
    it('solo el origen configurado recibe permiso; ningún otro origen ni "*"', async () => {
      const app = await appCon({ CORS_ORIGIN: 'http://app.test' });
      const bueno = await app.get('/health').set('Origin', 'http://app.test');
      expect(bueno.headers['access-control-allow-origin']).toBe('http://app.test');
      expect(bueno.headers['access-control-allow-credentials']).toBe('true');
      const malo = await app.get('/health').set('Origin', 'http://evil.test');
      expect(malo.headers['access-control-allow-origin']).not.toBe('http://evil.test');
      expect(malo.headers['access-control-allow-origin']).not.toBe('*');
    });

    it('la petición previa (OPTIONS) de un POST al login se responde con 204 y los métodos permitidos', async () => {
      const app = await appCon({ CORS_ORIGIN: 'http://app.test' });
      const r = await app.options('/api/v1/auth/login')
        .set('Origin', 'http://app.test').set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'content-type,authorization');
      expect(r.status).toBe(204);
      expect(r.headers['access-control-allow-methods']).toMatch(/POST/);
    });

    it('helmet: no anuncia Express y activa las cabeceras de protección', async () => {
      const r = await api().get('/health');
      expect(r.headers['x-powered-by']).toBeUndefined();
      expect(r.headers['x-content-type-options']).toBe('nosniff');
      expect(r.headers['content-security-policy']).toBeTruthy();
      expect(r.headers['strict-transport-security']).toBeTruthy();
    });
  });

  describe('mensajes de validación en español (toda la API)', () => {
    const sinIngles = /Required|Expected|Invalid|must contain|Number must|String must|received|character/i;

    it.each([
      { caso: 'login sin correo ni clave', llamar: () => login({}) },
      { caso: 'login con correo inválido', llamar: () => login({ email: 'no-es-correo', password: 'x' }) },
      { caso: 'login con clave vacía', llamar: () => login({ email: 'a@test.local', password: '' }) },
      { caso: 'login con tipos incorrectos', llamar: () => login({ email: 123, password: 456 }) },
      { caso: 'registro con cuerpo vacío', llamar: () => api().post('/api/v1/auth/register').send({}) },
      { caso: 'servicio sin datos', llamar: () => api().post('/api/v1/services').set(auth(s.navaja.owner)).send({}) },
      { caso: 'servicio con precio negativo', llamar: () => api().post('/api/v1/services').set(auth(s.navaja.owner)).send({ nombre: 'X', categoria: 'Y', precio: -5, duracion: 30 }) },
      { caso: 'servicio con precio de texto', llamar: () => api().post('/api/v1/services').set(auth(s.navaja.owner)).send({ nombre: 'X', categoria: 'Y', precio: 'caro', duracion: 30 }) },
      { caso: 'producto con stock decimal', llamar: () => api().post('/api/v1/products').set(auth(s.navaja.owner)).send({ nombre: 'X', categoria: 'Y', stock: 1.5, stockMinimo: 1, unidad: 'un', precioVenta: 10 }) },
      { caso: 'cita con identificadores inválidos', llamar: () => api().post('/api/v1/appointments').set(auth(s.navaja.owner)).send({ clientName: 'X', serviceId: 'no-es-uuid', employeeId: 'tampoco', appointmentDate: '2030-01-01', startTime: '10:00' }) },
      { caso: 'filtro de rol del master con valor inventado', llamar: () => api().get('/api/v1/master/users?role=superadmin').set(auth(s.master)) },
    ])('$caso → 400 con mensaje en español', async ({ llamar }) => {
      const r = await llamar();
      expect(r.status).toBe(400);
      expect(r.body.code).toBe('VALIDATION_ERROR');
      expect(r.body.error).not.toMatch(sinIngles);
      expect(r.body.error.length).toBeGreaterThan(5);
    });

    it('los mensajes concretos que ve el usuario del login son claros', async () => {
      expect((await login({ email: 'no-es-correo', password: 'x' })).body.error).toBe('Ingresa un correo válido.');
      expect((await login({ email: 'a@test.local', password: '' })).body.error).toBe('Ingresa tu contraseña.');
      expect((await login({ password: 'x' })).body.error).toBe('Falta un dato obligatorio.');
    });
  });

  describe('mensajes de la API', () => {
    it('el 403 por rol está en español y en tuteo (sin voseo)', async () => {
      const r = await api().post('/api/v1/auth/employees').set(auth(s.navaja.julian)).send({ name: 'X Y', email: uniqueEmail('z'), password: PASSWORD });
      expect(r.status).toBe(403);
      expect(r.body.code).toBe('FORBIDDEN');
      expect(r.body.error).toBe('No tienes permiso para esta acción.');
    });
  });
});
