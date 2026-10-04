import { describe, expect, it } from 'vitest';
import { PASSWORD, api, auth, createEmployee, dbUp, prisma, registerOwner, uniqueEmail } from '../helpers.js';

describe.skipIf(!dbUp)('auth', () => {
  describe('registro', () => {
    it.each([
      ['muy corta', 'Ab1'],
      ['sin números', 'soloLetrasAqui'],
      ['sin letras', '1234567890'],
      ['demasiado larga', `A1${'x'.repeat(80)}`],
    ])('rechaza una contraseña %s', async (_motivo, password) => {
      const res = await api().post('/api/v1/auth/register').send({ name: 'Ana Test', email: uniqueEmail('reg'), password });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('rechaza nombre corto y correo inválido', async () => {
      expect((await api().post('/api/v1/auth/register').send({ name: 'A', email: uniqueEmail('reg'), password: PASSWORD })).status).toBe(400);
      expect((await api().post('/api/v1/auth/register').send({ name: 'Ana Test', email: 'no-es-correo', password: PASSWORD })).status).toBe(400);
    });

    it('crea propietario + negocio, devuelve token y no expone el hash', async () => {
      const { token, user, business } = await registerOwner('reg');
      expect(token).toEqual(expect.any(String));
      expect(user.role).toBe('owner');
      expect(business.id).toBe(user.businessId);
      const raw = await api().get('/api/v1/auth/me').set(auth(token));
      expect(JSON.stringify(raw.body)).not.toMatch(/passwordHash|password_hash/);
    });

    it('no permite repetir el correo (sin distinguir mayúsculas)', async () => {
      const { email } = await registerOwner('dup');
      const res = await api().post('/api/v1/auth/register').send({ name: 'Otra Persona', email: email.toUpperCase(), password: PASSWORD });
      expect(res.status).toBe(409);
    });

    it('guarda el correo en minúsculas y permite iniciar sesión con otra capitalización', async () => {
      const { email } = await registerOwner('Mayus');
      const res = await api().post('/api/v1/auth/login').send({ email: email.toUpperCase(), password: PASSWORD });
      expect(res.status).toBe(200);
    });
  });

  describe('login', () => {
    it('entrega token, usuario y negocio con credenciales correctas', async () => {
      const { email } = await registerOwner('login');
      const res = await api().post('/api/v1/auth/login').send({ email, password: PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ ok: true, user: { email, role: 'owner' } });
      expect(res.body.token).toEqual(expect.any(String));
    });

    it('contraseña incorrecta y usuario inexistente dan exactamente la misma respuesta', async () => {
      const { email } = await registerOwner('login');
      const mala = await api().post('/api/v1/auth/login').send({ email, password: 'Incorrecta1' });
      const inexistente = await api().post('/api/v1/auth/login').send({ email: uniqueEmail('nadie'), password: 'Incorrecta1' });
      expect(mala.status).toBe(401);
      expect(inexistente.status).toBe(401);
      expect(inexistente.body).toEqual(mala.body);
    });

    it('rechaza una cuenta desactivada', async () => {
      const { email } = await registerOwner('inactivo');
      await prisma.user.update({ where: { email }, data: { isActive: false } });
      const res = await api().post('/api/v1/auth/login').send({ email, password: PASSWORD });
      expect(res.status).toBe(403);
    });
  });

  describe('sesión', () => {
    it('/me exige token válido', async () => {
      expect((await api().get('/api/v1/auth/me')).status).toBe(401);
      expect((await api().get('/api/v1/auth/me').set(auth('token.invalido.xyz'))).status).toBe(401);
      expect((await api().get('/api/v1/auth/me').set({ Authorization: 'Basic abc' })).status).toBe(401);
    });

    it('un token deja de servir cuando el usuario se desactiva', async () => {
      const { token, email } = await registerOwner('sesion');
      expect((await api().get('/api/v1/auth/me').set(auth(token))).status).toBe(200);
      await prisma.user.update({ where: { email }, data: { isActive: false } });
      expect((await api().get('/api/v1/auth/me').set(auth(token))).status).toBe(401);
    });
  });

  describe('empleados', () => {
    it('el propietario crea y lista empleados de su negocio', async () => {
      const owner = await registerOwner('team');
      const emp = await createEmployee(owner.token, 'Barbero Uno');
      const list = await api().get('/api/v1/auth/employees').set(auth(owner.token));
      expect(list.body.employees.map((e) => e.id)).toContain(emp.id);
      expect(list.body.employees[0]).toHaveProperty('color');
    });

    it('valida la contraseña y el correo repetido', async () => {
      const owner = await registerOwner('team');
      const mal = await api().post('/api/v1/auth/employees').set(auth(owner.token))
        .send({ name: 'Barbero', email: uniqueEmail('emp'), password: 'corta' });
      expect(mal.status).toBe(400);

      const emp = await createEmployee(owner.token);
      const repetido = await api().post('/api/v1/auth/employees').set(auth(owner.token))
        .send({ name: 'Otro', email: emp.email, password: PASSWORD });
      expect(repetido.status).toBe(409);
    });

    it('un empleado no puede crear empleados', async () => {
      const owner = await registerOwner('team');
      const emp = await createEmployee(owner.token);
      const res = await api().post('/api/v1/auth/employees').set(auth(emp.token))
        .send({ name: 'Intruso', email: uniqueEmail('emp'), password: PASSWORD });
      expect(res.status).toBe(403);
    });

    it('cada negocio solo ve a sus propios empleados', async () => {
      const a = await registerOwner('a');
      const b = await registerOwner('b');
      const empA = await createEmployee(a.token);
      const listB = await api().get('/api/v1/auth/employees').set(auth(b.token));
      expect(listB.body.employees.map((e) => e.id)).not.toContain(empA.id);
    });
  });

  describe('negocio', () => {
    it('el propietario edita el perfil; el empleado no', async () => {
      const owner = await registerOwner('biz');
      const emp = await createEmployee(owner.token);

      const ok = await api().patch('/api/v1/businesses/me').set(auth(owner.token)).send({ name: 'Barbería Central', phone: '3001112222' });
      expect(ok.status).toBe(200);
      expect(ok.body.business).toMatchObject({ name: 'Barbería Central', phone: '3001112222' });

      expect((await api().patch('/api/v1/businesses/me').set(auth(emp.token)).send({ name: 'Hackeado' })).status).toBe(403);
      expect((await api().get('/api/v1/businesses/me').set(auth(emp.token))).body.business.name).toBe('Barbería Central');
    });
  });
});
