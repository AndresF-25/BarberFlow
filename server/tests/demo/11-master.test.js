/**
 * Módulo 11 — Panel Master (GET /master/businesses y /master/users; solo el rol master).
 * Lee el seed (3 negocios demo) y lo que crea usa negocios @test.local nuevos.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  api, auth, registerOwner, createEmployee, requireSeed, demoSessions, biz, dataset,
} from './helpers-demo.js';

const negocios = (token, query = '') => api().get(`/api/v1/master/businesses${query}`).set(auth(token));
const usuarios = (token, query = '') => api().get(`/api/v1/master/users${query}`).set(auth(token));
const SIN_INGLES = /Required|Expected|Invalid|must contain|String must|Number must/i;
const CLAVES_NEGOCIO = ['address', 'createdAt', 'description', 'employees', 'id', 'inactiveEmployees', 'logo', 'name', 'owner', 'phone'];
const CLAVES_USUARIO = ['active', 'businessId', 'businessName', 'createdAt', 'email', 'id', 'name', 'role'];

describe('Módulo 11 · panel master', () => {
  let s;
  beforeAll(async () => { await requireSeed(); s = await demoSessions(); });

  describe('negocios', () => {
    it('lista los negocios con la forma exacta, del más nuevo al más antiguo, y el total', async () => {
      const r = await negocios(s.master);
      expect(r.status).toBe(200);
      expect(Object.keys(r.body).sort()).toEqual(['businesses', 'total']);
      expect(r.body.total).toBe(r.body.businesses.length);
      for (const b of r.body.businesses) {
        expect(Object.keys(b).sort()).toEqual(CLAVES_NEGOCIO);
        expect(new Date(b.createdAt).toISOString()).toBe(b.createdAt);
      }
      const fechas = r.body.businesses.map((b) => b.createdAt);
      expect(fechas).toEqual([...fechas].sort().reverse());
    });

    it('los tres negocios demo traen su dueño, su perfil y sus empleados activos e inactivos', async () => {
      const lista = (await negocios(s.master)).body.businesses;
      for (const key of ['navaja', 'fade', 'nueva']) {
        const d = biz(key);
        const b = lista.find((x) => x.name === d.name);
        expect(b, d.name).toBeTruthy();
        expect(b.owner).toEqual({ name: d.owner.name, email: d.owner.email });
        expect(b.employees, `${d.name} activos`).toBe(d.staff.filter((x) => x.active).length);
        expect(b.inactiveEmployees, `${d.name} inactivos`).toBe(d.staff.filter((x) => !x.active).length);
        expect(b).toMatchObject({ phone: d.phone, address: d.address });
      }
    });

    it('un negocio nuevo aparece primero y sus cifras se actualizan al dar de baja a un empleado', async () => {
      const d = await registerOwner('master11');
      const e1 = await createEmployee(d.token, 'Barbero Uno');
      await createEmployee(d.token, 'Barbero Dos');
      let b = (await negocios(s.master)).body.businesses[0];
      expect(b.id).toBe(d.business.id);
      expect(b).toMatchObject({ employees: 2, inactiveEmployees: 0, owner: { email: d.email } });
      await api().patch(`/api/v1/auth/employees/${e1.id}`).set(auth(d.token)).send({ active: false });
      b = (await negocios(s.master)).body.businesses.find((x) => x.id === d.business.id);
      expect(b).toMatchObject({ employees: 1, inactiveEmployees: 1 });
    });

    it('H76 [media]: la búsqueda no distingue mayúsculas ni tildes y también encuentra por el nombre o el correo del dueño', async () => {
      const esperado = biz('navaja').name;
      for (const q of ['navaja', 'NAVAJA', 'barberia la navaja', 'BARBERÍA LA NAVAJA', '  navaja  ', 'dueno.navaja', 'Andrés Morales', 'andres morales', 'morales']) {
        const r = await negocios(s.master, `?search=${encodeURIComponent(q)}`);
        expect(r.status, q).toBe(200);
        expect(r.body.businesses.map((b) => b.name), q).toContain(esperado);
      }
      const solo = await negocios(s.master, `?search=${encodeURIComponent('dueno.fade@demo')}`);
      expect(solo.body.businesses.map((b) => b.name)).toEqual([biz('fade').name]);
    });

    it('el total no cambia al buscar; sin coincidencias da lista vacía; %, _ y solo espacios se comportan', async () => {
      const todos = (await negocios(s.master)).body;
      const r = await negocios(s.master, '?search=zzzzzz');
      expect(r.body).toEqual({ businesses: [], total: todos.total });
      for (const q of ['%25', '_', '%25%25']) expect((await negocios(s.master, `?search=${q}`)).body.businesses, q).toEqual([]);
      expect((await negocios(s.master, '?search=%20%20')).body.businesses).toHaveLength(todos.businesses.length);
      expect((await negocios(s.master, '?search=a&search=b')).status).toBe(200);
    });

    it('una búsqueda de más de 100 caracteres da 400 en español', async () => {
      const r = await negocios(s.master, `?search=${'a'.repeat(101)}`);
      expect(r.status).toBe(400);
      expect(r.body.code).toBe('VALIDATION_ERROR');
      expect(r.body.error).not.toMatch(SIN_INGLES);
    });
  });

  describe('usuarios', () => {
    it('lista los usuarios con la forma exacta, con el nombre del negocio y si están activos, del más nuevo al más antiguo', async () => {
      const r = await usuarios(s.master);
      expect(r.status).toBe(200);
      expect(Object.keys(r.body).sort()).toEqual(['total', 'users']);
      expect(r.body.total).toBe(r.body.users.length);
      for (const u of r.body.users) expect(Object.keys(u).sort()).toEqual(CLAVES_USUARIO);
      const fechas = r.body.users.map((u) => u.createdAt);
      expect(fechas).toEqual([...fechas].sort().reverse());
    });

    it('H77 [media]: un empleado dado de baja se ve como inactivo (antes era indistinguible de uno activo)', async () => {
      const lista = (await usuarios(s.master)).body.users;
      const sebas = lista.find((u) => u.email === biz('navaja').staff.find((x) => x.key === 'sebas').email);
      expect(sebas).toMatchObject({ role: 'employee', active: false, businessName: biz('navaja').name });
      const julian = lista.find((u) => u.email === biz('navaja').staff.find((x) => x.key === 'julian').email);
      expect(julian.active).toBe(true);
    });

    it('el master aparece sin negocio; el dueño y los barberos traen el nombre de su negocio', async () => {
      const lista = (await usuarios(s.master)).body.users;
      const m = lista.find((u) => u.email === dataset.master.email);
      expect(m).toMatchObject({ role: 'master', businessId: null, businessName: null, active: true });
      const dueno = lista.find((u) => u.email === biz('fade').owner.email);
      expect(dueno).toMatchObject({ role: 'owner', businessName: biz('fade').name, name: biz('fade').owner.name });
    });

    it('filtra por rol y por negocio; combinados; un negocio inexistente da lista vacía', async () => {
      for (const role of ['master', 'owner', 'employee']) {
        const r = await usuarios(s.master, `?role=${role}`);
        expect(r.body.users.length, role).toBeGreaterThan(0);
        expect(r.body.users.every((u) => u.role === role), role).toBe(true);
      }
      const nav = (await negocios(s.master)).body.businesses.find((b) => b.name === biz('navaja').name);
      const todos = (await usuarios(s.master, `?businessId=${nav.id}`)).body.users;
      expect(todos).toHaveLength(1 + biz('navaja').staff.length);
      expect((await usuarios(s.master, `?businessId=${nav.id}&role=employee`)).body.users).toHaveLength(biz('navaja').staff.length);
      expect((await usuarios(s.master, `?businessId=${nav.id}&role=master`)).body.users).toEqual([]);
      expect((await usuarios(s.master, '?businessId=00000000-0000-4000-8000-000000000000')).body.users).toEqual([]);
      expect((await usuarios(s.master, '?businessId=no-es-uuid')).body.users).toEqual([]);
    });

    it('un rol desconocido da 400 en español (no 500)', async () => {
      for (const q of ['?role=superadmin', '?role=OWNER', '?role=%20', '?role=owner;x']) {
        const r = await usuarios(s.master, q);
        expect(r.status, q).toBe(400);
        expect(r.body.code).toBe('VALIDATION_ERROR');
        expect(r.body.error).not.toMatch(SIN_INGLES);
      }
      expect((await usuarios(s.master, '?role=')).status).toBe(200);
      expect((await usuarios(s.master, '?role=owner&role=employee')).status).toBe(200);
    });
  });

  describe('seguridad', () => {
    it('ninguna respuesta trae hashes, tokens ni marcas internas de sesión', async () => {
      const texto = JSON.stringify([(await negocios(s.master)).body, (await usuarios(s.master)).body]);
      expect(texto).not.toMatch(/passwordHash|password_hash|\$2[aby]\$|sessionsValidFrom|jti|token|isActive|businessId":"[^"]*","passw/);
    });

    it('propietarios, barberos y anónimos no acceden (403 FORBIDDEN / 401)', async () => {
      for (const ruta of ['businesses', 'users']) {
        for (const token of [s.navaja.owner, s.navaja.julian, s.fade.owner]) {
          const r = await api().get(`/api/v1/master/${ruta}`).set(auth(token));
          expect(r.status, ruta).toBe(403);
          expect(r.body.code).toBe('FORBIDDEN');
        }
        expect((await api().get(`/api/v1/master/${ruta}`)).status).toBe(401);
        expect((await api().get(`/api/v1/master/${ruta}`).set('Authorization', 'Bearer basura')).status).toBe(401);
      }
    });

    it('solo se puede leer: POST, PATCH y DELETE no existen (404)', async () => {
      for (const [metodo, ruta] of [['post', '/master/businesses'], ['patch', '/master/businesses/x'], ['delete', '/master/users/x'], ['post', '/master/users']]) {
        const r = await api()[metodo](`/api/v1${ruta}`).set(auth(s.master)).send({});
        expect(r.status, `${metodo} ${ruta}`).toBe(404);
      }
    });

    it('el master no opera sobre datos de un negocio: 403 NO_BUSINESS en todas las rutas de negocio', async () => {
      const rutas = ['/services', '/products', '/clients', '/appointments', '/product-sales', '/businesses/me', '/analytics/dashboard', '/analytics/alerts'];
      for (const ruta of rutas) {
        const r = await api().get(`/api/v1${ruta}`).set(auth(s.master));
        expect(r.status, ruta).toBe(403);
        expect(r.body.code, ruta).toBe('NO_BUSINESS');
      }
    });

    it('un barbero dado de baja pierde el acceso a todo, incluido el panel master (siempre 401/403)', async () => {
      const d = await registerOwner('masterbaja');
      const b = await createEmployee(d.token, 'Barbero Baja');
      await api().patch(`/api/v1/auth/employees/${b.id}`).set(auth(d.token)).send({ active: false });
      expect((await api().get('/api/v1/master/users').set(auth(b.token))).status).toBe(401);
    });
  });
});
