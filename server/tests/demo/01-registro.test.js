/**
 * Módulo 1 — Registro (POST /api/v1/auth/register).
 * Cubre lo que las suites existentes no prueban: límites exactos de la contraseña, nombres
 * raros, correos con espacios o mayúsculas, cuerpos malformados, concurrencia y que el
 * token entregado sirva de verdad. Crea solo datos @test.local (se limpian solos).
 *
 * Convención de hallazgos: una prueba que describe el comportamiento ESPERADO pero que hoy
 * falla se marca con `it.fails('HALLAZGO …')`. Pasa mientras el defecto exista y se pone
 * roja cuando alguien lo corrija, avisando de que hay que quitar la marca.
 * H1–H6 ya están corregidos (ver MEMORY.md): sus pruebas son ahora normales y vigilan que no vuelvan.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { api, auth, prisma, PASSWORD, uniqueEmail, requireSeed } from './helpers-demo.js';
import { verifyToken } from '../../src/lib/jwt.js';

const register = (body) => api().post('/api/v1/auth/register').send(body);
const ok = (over = {}) => ({ name: 'Ana Prueba', email: uniqueEmail('reg1'), password: PASSWORD, ...over });

describe('Módulo 1 · registro', () => {
  beforeAll(requireSeed);

  describe('respuesta de un registro correcto', () => {
    it('devuelve 201 con la forma exacta { ok, token, user, business } y sin datos sensibles', async () => {
      const body = ok();
      const res = await register(body);
      expect(res.status).toBe(201);
      expect(Object.keys(res.body).sort()).toEqual(['business', 'ok', 'token', 'user']);
      expect(res.body.ok).toBe(true);
      expect(Object.keys(res.body.user).sort()).toEqual(['businessId', 'email', 'id', 'name', 'role']);
      expect(Object.keys(res.body.business).sort()).toEqual(['address', 'description', 'id', 'logo', 'name', 'phone']);
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|password_hash|\$2[aby]\$/);
    });

    it('el usuario nace como owner, el negocio se llama "Barbería de {nombre}" y ambos quedan enlazados', async () => {
      const res = await register(ok({ name: 'José Ángel Núñez' }));
      expect(res.body.user.role).toBe('owner');
      expect(res.body.business.name).toBe('Barbería de José Ángel Núñez');
      expect(res.body.user.businessId).toBe(res.body.business.id);
      expect(res.body.business).toMatchObject({ logo: null, description: '', phone: '', address: '' });
    });

    it('el token firma sub, role y businessId correctos y caduca en el futuro', async () => {
      const res = await register(ok());
      const payload = verifyToken(res.body.token);
      expect(payload.sub).toBe(res.body.user.id);
      expect(payload.role).toBe('owner');
      expect(payload.businessId).toBe(res.body.business.id);
      expect(payload.exp * 1000).toBeGreaterThan(Date.now());
    });

    it('el token sirve en /me y /me devuelve al mismo usuario y negocio', async () => {
      const res = await register(ok());
      const me = await api().get('/api/v1/auth/me').set(auth(res.body.token));
      expect(me.status).toBe(200);
      expect(me.body.user.id).toBe(res.body.user.id);
      expect(me.body.business.id).toBe(res.body.business.id);
    });

    it('la contraseña se guarda como hash bcrypt, nunca en claro', async () => {
      const body = ok();
      await register(body);
      const row = await prisma.user.findUnique({ where: { email: body.email } });
      expect(row.passwordHash).toMatch(/^\$2[aby]\$12\$/);
      expect(row.passwordHash).not.toContain(body.password);
    });

    it('puede iniciar sesión de inmediato con las credenciales con que se registró', async () => {
      const body = ok();
      await register(body);
      const login = await api().post('/api/v1/auth/login').send({ email: body.email, password: body.password });
      expect(login.status).toBe(200);
    });

    it('dos registros distintos crean negocios distintos (no comparten nada)', async () => {
      const a = await register(ok());
      const b = await register(ok());
      expect(a.body.business.id).not.toBe(b.body.business.id);
      expect(a.body.user.id).not.toBe(b.body.user.id);
    });
  });

  describe('un negocio recién registrado empieza vacío', () => {
    it('no ve ningún dato de los negocios demo, aunque la base los tenga', async () => {
      const res = await register(ok());
      const t = auth(res.body.token);
      expect((await api().get('/api/v1/services').set(t)).body.services).toEqual([]);
      expect((await api().get('/api/v1/products').set(t)).body.products).toEqual([]);
      expect((await api().get('/api/v1/clients').set(t)).body.clients).toEqual([]);
      expect((await api().get('/api/v1/appointments').set(t)).body.appointments).toEqual([]);
      expect((await api().get('/api/v1/auth/employees').set(t)).body.employees).toEqual([]);
    });
  });

  describe('contraseña: límites exactos', () => {
    it.each([
      { caso: '8 caracteres (mínimo exacto)', password: 'Abcdefg1', status: 201 },
      { caso: '7 caracteres', password: 'Abcdef1', status: 400 },
      { caso: '72 caracteres (máximo exacto)', password: `A1${'x'.repeat(70)}`, status: 201 },
      { caso: '73 caracteres', password: `A1${'x'.repeat(71)}`, status: 400 },
      { caso: 'con espacios en medio', password: 'Mi clave 2026', status: 201 },
      { caso: 'con símbolos', password: 'Cl@ve#2026!', status: 201 },
      { caso: 'solo letras', password: 'abcdefghij', status: 400 },
      { caso: 'solo números', password: '1234567890', status: 400 },
      { caso: 'vacía', password: '', status: 400 },
    ])('$caso → $status', async ({ password, status }) => {
      const res = await register(ok({ password }));
      expect(res.status).toBe(status);
      if (status === 400) expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('rechaza una contraseña sin ninguna letra ASCII aunque tenga letras acentuadas', async () => {
      const res = await register(ok({ password: 'ñññññññ1' }));
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/letra/i);
    });

    it('el mensaje de error dice qué falta (longitud, letra o número)', async () => {
      expect((await register(ok({ password: 'Ab1' }))).body.error).toMatch(/8 caracteres/);
      expect((await register(ok({ password: '12345678' }))).body.error).toMatch(/letra/);
      expect((await register(ok({ password: 'abcdefgh' }))).body.error).toMatch(/número/);
    });

    it('H1 corregido: se mide en BYTES (los acentos cuentan doble), así que una clave de más de 72 bytes se rechaza al registrarse', async () => {
      // 'ñ' ocupa 2 bytes: 2 + 35×2 = 72 bytes exactos → válida; con 4 caracteres más son 76 bytes → rechazada.
      const justa = await register(ok({ password: `A1${'ñ'.repeat(35)}` }));
      expect(justa.status).toBe(201);
      const larga = await register(ok({ password: `A1${'ñ'.repeat(35)}aaaa` }));
      expect(larga.status).toBe(400);
      expect(larga.body.error).toMatch(/72 bytes/);
    });

    it('H1 corregido: ya no pueden existir dos claves distintas que inicien sesión como una sola', async () => {
      const base = `A1${'ñ'.repeat(35)}`;
      const email = uniqueEmail('bytes');
      expect((await register({ name: 'Bytes Prueba', email, password: base })).status).toBe(201);
      // Cualquier cola añadida pasa de 72 bytes y ni siquiera se puede registrar con ella...
      expect((await register(ok({ password: `${base}x1` }))).status).toBe(400);
      // ...y tampoco sirve para entrar a la cuenta existente.
      expect((await api().post('/api/v1/auth/login').send({ email, password: `${base}x1` })).status).toBe(401);
    });
  });

  describe('nombre', () => {
    it.each([
      { caso: '2 caracteres (mínimo exacto)', name: 'Al', status: 201 },
      { caso: '1 carácter', name: 'A', status: 400 },
      { caso: 'vacío', name: '', status: 400 },
      { caso: '80 caracteres (máximo exacto)', name: 'A'.repeat(80), status: 201 },
      { caso: '81 caracteres', name: 'A'.repeat(81), status: 400 },
      { caso: '1 carácter rodeado de espacios', name: '   A   ', status: 400 },
    ])('$caso → $status', async ({ name, status }) => {
      expect((await register(ok({ name }))).status).toBe(status);
    });

    it('acepta tildes, ñ y apóstrofes y los guarda tal cual', async () => {
      const name = "María-José O'Connor Ñúñez";
      const res = await register(ok({ name }));
      expect(res.status).toBe(201);
      expect(res.body.user.name).toBe(name);
    });

    it('el texto con HTML o SQL se guarda como texto y se devuelve igual, sin ejecutarse ni romper nada', async () => {
      const name = `<script>alert(1)</script>'; DROP TABLE users;--`;
      const res = await register(ok({ name }));
      expect(res.status).toBe(201);
      expect(res.body.user.name).toBe(name);
      expect(await prisma.user.count()).toBeGreaterThan(0);
    });

    it('H2 corregido: un nombre de solo espacios se rechaza', async () => {
      const res = await register(ok({ name: '   ' }));
      expect(res.status).toBe(400);
    });

    it('H3 corregido: un nombre con espacios al inicio y al final se guarda recortado', async () => {
      const res = await register(ok({ name: '   Ana Prueba   ' }));
      expect(res.status).toBe(201);
      expect(res.body.user.name).toBe('Ana Prueba');
      expect(res.body.business.name).toBe('Barbería de Ana Prueba');
    });

    it('H4 corregido: un nombre absurdamente largo (5.000 caracteres) se rechaza', async () => {
      const res = await register(ok({ name: 'A'.repeat(5000) }));
      expect(res.status).toBe(400);
    });

    it('rechaza un nombre que no sea texto', async () => {
      for (const name of [123, null, true, ['Ana'], { a: 1 }]) {
        expect((await register(ok({ name }))).status).toBe(400);
      }
    });
  });

  describe('correo', () => {
    it('se guarda en minúsculas aunque se envíe con mayúsculas', async () => {
      const email = uniqueEmail('MAYUS').toUpperCase();
      const res = await register(ok({ email }));
      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe(email.toLowerCase());
      expect(await prisma.user.findUnique({ where: { email: email.toLowerCase() } })).toBeTruthy();
    });

    it('acepta direcciones con "+" (alias de Gmail) y las guarda tal cual', async () => {
      // Debe terminar en @test.local: si no, el limpiador de pruebas no la borra y queda basura en la BD.
      const email = `ana+tag${Date.now()}@test.local`;
      const a = await register(ok({ email }));
      expect(a.status).toBe(201);
      expect(a.body.user.email).toBe(email);
    });

    it('rechaza un correo de más de 254 caracteres (límite de la norma)', async () => {
      const largo = `${'a'.repeat(250)}@t.local`;
      expect((await register(ok({ email: largo }))).status).toBe(400);
    });

    it.each([
      ['sin arroba', 'ana.test.local'],
      ['sin dominio', 'ana@'],
      ['sin usuario', '@test.local'],
      ['con espacios dentro', 'a na@test.local'],
      ['vacío', ''],
      ['con tilde en el usuario', 'josé@test.local'],
    ])('rechaza correo %s', async (_caso, email) => {
      const res = await register(ok({ email }));
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('H5 corregido: un correo con espacios al inicio o al final se acepta recortado (error típico al copiar y pegar)', async () => {
      const limpio = uniqueEmail('trim');
      const res = await register(ok({ email: `  ${limpio}  ` }));
      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe(limpio);
    });

    it('no permite repetir un correo, con cualquier capitalización, y no deja un negocio huérfano', async () => {
      const email = uniqueEmail('dup1');
      expect((await register(ok({ email }))).status).toBe(201);
      const negociosAntes = await prisma.business.count();

      const igual = await register(ok({ email }));
      const mayus = await register(ok({ email: email.toUpperCase() }));
      expect(igual.status).toBe(409);
      expect(mayus.status).toBe(409);
      expect(igual.body).toEqual({ ok: false, error: 'Ya existe una cuenta con este correo.' });
      expect(await prisma.business.count()).toBe(negociosAntes);
    });

    it('el 409 no distingue si el correo es de un dueño, un barbero o un master (no hay forma de saber el rol)', async () => {
      const a = await register(ok({ email: 'master@demo.barberflow.com' }));
      const b = await register(ok({ email: 'barbero1.navaja@demo.barberflow.com' }));
      expect(a.status).toBe(409);
      expect(b.body).toEqual(a.body);
    });
  });

  describe('cuerpo de la petición malformado', () => {
    it.each([
      ['vacío {}', {}],
      ['sin contraseña', { name: 'Ana Prueba', email: 'a@test.local' }],
      ['sin correo', { name: 'Ana Prueba', password: PASSWORD }],
      ['sin nombre', { email: 'a@test.local', password: PASSWORD }],
    ])('%s → 400 con VALIDATION_ERROR', async (_caso, body) => {
      const res = await register(body);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('JSON roto → 400 (no 500)', async () => {
      const res = await api().post('/api/v1/auth/register').set('Content-Type', 'application/json').send('{"name": "Ana", ');
      expect(res.status).toBe(400);
    });

    it('cuerpo mayor de 100 kb → 413', async () => {
      const res = await register(ok({ name: 'A'.repeat(150 * 1024) }));
      expect(res.status).toBe(413);
    });

    it('un cuerpo que no es JSON (texto plano) no crea nada ni da 500', async () => {
      const antes = await prisma.user.count();
      const res = await api().post('/api/v1/auth/register').set('Content-Type', 'text/plain').send('name=Ana');
      expect(res.status).toBe(400);
      expect(await prisma.user.count()).toBe(antes);
    });

    it('campos extra se ignoran: no se puede registrar uno mismo como master ni asignarse un negocio', async () => {
      const demoOwner = await prisma.user.findUnique({ where: { email: 'dueno.navaja@demo.barberflow.com' } });
      const res = await register(ok({ role: 'master', businessId: demoOwner.businessId, isActive: false }));
      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('owner');
      expect(res.body.user.businessId).not.toBe(demoOwner.businessId);
      const fila = await prisma.user.findUnique({ where: { email: res.body.user.email } });
      expect(fila.isActive).toBe(true);
    });

    it('solo acepta POST: GET, PUT y DELETE sobre /register no existen', async () => {
      expect((await api().get('/api/v1/auth/register')).status).toBe(404);
      expect((await api().put('/api/v1/auth/register').send(ok())).status).toBe(404);
      expect((await api().delete('/api/v1/auth/register')).status).toBe(404);
    });
  });

  describe('concurrencia', () => {
    it('H6 corregido: 5 registros simultáneos con el mismo correo: uno gana (201) y el resto recibe 409, nunca 500', async () => {
      // La primera ronda a veces no choca (calentamiento); con varias rondas el defecto aparece casi siempre.
      for (let ronda = 0; ronda < 6; ronda++) {
        const email = uniqueEmail(`race${ronda}`);
        const respuestas = await Promise.all(Array.from({ length: 5 }, () => register(ok({ email }))));
        const estados = respuestas.map((r) => r.status);
        expect(estados.filter((s) => s === 500), `ronda ${ronda}: ${estados}`).toHaveLength(0);
        expect(estados.filter((s) => s === 201)).toHaveLength(1);
      }
    });

    it('H7: una ráfaga de 12 registros con correos DISTINTOS se atiende completa (todos 201, ninguno 500)', async () => {
      // Antes, el hash bcrypt se calculaba dentro de la transacción de la BD: con varias altas a la vez Prisma
      // fallaba con P2028 ("no se pudo iniciar la transacción a tiempo") aunque los correos fueran distintos.
      for (let ronda = 0; ronda < 3; ronda++) {
        const respuestas = await Promise.all(Array.from({ length: 12 }, (_, i) => register(ok({ email: uniqueEmail(`burst${ronda}x${i}`) }))));
        expect(respuestas.map((r) => r.status), `ronda ${ronda}`).toEqual(Array(12).fill(201));
      }
    }, 60000);

    it('aun con la carrera, queda un solo usuario y un solo negocio por correo (la transacción deshace lo del perdedor, sin huérfanos)', async () => {
      for (let ronda = 0; ronda < 3; ronda++) {
        const email = uniqueEmail(`race2${ronda}`);
        const antes = await prisma.business.count();
        await Promise.all(Array.from({ length: 5 }, () => register(ok({ email }))));
        expect(await prisma.user.count({ where: { email } })).toBe(1);
        expect(await prisma.business.count()).toBe(antes + 1);
      }
    });
  });
});
