/**
 * Módulo 3 — Empleados (POST /auth/employees y GET /auth/employees).
 * Lee el seed solo en lectura (La Navaja, El Fade, Barbería Nueva); todo lo que crea o modifica
 * usa negocios @test.local nuevos. Los hallazgos sin corregir se marcan con `it.fails('HALLAZGO …')`.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  api, auth, prisma, PASSWORD, uniqueEmail, registerOwner, createEmployee, createService, createAppointment,
  requireSeed, demoSessions, bizDay, appCon, createMaster,
} from './helpers-demo.js';
import { pickStaffColor } from '../../src/lib/utils.js';
import { verifyToken } from '../../src/lib/jwt.js';

const crear = (token, body) => api().post('/api/v1/auth/employees').set(auth(token)).send(body);
const listar = (token) => api().get('/api/v1/auth/employees').set(auth(token));
const emp = (over = {}) => ({ name: 'Barbero Prueba', email: uniqueEmail('emp3'), password: PASSWORD, ...over });
const CLAVES = ['active', 'businessId', 'color', 'email', 'id', 'name', 'role', 'specialty'];
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const editar = (token, id, body) => api().patch(`/api/v1/auth/employees/${id}`).set(auth(token)).send(body);
const entrar = (email, password) => api().post('/api/v1/auth/login').send({ email, password });

describe('Módulo 3 · empleados', () => {
  let s;
  beforeAll(async () => { await requireSeed(); s = await demoSessions(); });

  describe('listado de los datos demo (solo lectura)', () => {
    it('La Navaja: lista a sus 2 barberos activos, en el orden del equipo, con la forma exacta y sin datos sensibles', async () => {
      const r = await listar(s.navaja.owner);
      expect(r.status).toBe(200);
      expect(r.body.employees).toHaveLength(2);
      for (const e of r.body.employees) {
        expect(Object.keys(e).sort()).toEqual(CLAVES);
        expect(e.role).toBe('employee');
        expect(e.active).toBe(true);
      }
      expect(r.body.employees.map((e) => e.name)).toEqual(['Julián Patiño', 'Camilo Reyes']);
      expect(JSON.stringify(r.body)).not.toMatch(/passwordHash|password_hash|\$2[aby]\$|isActive/);
    });

    it('excluye al barbero desactivado (Sebastián) aunque conserve su historial', async () => {
      const nombres = (await listar(s.navaja.owner)).body.employees.map((e) => e.name);
      expect(nombres.sort()).toEqual(['Camilo Reyes', 'Julián Patiño']);
      expect(nombres).not.toContain('Sebastián Ortiz');
    });

    it('trae la especialidad y el color de cada barbero', async () => {
      const lista = (await listar(s.navaja.owner)).body.employees;
      const julian = lista.find((e) => e.name === 'Julián Patiño');
      const camilo = lista.find((e) => e.name === 'Camilo Reyes');
      expect(julian).toMatchObject({ specialty: 'Fade y barba', color: pickStaffColor(0) });
      expect(camilo).toMatchObject({ specialty: 'Cortes clásicos', color: pickStaffColor(1) });
    });

    it('el dueño puede pedir también a los desactivados (?includeInactive=true) y cada uno trae su estado', async () => {
      const r = await api().get('/api/v1/auth/employees?includeInactive=true').set(auth(s.navaja.owner));
      expect(r.body.employees.map((e) => [e.name, e.active])).toEqual([['Julián Patiño', true], ['Camilo Reyes', true], ['Sebastián Ortiz', false]]);
    });

    it('un barbero que pide ?includeInactive=true recibe solo a los activos (la opción es del dueño)', async () => {
      const r = await api().get('/api/v1/auth/employees?includeInactive=true').set(auth(s.navaja.julian));
      expect(r.body.employees.map((e) => e.name).sort()).toEqual(['Camilo Reyes', 'Julián Patiño']);
    });

    it('cada negocio ve solo a los suyos: El Fade a Óscar, Nueva a nadie', async () => {
      expect((await listar(s.fade.owner)).body.employees.map((e) => e.name)).toEqual(['Óscar Lemus']);
      expect((await listar(s.nueva.owner)).body.employees).toEqual([]);
    });

    it('los ids de un negocio nunca aparecen en la lista de otro', async () => {
      const a = (await listar(s.navaja.owner)).body.employees.map((e) => e.id);
      const b = (await listar(s.fade.owner)).body.employees.map((e) => e.id);
      expect(a.filter((id) => b.includes(id))).toEqual([]);
    });

    it('un barbero también puede listar el equipo (lo necesita para ver a sus compañeros en la agenda)', async () => {
      const r = await listar(s.navaja.julian);
      expect(r.status).toBe(200);
      expect(r.body.employees.map((e) => e.name).sort()).toEqual(['Camilo Reyes', 'Julián Patiño']);
    });

    it('el master no tiene negocio: 403 NO_BUSINESS; sin sesión: 401', async () => {
      const m = await listar(s.master);
      expect(m.status).toBe(403);
      expect(m.body.code).toBe('NO_BUSINESS');
      expect((await api().get('/api/v1/auth/employees')).status).toBe(401);
    });
  });

  describe('alta de un empleado', () => {
    it('201 con { ok, user } y el empleado queda en el negocio del dueño con rol employee', async () => {
      const dueno = await registerOwner('alta');
      const body = emp();
      const r = await crear(dueno.token, body);
      expect(r.status).toBe(201);
      expect(r.body.ok).toBe(true);
      expect(Object.keys(r.body.user).sort()).toEqual(CLAVES);
      expect(r.body.user).toMatchObject({ active: true, specialty: '', color: pickStaffColor(0) });
      expect(r.body.user).toMatchObject({ role: 'employee', businessId: dueno.business.id, name: 'Barbero Prueba' });
      expect(JSON.stringify(r.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
    });

    it('se crea también su perfil de equipo: color, orden y especialidad', async () => {
      const dueno = await registerOwner('perfil');
      const r = await crear(dueno.token, emp({ specialty: 'Fade' }));
      const perfil = await prisma.staffProfile.findUnique({ where: { userId: r.body.user.id } });
      expect(perfil).toMatchObject({ specialty: 'Fade', color: pickStaffColor(0), displayOrder: 0 });
    });

    it('la especialidad es opcional y queda vacía', async () => {
      const dueno = await registerOwner('sinesp');
      const r = await crear(dueno.token, emp());
      expect((await prisma.staffProfile.findUnique({ where: { userId: r.body.user.id } })).specialty).toBe('');
    });

    it('el correo se guarda en minúsculas y el nombre recortado', async () => {
      const dueno = await registerOwner('norm');
      const correo = uniqueEmail('NORMAL');
      const r = await crear(dueno.token, emp({ name: '   Julián Nuevo   ', email: `  ${correo.toUpperCase()}  ` }));
      expect(r.status).toBe(201);
      expect(r.body.user.name).toBe('Julián Nuevo');
      expect(r.body.user.email).toBe(correo.toLowerCase());
    });

    it('la contraseña se guarda como hash bcrypt y el empleado puede iniciar sesión de inmediato', async () => {
      const dueno = await registerOwner('login');
      const body = emp();
      await crear(dueno.token, body);
      const fila = await prisma.user.findUnique({ where: { email: body.email } });
      expect(fila.passwordHash).toMatch(/^\$2[aby]\$12\$/);
      const login = await api().post('/api/v1/auth/login').send({ email: body.email, password: body.password });
      expect(login.status).toBe(200);
      expect(login.body.user.role).toBe('employee');
      expect(login.body.business.id).toBe(dueno.business.id);
      expect(verifyToken(login.body.token)).toMatchObject({ role: 'employee', businessId: dueno.business.id });
    });

    it('los colores rotan en orden y vuelven a empezar (5 colores, el 6.º repite el 1.º) con el orden 0..5', async () => {
      const dueno = await registerOwner('colores');
      const creados = [];
      for (let i = 0; i < 6; i++) creados.push((await crear(dueno.token, emp({ name: `Barbero ${i}` }))).body.user.id);
      const perfiles = await prisma.staffProfile.findMany({ where: { userId: { in: creados } } });
      const porId = Object.fromEntries(perfiles.map((p) => [p.userId, p]));
      creados.forEach((id, i) => {
        expect(porId[id].color, `color del barbero ${i}`).toBe(pickStaffColor(i));
        expect(porId[id].displayOrder).toBe(i);
      });
      expect(porId[creados[5]].color).toBe(porId[creados[0]].color);
    });

    it('el color y el orden cuentan también a los desactivados, para no repetir el color de un barbero que sigue en la agenda', async () => {
      const dueno = await registerOwner('inact');
      const primero = await crear(dueno.token, emp());
      await prisma.user.update({ where: { id: primero.body.user.id }, data: { isActive: false } });
      const segundo = await crear(dueno.token, emp());
      expect((await prisma.staffProfile.findUnique({ where: { userId: segundo.body.user.id } })).displayOrder).toBe(1);
    });
  });

  describe('validaciones del alta', () => {
    it.each([
      { caso: 'sin cuerpo', body: {} },
      { caso: 'sin nombre', body: { email: 'a@test.local', password: PASSWORD } },
      { caso: 'nombre de 1 carácter', body: { name: 'A', email: 'a@test.local', password: PASSWORD } },
      { caso: 'nombre de solo espacios', body: { name: '   ', email: 'a@test.local', password: PASSWORD } },
      { caso: 'nombre de más de 80 caracteres', body: { name: 'A'.repeat(81), email: 'a@test.local', password: PASSWORD } },
      { caso: 'correo inválido', body: { name: 'Ana Prueba', email: 'no-es-correo', password: PASSWORD } },
      { caso: 'sin correo', body: { name: 'Ana Prueba', password: PASSWORD } },
      { caso: 'contraseña corta', body: { name: 'Ana Prueba', email: 'a@test.local', password: 'Ab1' } },
      { caso: 'contraseña sin números', body: { name: 'Ana Prueba', email: 'a@test.local', password: 'soloLetrasAqui' } },
      { caso: 'contraseña de más de 72 bytes', body: { name: 'Ana Prueba', email: 'a@test.local', password: `A1${'ñ'.repeat(36)}` } },
      { caso: 'especialidad que no es texto', body: { name: 'Ana Prueba', email: 'a@test.local', password: PASSWORD, specialty: 123 } },
    ])('$caso → 400 con VALIDATION_ERROR y mensaje en español', async ({ body }) => {
      const dueno = await registerOwner('valid');
      const antes = await prisma.user.count({ where: { businessId: dueno.business.id } });
      const r = await crear(dueno.token, body);
      expect(r.status).toBe(400);
      expect(r.body.code).toBe('VALIDATION_ERROR');
      expect(r.body.error).not.toMatch(/Required|Expected|Invalid|must contain/i);
      expect(await prisma.user.count({ where: { businessId: dueno.business.id } })).toBe(antes);
    });

    it('un correo ya registrado → 409, sea de un dueño, de un barbero, de otro negocio o con otra capitalización', async () => {
      const dueno = await registerOwner('dup');
      const otro = await registerOwner('dup2');
      const e1 = emp();
      expect((await crear(dueno.token, e1)).status).toBe(201);
      for (const email of [e1.email, e1.email.toUpperCase(), dueno.email, otro.email, 'dueno.navaja@demo.barberflow.com', 'master@demo.barberflow.com']) {
        const r = await crear(dueno.token, emp({ email }));
        expect(r.status, email).toBe(409);
        expect(r.body).toEqual({ ok: false, error: 'Ya existe una cuenta con este correo.' });
      }
    });

    it('H13 corregido: la especialidad se recorta y tiene un máximo de 60 caracteres', async () => {
      const dueno = await registerOwner('esp');
      const larga = await crear(dueno.token, emp({ specialty: 'x'.repeat(5000) }));
      expect(larga.status).toBe(400);
      const justa = await crear(dueno.token, emp({ specialty: `  ${'x'.repeat(60)}  ` }));
      expect(justa.status).toBe(201);
      const perfil = await prisma.staffProfile.findUnique({ where: { userId: justa.body.user.id } });
      expect(perfil.specialty).toBe('x'.repeat(60));
    });
  });

  describe('permisos y aislamiento', () => {
    it('matriz de roles para crear: dueño 201, barbero 403, master 403, sin sesión 401', async () => {
      const dueno = await registerOwner('matriz');
      const barbero = await createEmployee(dueno.token, 'Barbero Matriz');
      expect((await crear(dueno.token, emp())).status).toBe(201);
      expect((await crear(barbero.token, emp())).status).toBe(403);
      expect((await crear(s.master, emp())).status).toBe(403);
      expect((await api().post('/api/v1/auth/employees').send(emp())).status).toBe(401);
    });

    it('el barbero no puede crear, ni siquiera "dentro" de su negocio, y no se crea nada', async () => {
      const dueno = await registerOwner('intruso');
      const barbero = await createEmployee(dueno.token, 'Barbero Intruso');
      const antes = await prisma.user.count({ where: { businessId: dueno.business.id } });
      const r = await crear(barbero.token, emp());
      expect(r.status).toBe(403);
      expect(r.body.error).toBe('No tienes permiso para esta acción.');
      expect(await prisma.user.count({ where: { businessId: dueno.business.id } })).toBe(antes);
    });

    it('un dueño no puede crear empleados en OTRO negocio: el negocio sale siempre de su sesión, no del cuerpo', async () => {
      const a = await registerOwner('A');
      const b = await registerOwner('B');
      const r = await crear(a.token, emp({ businessId: b.business.id, role: 'owner' }));
      expect(r.status).toBe(201);
      expect(r.body.user.businessId).toBe(a.business.id);
      expect(r.body.user.role).toBe('employee');
      expect((await listar(b.token)).body.employees).toEqual([]);
    });

    it('cada negocio solo ve a sus propios empleados', async () => {
      const a = await registerOwner('ais1');
      const b = await registerOwner('ais2');
      const ea = await createEmployee(a.token);
      expect((await listar(b.token)).body.employees.map((e) => e.id)).not.toContain(ea.id);
      expect((await listar(a.token)).body.employees.map((e) => e.id)).toContain(ea.id);
    });

    it('el barbero nuevo ve solo SUS citas, no las de sus compañeros', async () => {
      const dueno = await registerOwner('citas');
      const e1 = await createEmployee(dueno.token, 'Barbero Uno');
      const e2 = await createEmployee(dueno.token, 'Barbero Dos');
      const svc = await createService(dueno.token);
      await createAppointment(dueno.token, { serviceId: svc.id, employeeId: e1.id, date: bizDay(1), time: '10:00', clientName: 'Cliente de Uno' });
      await createAppointment(dueno.token, { serviceId: svc.id, employeeId: e2.id, date: bizDay(1), time: '10:00', clientName: 'Cliente de Dos' });
      const citas = (await api().get('/api/v1/appointments').set(auth(e1.token))).body.appointments;
      expect(citas.map((c) => c.cliente)).toEqual(['Cliente de Uno']);
    });

    it('un empleado desactivado no recibe citas nuevas (404) y el dueño no puede asignarse citas a sí mismo como barbero', async () => {
      const dueno = await registerOwner('desact');
      const e1 = await createEmployee(dueno.token, 'Barbero Baja');
      const svc = await createService(dueno.token);
      await prisma.user.update({ where: { id: e1.id }, data: { isActive: false } });
      const aBaja = await createAppointment(dueno.token, { serviceId: svc.id, employeeId: e1.id, date: bizDay(1), time: '10:00' });
      expect(aBaja.status).toBe(404);
      const aDueno = await createAppointment(dueno.token, { serviceId: svc.id, employeeId: dueno.user.id, date: bizDay(1), time: '10:00' });
      expect(aDueno.status).toBe(404);
    });
  });

  describe('concurrencia', () => {
    it('5 altas simultáneas con el mismo correo: una gana (201) y el resto 409, nunca 500', async () => {
      const dueno = await registerOwner('race');
      const body = emp();
      const rs = await Promise.all(Array.from({ length: 5 }, () => crear(dueno.token, body)));
      const estados = rs.map((r) => r.status);
      expect(estados.filter((x) => x === 500)).toHaveLength(0);
      expect(estados.filter((x) => x === 201)).toHaveLength(1);
      expect(await prisma.user.count({ where: { email: body.email } })).toBe(1);
    });

    it('una ráfaga de 8 altas con correos distintos se atiende completa (todas 201)', async () => {
      const dueno = await registerOwner('burst');
      const rs = await Promise.all(Array.from({ length: 8 }, (_, i) => crear(dueno.token, emp({ name: `Barbero ${i}` }))));
      expect(rs.map((r) => r.status)).toEqual(Array(8).fill(201));
    }, 60000);

    it('H14 corregido: 6 altas simultáneas se reparten el orden 0..5 y los colores en secuencia, sin repetir', async () => {
      const dueno = await registerOwner('orden');
      const rs = await Promise.all(Array.from({ length: 6 }, (_, i) => crear(dueno.token, emp({ name: `Barbero ${i}` }))));
      expect(rs.map((r) => r.status)).toEqual(Array(6).fill(201));
      const perfiles = await prisma.staffProfile.findMany({ where: { userId: { in: rs.map((r) => r.body.user.id) } } });
      expect(perfiles.map((p) => p.displayOrder).sort()).toEqual([0, 1, 2, 3, 4, 5]);
      expect(new Set(perfiles.map((p) => p.color)).size).toBe(5); // 5 colores: solo el 6.º repite
    }, 60000);
  });

  describe('orden de la lista', () => {
    it('H17 corregido: la lista sigue el orden del equipo (displayOrder), no el de creación', async () => {
      const dueno = await registerOwner('orden2');
      const a = await createEmployee(dueno.token, 'Primero');
      const b = await createEmployee(dueno.token, 'Segundo');
      const c = await createEmployee(dueno.token, 'Tercero');
      // El dueño reordena el equipo: Tercero, Primero, Segundo.
      await prisma.staffProfile.update({ where: { userId: c.id }, data: { displayOrder: 0 } });
      await prisma.staffProfile.update({ where: { userId: a.id }, data: { displayOrder: 1 } });
      await prisma.staffProfile.update({ where: { userId: b.id }, data: { displayOrder: 2 } });
      const nombres = (await listar(dueno.token)).body.employees.map((e) => e.name);
      expect(nombres).toEqual(['Tercero', 'Primero', 'Segundo']);
    });
  });

  describe('edición de un empleado (PATCH /auth/employees/:id) — H16', () => {
    it('edita el nombre y la especialidad, y la lista lo refleja', async () => {
      const dueno = await registerOwner('edit');
      const e1 = await createEmployee(dueno.token, 'Nombre Viejo');
      const r = await editar(dueno.token, e1.id, { name: '  Nombre Nuevo  ', specialty: ' Barba ' });
      expect(r.status).toBe(200);
      expect(r.body.user).toMatchObject({ id: e1.id, name: 'Nombre Nuevo', specialty: 'Barba', active: true });
      const lista = (await listar(dueno.token)).body.employees;
      expect(lista.find((e) => e.id === e1.id)).toMatchObject({ name: 'Nombre Nuevo', specialty: 'Barba' });
    });

    it('el color y el orden no cambian al editar', async () => {
      const dueno = await registerOwner('editcolor');
      const e1 = await createEmployee(dueno.token, 'Barbero Color');
      const antes = await prisma.staffProfile.findUnique({ where: { userId: e1.id } });
      await editar(dueno.token, e1.id, { specialty: 'Fade' });
      const despues = await prisma.staffProfile.findUnique({ where: { userId: e1.id } });
      expect({ color: despues.color, displayOrder: despues.displayOrder }).toEqual({ color: antes.color, displayOrder: antes.displayOrder });
    });

    it('un cuerpo vacío no cambia nada y responde 200', async () => {
      const dueno = await registerOwner('editvacio');
      const e1 = await createEmployee(dueno.token, 'Barbero Vacío');
      const r = await editar(dueno.token, e1.id, {});
      expect(r.status).toBe(200);
      expect(r.body.user.name).toBe('Barbero Vacío');
    });

    it('no permite cambiar el rol, el negocio ni el correo: esos campos se ignoran', async () => {
      const dueno = await registerOwner('editextra');
      const otro = await registerOwner('editextra2');
      const e1 = await createEmployee(dueno.token, 'Barbero Extra');
      await editar(dueno.token, e1.id, { name: 'Sigue Igual', role: 'owner', businessId: otro.business.id, email: 'otro@test.local' });
      const fila = await prisma.user.findUnique({ where: { id: e1.id } });
      expect(fila).toMatchObject({ role: 'employee', businessId: dueno.business.id, email: e1.email, name: 'Sigue Igual' });
    });

    it.each([
      { caso: 'nombre de solo espacios', body: { name: '   ' } },
      { caso: 'nombre de 1 carácter', body: { name: 'A' } },
      { caso: 'nombre de más de 80 caracteres', body: { name: 'A'.repeat(81) } },
      { caso: 'especialidad de más de 60 caracteres', body: { specialty: 'x'.repeat(61) } },
      { caso: 'active que no es booleano', body: { active: 'no' } },
      { caso: 'contraseña débil', body: { password: 'corta' } },
      { caso: 'contraseña de más de 72 bytes', body: { password: `A1${'ñ'.repeat(36)}` } },
    ])('$caso → 400 en español y no cambia nada', async ({ body }) => {
      const dueno = await registerOwner('editinv');
      const e1 = await createEmployee(dueno.token, 'Barbero Inválido');
      const r = await editar(dueno.token, e1.id, body);
      expect(r.status).toBe(400);
      expect(r.body.code).toBe('VALIDATION_ERROR');
      expect(r.body.error).not.toMatch(/Required|Expected|Invalid|must contain/i);
      expect((await prisma.user.findUnique({ where: { id: e1.id } })).name).toBe('Barbero Inválido');
    });
  });

  describe('baja y reactivación de un empleado — H15', () => {
    it('desactivar: 200, el empleado pierde el acceso AL INSTANTE y deja de aparecer en la lista normal', async () => {
      const dueno = await registerOwner('baja');
      const e1 = await createEmployee(dueno.token, 'Barbero Que Se Va');
      expect((await api().get('/api/v1/auth/me').set(auth(e1.token))).status).toBe(200);
      const r = await editar(dueno.token, e1.id, { active: false });
      expect(r.status).toBe(200);
      expect(r.body.user.active).toBe(false);
      expect((await api().get('/api/v1/auth/me').set(auth(e1.token))).status).toBe(401);
      expect((await entrar(e1.email, PASSWORD)).status).toBe(403);
      expect((await listar(dueno.token)).body.employees.map((e) => e.id)).not.toContain(e1.id);
    });

    it('el dueño lo sigue viendo con includeInactive=true, marcado como inactivo', async () => {
      const dueno = await registerOwner('bajalista');
      const e1 = await createEmployee(dueno.token, 'Barbero Inactivo');
      await editar(dueno.token, e1.id, { active: false });
      const r = await api().get('/api/v1/auth/employees?includeInactive=true').set(auth(dueno.token));
      expect(r.body.employees.find((e) => e.id === e1.id)).toMatchObject({ active: false, name: 'Barbero Inactivo' });
    });

    it('al desactivar avisa cuántas citas futuras le quedan (pendientes y confirmadas; no cuenta canceladas)', async () => {
      const dueno = await registerOwner('bajacitas');
      const e1 = await createEmployee(dueno.token, 'Barbero Con Citas');
      const svc = await createService(dueno.token);
      const c1 = (await createAppointment(dueno.token, { serviceId: svc.id, employeeId: e1.id, date: bizDay(1), time: '10:00', clientName: 'Uno' })).body.appointment;
      const c2 = (await createAppointment(dueno.token, { serviceId: svc.id, employeeId: e1.id, date: bizDay(2), time: '10:00', clientName: 'Dos' })).body.appointment;
      const c3 = (await createAppointment(dueno.token, { serviceId: svc.id, employeeId: e1.id, date: bizDay(3), time: '10:00', clientName: 'Tres' })).body.appointment;
      await api().patch(`/api/v1/appointments/${c2.id}`).set(auth(dueno.token)).send({ status: 'confirmed' });
      await api().patch(`/api/v1/appointments/${c3.id}`).set(auth(dueno.token)).send({ status: 'cancelled' });
      const r = await editar(dueno.token, e1.id, { active: false });
      expect(r.body.pendingAppointments).toBe(2);
      expect(c1.id).toBeTruthy();
    });

    it('sus citas e historial se conservan (no se borran al desactivarlo)', async () => {
      const dueno = await registerOwner('bajahist');
      const e1 = await createEmployee(dueno.token, 'Barbero Historial');
      const svc = await createService(dueno.token);
      await createAppointment(dueno.token, { serviceId: svc.id, employeeId: e1.id, date: bizDay(1), time: '10:00', clientName: 'Cliente Histórico' });
      await editar(dueno.token, e1.id, { active: false });
      const citas = (await api().get('/api/v1/appointments').set(auth(dueno.token))).body.appointments;
      expect(citas.map((c) => c.cliente)).toContain('Cliente Histórico');
    });

    it('no recibe citas nuevas mientras esté desactivado', async () => {
      const dueno = await registerOwner('bajanuevas');
      const e1 = await createEmployee(dueno.token, 'Barbero Baja');
      const svc = await createService(dueno.token);
      await editar(dueno.token, e1.id, { active: false });
      expect((await createAppointment(dueno.token, { serviceId: svc.id, employeeId: e1.id, date: bizDay(1), time: '10:00' })).status).toBe(404);
    });

    it('desactivar a alguien ya desactivado es idempotente: 200 y sin aviso de citas', async () => {
      const dueno = await registerOwner('bajados');
      const e1 = await createEmployee(dueno.token, 'Barbero Doble');
      await editar(dueno.token, e1.id, { active: false });
      const r = await editar(dueno.token, e1.id, { active: false });
      expect(r.status).toBe(200);
      expect(r.body).not.toHaveProperty('pendingAppointments');
    });

    it('reactivar: vuelve a iniciar sesión, a la lista y a recibir citas', async () => {
      const dueno = await registerOwner('reactivar');
      const e1 = await createEmployee(dueno.token, 'Barbero Vuelve');
      const svc = await createService(dueno.token);
      await editar(dueno.token, e1.id, { active: false });
      const r = await editar(dueno.token, e1.id, { active: true });
      expect(r.body.user.active).toBe(true);
      expect((await entrar(e1.email, PASSWORD)).status).toBe(200);
      expect((await listar(dueno.token)).body.employees.map((e) => e.id)).toContain(e1.id);
      expect((await createAppointment(dueno.token, { serviceId: svc.id, employeeId: e1.id, date: bizDay(1), time: '10:00' })).status).toBe(201);
    });

    it('la baja cierra sus sesiones para siempre: al reactivarlo, un token anterior NO revive (debe iniciar sesión de nuevo)', async () => {
      const dueno = await registerOwner('revive');
      const e1 = await createEmployee(dueno.token, 'Barbero Revive');
      await dormir(1100); // el token se emitió antes del segundo de la baja
      await editar(dueno.token, e1.id, { active: false });
      expect((await api().get('/api/v1/auth/me').set(auth(e1.token))).status).toBe(401);
      await editar(dueno.token, e1.id, { active: true });
      expect((await api().get('/api/v1/auth/me').set(auth(e1.token))).status).toBe(401);
      const nuevo = await entrar(e1.email, PASSWORD);
      expect(nuevo.status).toBe(200);
      expect((await api().get('/api/v1/auth/me').set(auth(nuevo.body.token))).status).toBe(200);
    });
  });

  describe('restablecer la contraseña de un empleado (el dueño)', () => {
    it('la clave nueva funciona, la vieja ya no, y las sesiones que tenía abiertas se cierran', async () => {
      const dueno = await registerOwner('reset');
      const e1 = await createEmployee(dueno.token, 'Barbero Reset');
      await dormir(1100); // el token se emitió antes del segundo del cambio
      const r = await editar(dueno.token, e1.id, { password: 'ClaveNueva2026' });
      expect(r.status).toBe(200);
      expect((await api().get('/api/v1/auth/me').set(auth(e1.token))).status).toBe(401);
      expect((await entrar(e1.email, PASSWORD)).status).toBe(401);
      const nuevo = await entrar(e1.email, 'ClaveNueva2026');
      expect(nuevo.status).toBe(200);
      expect((await api().get('/api/v1/auth/me').set(auth(nuevo.body.token))).status).toBe(200);
    });

    it('la respuesta nunca incluye la contraseña ni su hash', async () => {
      const dueno = await registerOwner('resetsec');
      const e1 = await createEmployee(dueno.token, 'Barbero Seguro');
      const r = await editar(dueno.token, e1.id, { password: 'ClaveNueva2026' });
      expect(JSON.stringify(r.body)).not.toMatch(/ClaveNueva|passwordHash|\$2[aby]\$/);
    });
  });

  describe('permisos y aislamiento de la edición', () => {
    it('barbero 403, master 403, sin sesión 401', async () => {
      const dueno = await registerOwner('permedit');
      const e1 = await createEmployee(dueno.token, 'Barbero Uno');
      const e2 = await createEmployee(dueno.token, 'Barbero Dos');
      expect((await editar(e1.token, e2.id, { name: 'Hackeado' })).status).toBe(403);
      expect((await editar(e1.token, e1.id, { name: 'Yo Mismo' })).status).toBe(403);
      expect((await editar(s.master, e1.id, { name: 'Master' })).status).toBe(403);
      expect((await api().patch(`/api/v1/auth/employees/${e1.id}`).send({ name: 'Anónimo' })).status).toBe(401);
      expect((await prisma.user.findUnique({ where: { id: e2.id } })).name).toBe('Barbero Dos');
    });

    it('un dueño no puede editar ni desactivar empleados de OTRO negocio (404)', async () => {
      const a = await registerOwner('A');
      const b = await registerOwner('B');
      const eb = await createEmployee(b.token, 'Barbero De B');
      for (const body of [{ name: 'Robado' }, { active: false }, { password: 'ClaveNueva2026' }]) {
        expect((await editar(a.token, eb.id, body)).status).toBe(404);
      }
      expect(await prisma.user.findUnique({ where: { id: eb.id } })).toMatchObject({ name: 'Barbero De B', isActive: true });
    });

    it('no se puede usar para tocar al dueño, ni con un id inexistente o inválido (404, sin revelar cuál)', async () => {
      const dueno = await registerOwner('ids');
      for (const id of [dueno.user.id, '00000000-0000-4000-8000-000000000000', 'no-es-un-uuid']) {
        const r = await editar(dueno.token, id, { active: false });
        expect(r.status, id).toBe(404);
        expect(r.body).toEqual({ error: 'Empleado no encontrado.', code: 'NOT_FOUND' });
      }
      expect((await api().get('/api/v1/auth/me').set(auth(dueno.token))).status).toBe(200);
    });

    it('los empleados demo de otro negocio no se pueden editar con la sesión de La Navaja', async () => {
      const oscar = (await listar(s.fade.owner)).body.employees[0];
      expect((await editar(s.navaja.owner, oscar.id, { name: 'Robado' })).status).toBe(404);
    });
  });

  describe('cambio de contraseña propio (POST /auth/change-password) — H16', () => {
    const cambiar = (token, body) => api().post('/api/v1/auth/change-password').set(auth(token)).send(body);

    it('cambia la clave: devuelve un token nuevo, la clave vieja deja de servir y la nueva sí', async () => {
      const dueno = await registerOwner('cambio');
      await dormir(1100);
      const r = await cambiar(dueno.token, { currentPassword: PASSWORD, newPassword: 'ClaveNueva2026' });
      expect(r.status).toBe(200);
      expect(r.body.ok).toBe(true);
      expect(r.body.token).toEqual(expect.any(String));
      expect(r.body.token).not.toBe(dueno.token);
      expect((await api().get('/api/v1/auth/me').set(auth(dueno.token))).status).toBe(401);
      expect((await api().get('/api/v1/auth/me').set(auth(r.body.token))).status).toBe(200);
      expect((await entrar(dueno.email, PASSWORD)).status).toBe(401);
      expect((await entrar(dueno.email, 'ClaveNueva2026')).status).toBe(200);
    });

    it('cierra las demás sesiones del usuario (otro dispositivo) pero no la que hizo el cambio', async () => {
      const dueno = await registerOwner('cambiootras');
      const otra = (await entrar(dueno.email, PASSWORD)).body.token;
      await dormir(1100);
      const r = await cambiar(dueno.token, { currentPassword: PASSWORD, newPassword: 'ClaveNueva2026' });
      expect((await api().get('/api/v1/auth/me').set(auth(otra))).status).toBe(401);
      expect((await api().get('/api/v1/auth/me').set(auth(r.body.token))).status).toBe(200);
    });

    it('contraseña actual incorrecta → 400 INVALID_CURRENT_PASSWORD (no 401) y no cambia nada', async () => {
      const dueno = await registerOwner('cambiomala');
      const r = await cambiar(dueno.token, { currentPassword: 'Incorrecta1', newPassword: 'ClaveNueva2026' });
      expect(r.status).toBe(400);
      expect(r.body).toEqual({ error: 'La contraseña actual no es correcta.', code: 'INVALID_CURRENT_PASSWORD' });
      expect((await entrar(dueno.email, PASSWORD)).status).toBe(200);
    });

    it('la nueva igual a la actual → 400 SAME_PASSWORD', async () => {
      const dueno = await registerOwner('cambioigual');
      const r = await cambiar(dueno.token, { currentPassword: PASSWORD, newPassword: PASSWORD });
      expect(r.status).toBe(400);
      expect(r.body.code).toBe('SAME_PASSWORD');
    });

    it.each([
      { caso: 'sin cuerpo', body: {} },
      { caso: 'sin la actual', body: { newPassword: 'ClaveNueva2026' } },
      { caso: 'sin la nueva', body: { currentPassword: PASSWORD } },
      { caso: 'nueva demasiado corta', body: { currentPassword: PASSWORD, newPassword: 'Ab1' } },
      { caso: 'nueva sin números', body: { currentPassword: PASSWORD, newPassword: 'soloLetrasAqui' } },
      { caso: 'nueva de más de 72 bytes', body: { currentPassword: PASSWORD, newPassword: `A1${'ñ'.repeat(36)}` } },
    ])('$caso → 400 con VALIDATION_ERROR en español', async ({ body }) => {
      const dueno = await registerOwner('cambioinv');
      const r = await cambiar(dueno.token, body);
      expect(r.status).toBe(400);
      expect(r.body.code).toBe('VALIDATION_ERROR');
      expect(r.body.error).not.toMatch(/Required|Expected|Invalid|must contain/i);
    });

    it('exige sesión (401) y funciona para barbero y master (cada uno con la suya)', async () => {
      expect((await api().post('/api/v1/auth/change-password').send({ currentPassword: PASSWORD, newPassword: 'ClaveNueva2026' })).status).toBe(401);
      const dueno = await registerOwner('cambiorol');
      const barbero = await createEmployee(dueno.token, 'Barbero Cambia');
      expect((await cambiar(barbero.token, { currentPassword: PASSWORD, newPassword: 'ClaveNueva2026' })).status).toBe(200);
      const master = await createMaster();
      expect((await cambiar(master.token, { currentPassword: PASSWORD, newPassword: 'ClaveNueva2026' })).status).toBe(200);
    });

    it('no permite probar contraseñas sin freno: comparte el límite de intentos de acceso (429)', async () => {
      const app = await appCon({ AUTH_RATE_LIMIT_MAX: 2 });
      const mala = () => app.post('/api/v1/auth/change-password').set(auth(s.navaja.owner)).send({ currentPassword: 'Incorrecta1', newPassword: 'ClaveNueva2026' });
      expect((await mala()).status).toBe(400);
      expect((await mala()).status).toBe(400);
      expect((await mala()).status).toBe(429);
    });

    it('un token anterior al cambio se rechaza aunque no esté en la lista de revocados (se compara con la fecha del cambio)', async () => {
      const dueno = await registerOwner('cambiofecha');
      const otro = (await entrar(dueno.email, PASSWORD)).body.token;
      await dormir(1100);
      await prisma.user.update({ where: { email: dueno.email }, data: { sessionsValidFrom: new Date() } });
      expect((await api().get('/api/v1/auth/me').set(auth(otro))).status).toBe(401);
      expect((await api().get('/api/v1/auth/me').set(auth((await entrar(dueno.email, PASSWORD)).body.token))).status).toBe(200);
    });
  });
});
