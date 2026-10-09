/**
 * Módulo 12 — Pruebas grupales (todo el sistema a la vez; T-12).
 *   a) Recorrido integral: registro → servicio → barbero → producto → cita → finalizar → venta → analíticas → master.
 *   b) Permisos: dueño, barbero, master y anónimo contra TODOS los endpoints montados. Un inventario
 *      automático lee las rutas de Express y falla si aparece una que la matriz no cubre (o sobra una).
 *   c) Aislamiento: tokens de La Navaja contra los ids de El Fade y Barbería Nueva, en cada recurso y lista,
 *      y los datos ajenos quedan idénticos fila por fila.
 * Lo que crea usa negocios @test.local nuevos; los negocios demo se leen y se atacan, pero no deben cambiar.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import express, { Router } from 'express';
import { app } from '../helpers.js';
import {
  api, auth, prisma, PASSWORD, registerOwner, createEmployee, createService, createAppointment,
  bizDay, requireSeed, demoSessions, loginDemo, biz, dataset,
} from './helpers-demo.js';

const V1 = '/api/v1';
const ID_INEXISTENTE = '00000000-0000-4000-8000-000000000000';
const RANGO = '?from=2020-01-01&to=2035-12-31';

const pedir = (metodo, ruta, token, cuerpo) => {
  let r = api()[metodo](ruta);
  if (token) r = r.set(auth(token));
  return cuerpo === undefined ? r : r.send(cuerpo);
};
const leer = async (token, ruta, clave) => {
  const r = await pedir('get', `${V1}${ruta}`, token);
  expect(r.status, `GET ${ruta}`).toBe(200);
  return r.body[clave];
};
const SIN_INGLES = /Required|Expected|Invalid|must contain|String must|Number must/i;

/* ───────────────────────── inventario de rutas ───────────────────────── */

/** Todas las rutas (MÉTODO /ruta/:param) que una app de Express tiene montadas. */
function rutasDe(aplicacion) {
  const claves = new Set();
  const montaje = (capa) => capa.regexp.source.replace('^\\/', '/').replace('\\/?(?=\\/|$)', '').replace(/\\\//g, '/');
  const recorrer = (pila, prefijo) => {
    for (const capa of pila) {
      if (capa.route) {
        for (const ruta of [].concat(capa.route.path)) {
          const completa = `${prefijo}${ruta === '/' ? '' : ruta}`;
          for (const [metodo, activo] of Object.entries(capa.route.methods)) {
            if (activo) claves.add(`${metodo.toUpperCase()} ${completa}`);
          }
        }
      } else if (capa.name === 'router' && capa.handle.stack) {
        recorrer(capa.handle.stack, prefijo + montaje(capa));
      }
    }
  };
  recorrer(aplicacion._router.stack, '');
  return [...claves].sort();
}

/* ───────────────────────── matriz de permisos ─────────────────────────
 * Lo esperado por actor: OK = pasa los permisos (el resultado puede ser 400/404 porque se envía un cuerpo vacío
 * y un id inexistente: lo que importa es que no sea 401/403 ni 500), U = 401, F = 403 FORBIDDEN, NB = 403 NO_BUSINESS.
 * Fuente: README.md §«Roles y permisos» y el orden de los middleware de cada ruta. */
const OK = 'ok'; const U = 'UNAUTHORIZED'; const F = 'FORBIDDEN'; const NB = 'NO_BUSINESS';
const ACTORES = ['anónimo', 'dueño', 'barbero', 'master'];
//            ruta                                          anónimo dueño barbero master
const MATRIZ = [
  ['GET /health',                                           OK, OK, OK, OK],
  [`GET ${V1}/health`,                                      OK, OK, OK, OK],
  [`POST ${V1}/auth/register`,                              OK, OK, OK, OK],
  [`POST ${V1}/auth/login`,                                 OK, OK, OK, OK],
  [`POST ${V1}/auth/logout`,                                OK, OK, OK, OK],
  [`GET ${V1}/auth/me`,                                     U,  OK, OK, OK],
  [`POST ${V1}/auth/change-password`,                       U,  OK, OK, OK],
  [`GET ${V1}/auth/employees`,                              U,  OK, OK, NB],
  [`POST ${V1}/auth/employees`,                             U,  OK, F,  F],
  [`PATCH ${V1}/auth/employees/:id`,                        U,  OK, F,  F],
  [`GET ${V1}/businesses/me`,                               U,  OK, OK, NB],
  [`PATCH ${V1}/businesses/me`,                             U,  OK, F,  F],
  [`GET ${V1}/clients`,                                     U,  OK, OK, NB],
  [`GET ${V1}/clients/:id`,                                 U,  OK, OK, NB],
  [`PATCH ${V1}/clients/:id`,                               U,  OK, F,  NB],
  [`GET ${V1}/services`,                                    U,  OK, OK, NB],
  [`POST ${V1}/services`,                                   U,  OK, F,  NB],
  [`PATCH ${V1}/services/:id`,                              U,  OK, F,  NB],
  [`DELETE ${V1}/services/:id`,                             U,  OK, F,  NB],
  [`GET ${V1}/products`,                                    U,  OK, OK, NB],
  [`POST ${V1}/products`,                                   U,  OK, F,  NB],
  [`PATCH ${V1}/products/:id`,                              U,  OK, F,  NB],
  [`DELETE ${V1}/products/:id`,                             U,  OK, F,  NB],
  [`GET ${V1}/products/:id/stock-history`,                  U,  OK, F,  NB],
  [`POST ${V1}/products/:id/adjust-stock`,                  U,  OK, F,  NB],
  [`GET ${V1}/appointments`,                                U,  OK, OK, NB],
  [`POST ${V1}/appointments`,                               U,  OK, OK, NB],
  [`PATCH ${V1}/appointments/:id`,                          U,  OK, OK, NB],
  [`GET ${V1}/product-sales`,                               U,  OK, OK, NB],
  [`POST ${V1}/product-sales`,                              U,  OK, OK, NB],
  [`GET ${V1}/analytics/dashboard`,                         U,  OK, F,  NB],
  [`GET ${V1}/analytics/revenue`,                           U,  OK, F,  NB],
  [`GET ${V1}/analytics/metrics`,                           U,  OK, F,  NB],
  [`GET ${V1}/analytics/alerts`,                            U,  OK, F,  NB],
  [`GET ${V1}/master/businesses`,                           U,  F,  F,  OK],
  [`GET ${V1}/master/users`,                                U,  F,  F,  OK],
];

function verificar(r, esperado, quien) {
  const detalle = `${quien}: ${r.status} ${JSON.stringify(r.body).slice(0, 160)}`;
  expect(r.status, detalle).toBeLessThan(500);
  if (esperado === OK) {
    expect([401, 403], detalle).not.toContain(r.status);
  } else if (esperado === U) {
    expect(r.status, detalle).toBe(401);
    expect(r.body.code, detalle).toBe('UNAUTHORIZED');
  } else {
    expect(r.status, detalle).toBe(403);
    expect(r.body.code, detalle).toBe(esperado);
  }
}

/* ───────────────────────── foto de un negocio (para comprobar que no cambió) ───────────────────────── */
async function foto(businessId) {
  const donde = { businessId };
  const porId = { orderBy: { id: 'asc' } };
  return JSON.stringify({
    negocio: await prisma.business.findUnique({ where: { id: businessId } }),
    usuarios: await prisma.user.findMany({ where: donde, include: { staffProfile: true }, ...porId }),
    clientes: await prisma.client.findMany({ where: donde, ...porId }),
    servicios: await prisma.service.findMany({ where: donde, ...porId }),
    productos: await prisma.product.findMany({ where: donde, ...porId }),
    citas: await prisma.appointment.findMany({ where: donde, ...porId }),
    cobros: await prisma.serviceTransaction.findMany({ where: donde, ...porId }),
    ventas: await prisma.productSale.findMany({ where: donde, ...porId }),
    ajustes: await prisma.stockAdjustment.findMany({ where: { product: { businessId } }, ...porId }),
  });
}

describe('Módulo 12 · pruebas grupales', () => {
  let s;
  beforeAll(async () => { await requireSeed(); s = await demoSessions(); });

  /* ═════════════════════ a) recorrido integral ═════════════════════ */
  describe('a) recorrido integral de un negocio nuevo', () => {
    const e = {}; // estado compartido entre pasos (se ejecutan en orden)
    const hoy = bizDay(0);
    const manana = bizDay(1);

    it('1. registro: el dueño entra con su negocio y su rol', async () => {
      e.dueno = await registerOwner('grupal');
      const me = await pedir('get', `${V1}/auth/me`, e.dueno.token);
      expect(me.status).toBe(200);
      expect(me.body.user).toMatchObject({ email: e.dueno.email, role: 'owner' });
      expect(me.body.business.id).toBe(e.dueno.business.id);
    });

    it('2. servicio: el dueño crea un servicio y aparece en el catálogo', async () => {
      e.servicio = await createService(e.dueno.token, { nombre: 'Corte grupal', precio: 30000, duracion: 45 });
      const lista = await leer(e.dueno.token, '/services', 'services');
      expect(lista.map((x) => x.id)).toEqual([e.servicio.id]);
      expect(lista[0]).toMatchObject({ nombre: 'Corte grupal', precio: 30000, duracion: 45 });
    });

    it('3. barbero: el dueño crea un barbero y este entra con su propio token', async () => {
      e.barbero = await createEmployee(e.dueno.token, 'Barbero Grupal');
      expect(e.barbero.token).toBeTruthy();
      const equipo = await leer(e.dueno.token, '/auth/employees', 'employees');
      expect(equipo.map((x) => x.id)).toEqual([e.barbero.id]);
      const me = await pedir('get', `${V1}/auth/me`, e.barbero.token);
      expect(me.body.user.role).toBe('employee');
      expect(me.body.business.id).toBe(e.dueno.business.id);
    });

    it('4. producto: el dueño lo da de alta; el barbero lo ve, pero sin el precio de costo', async () => {
      const r = await pedir('post', `${V1}/products`, e.dueno.token, {
        nombre: 'Cera grupal', categoria: 'Cuidado', stock: 10, stockMinimo: 2, unidad: 'unidad', precioVenta: 20000, precioCosto: 9000,
      });
      expect(r.status).toBe(201);
      e.producto = r.body.product;
      expect(e.producto.precioCosto).toBe(9000);
      const vistoPorBarbero = (await leer(e.barbero.token, '/products', 'products'))[0];
      expect(vistoPorBarbero).toMatchObject({ id: e.producto.id, precioVenta: 20000 });
      expect(vistoPorBarbero).not.toHaveProperty('precioCosto');
    });

    it('5. cita: el barbero agenda una para mañana y la ficha del cliente se crea sola', async () => {
      const r = await createAppointment(e.barbero.token, {
        serviceId: e.servicio.id, employeeId: e.barbero.id, date: manana, time: '10:00', clientName: 'Cliente Grupal', clientPhone: '3105550101',
      });
      expect(r.status, JSON.stringify(r.body)).toBe(201);
      e.cita = r.body.appointment;
      expect(e.cita).toMatchObject({ estado: 'Pendiente', hora: '10:00', employeeId: e.barbero.id });
      const fichas = await leer(e.dueno.token, '/clients?search=Cliente%20Grupal', 'clients');
      expect(fichas).toHaveLength(1);
      e.cliente = fichas[0];
    });

    it('6. finalizar: el dueño cobra la cita en efectivo y queda el valor del servicio', async () => {
      const r = await pedir('patch', `${V1}/appointments/${e.cita.id}`, e.dueno.token, { status: 'completed', paymentMethod: 'cash' });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.appointment).toMatchObject({ estado: 'Finalizada', valor: 30000 });
      expect(r.body.appointment.metodoPago).toBeTruthy();
      // una finalizada no se reabre ni se cancela
      const otra = await pedir('patch', `${V1}/appointments/${e.cita.id}`, e.dueno.token, { status: 'cancelled' });
      expect(otra.status).toBe(400);
      expect(otra.body.code).toBe('INVALID_STATUS');
    });

    it('7. cliente: la ficha suma la visita y su historial lista el servicio', async () => {
      const ficha = await pedir('get', `${V1}/clients/${e.cliente.id}`, e.dueno.token);
      expect(ficha.status).toBe(200);
      expect(ficha.body.client.visitas).toBe(1);
      expect(ficha.body.historial.map((h) => h.tipo)).toContain('servicio');
    });

    it('8. venta: el dueño vende 2 unidades a esa ficha; el stock baja y el historial cuadra', async () => {
      const r = await pedir('post', `${V1}/product-sales`, e.dueno.token, { productId: e.producto.id, quantity: 2, clientId: e.cliente.id });
      expect(r.status, JSON.stringify(r.body)).toBe(201);
      e.venta = r.body.venta;
      expect(e.venta).toMatchObject({ cantidad: 2, precioUnitario: 20000, total: 40000, cliente: 'Cliente Grupal', fecha: hoy });

      const [producto] = await leer(e.dueno.token, '/products', 'products');
      expect(producto.stock).toBe(8);
      const historial = await pedir('get', `${V1}/products/${e.producto.id}/stock-history`, e.dueno.token);
      expect(historial.body.total).toBe(2);
      expect(historial.body.movements.reduce((suma, m) => suma + m.cambio, 0)).toBe(8); // invariante: suma de ajustes = stock
      expect(historial.body.movements[0]).toMatchObject({ cambio: -2, saldo: 8, ventaId: e.venta.id });

      const sinStock = await pedir('post', `${V1}/product-sales`, e.dueno.token, { productId: e.producto.id, quantity: 9 });
      expect(sinStock.status).toBe(400);
      expect(sinStock.body.code).toBe('INSUFFICIENT_STOCK');
      expect((await leer(e.dueno.token, '/products', 'products'))[0].stock).toBe(8);

      const ficha = await pedir('get', `${V1}/clients/${e.cliente.id}`, e.dueno.token);
      expect(ficha.body.historial.map((h) => h.tipo).sort()).toEqual(['producto', 'servicio']);
    });

    it('9. analíticas: los ingresos de hoy suman el cobro y la venta; el barbero no las ve', async () => {
      const panel = await pedir('get', `${V1}/analytics/dashboard`, e.dueno.token);
      expect(panel.status).toBe(200);
      expect(panel.body).toMatchObject({ date: hoy, citasHoy: 0, ingresosHoy: 70000 });
      const delDia = await pedir('get', `${V1}/analytics/dashboard?date=${manana}`, e.dueno.token);
      expect(delDia.body).toMatchObject({ citasHoy: 1, finalizadas: 1, pendientes: 0 });

      const ingresos = await pedir('get', `${V1}/analytics/revenue?period=month`, e.dueno.token);
      expect(ingresos.status).toBe(200);
      expect(ingresos.body.resumen).toMatchObject({ ingresosMes: 70000, serviciosRealizados: 1, ticketPromedio: 30000 });
      expect(ingresos.body.resumen.servicioTop).toMatchObject({ nombre: 'Corte grupal', ingresos: 30000 });
      expect((await pedir('get', `${V1}/analytics/alerts`, e.dueno.token)).status).toBe(200);

      for (const ruta of ['dashboard', 'revenue', 'metrics', 'alerts']) {
        const r = await pedir('get', `${V1}/analytics/${ruta}`, e.barbero.token);
        expect(r.status, ruta).toBe(403);
      }
    });

    it('10. master: ve el negocio nuevo con su dueño y su barbero, pero no entra a los datos del negocio', async () => {
      const negocios = await pedir('get', `${V1}/master/businesses`, s.master);
      const mio = negocios.body.businesses.find((b) => b.id === e.dueno.business.id);
      expect(mio).toMatchObject({ owner: { email: e.dueno.email }, employees: 1, inactiveEmployees: 0 });
      expect(negocios.body.total).toBe(negocios.body.businesses.length);

      const usuarios = await pedir('get', `${V1}/master/users?businessId=${e.dueno.business.id}`, s.master);
      expect(usuarios.body.users.map((u) => u.role).sort()).toEqual(['employee', 'owner']);

      for (const ruta of ['/appointments', '/clients', '/products', '/product-sales', '/services']) {
        const r = await pedir('get', `${V1}${ruta}`, s.master);
        expect(r.status, ruta).toBe(403);
        expect(r.body.code, ruta).toBe('NO_BUSINESS');
      }
    });

    it('11. cierre de sesión: el token del dueño deja de servir', async () => {
      const salida = await pedir('post', `${V1}/auth/logout`, e.dueno.token);
      expect(salida.status).toBe(200);
      const despues = await pedir('get', `${V1}/auth/me`, e.dueno.token);
      expect(despues.status).toBe(401);
    });
  });

  /* ═════════════════════ b) permisos por rol × todos los endpoints ═════════════════════ */
  describe('b) permisos por rol en todos los endpoints', () => {
    let tokens; let credenciales;
    beforeAll(async () => {
      const dueno = await registerOwner('grupb');
      const barbero = await createEmployee(dueno.token, 'Barbero B');
      tokens = { 'anónimo': null, 'dueño': dueno.token, barbero: barbero.token, master: s.master };
      credenciales = {
        'dueño': { email: dueno.email, password: PASSWORD },
        barbero: { email: barbero.email, password: PASSWORD },
        master: { email: dataset.master.email },
      };
    });

    /** Un token nuevo (el logout revoca el que usa; así no se arruina el compartido). */
    const tokenFresco = async (actor) => {
      if (actor === 'anónimo') return null;
      const { email, password } = credenciales[actor];
      const r = await loginDemo(email, password);
      expect(r.status, `login de ${actor}`).toBe(200);
      return r.token;
    };

    describe('inventario de rutas', () => {
      it('el detector encuentra rutas directas, montadas y con parámetros (prueba de su propio detector)', () => {
        const mini = express();
        mini.get('/directa', (_req, res) => res.end());
        mini.post(['/a', '/b'], (_req, _res, next) => next());
        mini.use('/api/v1/nueva', Router().get('/', (_req, res) => res.end()).delete('/:id/sub', (_req, res) => res.end()));
        expect(rutasDe(mini)).toEqual(['DELETE /api/v1/nueva/:id/sub', 'GET /api/v1/nueva', 'GET /directa', 'POST /a', 'POST /b']);
      });

      it('toda ruta montada tiene su fila en la matriz de permisos, y no sobra ninguna', () => {
        const montadas = rutasDe(app);
        const cubiertas = MATRIZ.map(([clave]) => clave).sort();
        expect(montadas.length).toBeGreaterThan(30);
        expect(montadas.filter((r) => !cubiertas.includes(r)), 'rutas SIN cubrir: añádelas a la matriz con sus permisos').toEqual([]);
        expect(cubiertas.filter((r) => !montadas.includes(r)), 'filas de la matriz sin ruta montada').toEqual([]);
        expect(new Set(cubiertas).size, 'filas repetidas').toBe(cubiertas.length);
      });
    });

    describe('matriz anónimo / dueño / barbero / master', () => {
      for (const [clave, ...esperado] of MATRIZ) {
        it(clave, async () => {
          const [metodo, ruta] = clave.split(' ');
          const cuerpo = ['POST', 'PATCH'].includes(metodo) ? {} : undefined;
          for (const [i, actor] of ACTORES.entries()) {
            const token = clave === `POST ${V1}/auth/logout` ? await tokenFresco(actor) : tokens[actor];
            const r = await pedir(metodo.toLowerCase(), ruta.replace(/:id/g, ID_INEXISTENTE), token, cuerpo);
            verificar(r, esperado[i], `${clave} como ${actor}`);
          }
        });
      }
    });

    describe('alcance de datos del barbero (solo lo suyo)', () => {
      it('ve y cambia solo sus citas y sus ventas; el dueño ve todo', async () => {
        const dueno = await registerOwner('grupc');
        const b1 = await createEmployee(dueno.token, 'Barbero Uno');
        const b2 = await createEmployee(dueno.token, 'Barbero Dos');
        const servicio = await createService(dueno.token, { nombre: 'Corte c', duracion: 30 });
        const producto = (await pedir('post', `${V1}/products`, dueno.token, {
          nombre: 'Gel c', categoria: 'Cuidado', stock: 10, stockMinimo: 1, unidad: 'unidad', precioVenta: 15000, precioCosto: 6000,
        })).body.product;

        const c1 = (await createAppointment(b1.token, { serviceId: servicio.id, employeeId: b1.id, date: bizDay(1), time: '09:00', clientName: 'Cliente Uno', clientPhone: '3105550201' })).body.appointment;
        const c2 = (await createAppointment(b2.token, { serviceId: servicio.id, employeeId: b2.id, date: bizDay(1), time: '09:00', clientName: 'Cliente Dos', clientPhone: '3105550202' })).body.appointment;

        // citas: cada barbero solo ve las suyas; el dueño las dos
        const idsDe = async (token) => (await leer(token, `/appointments${RANGO}`, 'appointments')).map((c) => c.id).sort();
        expect(await idsDe(b1.token)).toEqual([c1.id]);
        expect(await idsDe(b2.token)).toEqual([c2.id]);
        expect(await idsDe(dueno.token)).toEqual([c1.id, c2.id].sort());

        // no puede cambiar la cita de su compañero (403) y sí la suya
        const ajena = await pedir('patch', `${V1}/appointments/${c2.id}`, b1.token, { status: 'confirmed' });
        expect(ajena.status).toBe(403);
        expect(ajena.body.code).toBe('FORBIDDEN');
        expect((await pedir('patch', `${V1}/appointments/${c1.id}`, b1.token, { status: 'confirmed' })).status).toBe(200);

        // al agendar, aunque pida a otro barbero, la cita queda a su nombre
        const forzada = await createAppointment(b1.token, { serviceId: servicio.id, employeeId: b2.id, date: bizDay(2), time: '09:00', clientName: 'Cliente Tres', clientPhone: '3105550203' });
        expect(forzada.status).toBe(201);
        expect(forzada.body.appointment.employeeId).toBe(b1.id);

        // ventas: cada barbero ve las suyas
        for (const b of [b1, b2]) {
          const v = await pedir('post', `${V1}/product-sales`, b.token, { productId: producto.id, quantity: 1 });
          expect(v.status, JSON.stringify(v.body)).toBe(201);
        }
        const ventasB1 = await leer(b1.token, '/product-sales', 'ventas');
        expect(ventasB1).toHaveLength(1);
        expect(ventasB1[0].vendedor).toBe('Barbero Uno');
        expect(await leer(dueno.token, '/product-sales', 'ventas')).toHaveLength(2);

        // costos y rentabilidad: solo el dueño
        expect((await leer(dueno.token, '/products', 'products'))[0]).toHaveProperty('precioCosto');
        expect((await leer(b1.token, '/products', 'products'))[0]).not.toHaveProperty('precioCosto');
        expect((await pedir('get', `${V1}/products/${producto.id}/stock-history`, b1.token)).status).toBe(403);
      });
    });

    it('ningún rechazo de permisos deja un error en inglés ni un 500', async () => {
      for (const [clave, ...esperado] of MATRIZ) {
        const [metodo, ruta] = clave.split(' ');
        for (const [i, actor] of ACTORES.entries()) {
          if (esperado[i] === OK || esperado[i] === U || clave.endsWith('/logout')) continue;
          const r = await pedir(metodo.toLowerCase(), ruta.replace(/:id/g, ID_INEXISTENTE), tokens[actor], ['POST', 'PATCH'].includes(metodo) ? {} : undefined);
          expect(r.body.error, `${clave} como ${actor}`).toMatch(/permiso|negocio/i);
          expect(r.body.error, `${clave} como ${actor}`).not.toMatch(SIN_INGLES);
        }
      }
    });
  });

  /* ═════════════════════ c) aislamiento entre negocios ═════════════════════ */
  describe('c) aislamiento: La Navaja contra El Fade y Barbería Nueva', () => {
    const ajenos = {}; // ids de cada negocio ajeno
    const antes = {};
    let propio; // un producto de La Navaja (para probar una venta con cliente ajeno)

    beforeAll(async () => {
      for (const [clave, token] of [['fade', s.fade.owner], ['nueva', s.nueva.owner]]) {
        const me = await pedir('get', `${V1}/auth/me`, token);
        const ids = async (ruta, campo) => (await leer(token, ruta, campo)).map((x) => x.id);
        ajenos[clave] = {
          negocio: me.body.business.id,
          duenoId: me.body.user.id,
          services: await ids('/services', 'services'),
          products: await ids('/products', 'products'),
          clients: await ids('/clients', 'clients'),
          appointments: await ids(`/appointments${RANGO}`, 'appointments'),
          ventas: await ids('/product-sales', 'ventas'),
          employees: await ids('/auth/employees?includeInactive=true', 'employees'),
        };
        antes[clave] = await foto(me.body.business.id);
      }
      propio = (await leer(s.navaja.owner, '/products', 'products'))[0];
    });

    it('El Fade tiene datos de cada recurso y Barbería Nueva es un negocio vacío tal como dice el dataset (la prueba no es vacía donde importa)', () => {
      for (const recurso of ['services', 'products', 'clients', 'employees', 'appointments', 'ventas']) {
        expect(ajenos.fade[recurso].length, `fade.${recurso}`).toBeGreaterThan(0);
      }
      const nueva = biz('nueva');
      const esperados = { services: nueva.services, products: nueva.products, clients: nueva.clients, employees: nueva.staff, appointments: nueva.appointments, ventas: nueva.sales };
      for (const [recurso, filas] of Object.entries(esperados)) {
        expect(ajenos.nueva[recurso].length, `nueva.${recurso}`).toBe(filas.length);
      }
      expect(ajenos.nueva.duenoId).toBeTruthy();
      expect(propio, 'producto de La Navaja').toBeTruthy();
    });

    /**
     * Ataques contra los ids de un negocio ajeno: [nombre, método, ruta, cuerpo]. Solo se atacan los recursos
     * que el negocio tiene; contra el dueño del negocio ajeno siempre (un dueño no es un «empleado»: 404).
     */
    const ataques = (a) => {
      const [cliente] = a.clients; const [servicio] = a.services; const [producto] = a.products;
      const [empleado] = a.employees; const [cita] = a.appointments;
      return [
        ['cambiar al dueño ajeno como si fuera empleado', 'patch', `/auth/employees/${a.duenoId}`, { active: false }],
        ...(cliente ? [
          ['ver cliente', 'get', `/clients/${cliente}`],
          ['editar cliente', 'patch', `/clients/${cliente}`, { name: 'Intruso' }],
          ['vender con una ficha ajena', 'post', '/product-sales', { productId: 'PROPIO', quantity: 1, clientId: cliente }],
        ] : []),
        ...(servicio ? [
          ['editar servicio', 'patch', `/services/${servicio}`, { precio: 1 }],
          ['eliminar servicio', 'delete', `/services/${servicio}`],
        ] : []),
        ...(producto ? [
          ['editar producto', 'patch', `/products/${producto}`, { stock: 0 }],
          ['eliminar producto', 'delete', `/products/${producto}`],
          ['historial de stock', 'get', `/products/${producto}/stock-history`],
          ['ajustar stock', 'post', `/products/${producto}/adjust-stock`, { delta: 5 }],
          ['vender un producto ajeno', 'post', '/product-sales', { productId: producto, quantity: 1 }],
        ] : []),
        ...(empleado ? [['cambiar empleado', 'patch', `/auth/employees/${empleado}`, { active: false }]] : []),
        ...(servicio && empleado ? [['agendar con servicio y barbero ajenos', 'post', '/appointments', {
          clientName: 'Intruso', clientPhone: '', serviceId: servicio, employeeId: empleado, appointmentDate: bizDay(1), startTime: '10:00',
        }]] : []),
        ...(cita ? [['cambiar cita', 'patch', `/appointments/${cita}`, { status: 'cancelled' }]] : []),
      ];
    };

    const lanzar = (token, [, metodo, ruta, cuerpo]) => {
      const c = cuerpo && cuerpo.productId === 'PROPIO' ? { ...cuerpo, productId: propio.id } : cuerpo;
      return pedir(metodo, `${V1}${ruta}`, token, c);
    };

    for (const clave of ['fade', 'nueva']) {
      it(`el dueño de La Navaja no ve ni toca nada de ${clave === 'fade' ? 'El Fade' : 'Barbería Nueva'}: 404 en cada recurso`, async () => {
        for (const ataque of ataques(ajenos[clave])) {
          const r = await lanzar(s.navaja.owner, ataque);
          expect(r.status, `${ataque[0]}: ${JSON.stringify(r.body)}`).toBe(404);
          expect(r.body.code, ataque[0]).toBe('NOT_FOUND');
        }
      });

      it(`un barbero de La Navaja tampoco (404, o 403 si la acción es solo del dueño) — ${clave}`, async () => {
        for (const ataque of ataques(ajenos[clave])) {
          const r = await lanzar(s.navaja.julian, ataque);
          expect([403, 404], `${ataque[0]}: ${r.status} ${JSON.stringify(r.body)}`).toContain(r.status);
          expect(['FORBIDDEN', 'NOT_FOUND'], ataque[0]).toContain(r.body.code);
        }
      });

      it(`el master no entra a las rutas del negocio (403) con ids de ${clave}`, async () => {
        for (const ataque of ataques(ajenos[clave])) {
          const r = await lanzar(s.master, ataque);
          expect(r.status, `${ataque[0]}: ${JSON.stringify(r.body)}`).toBe(403);
          expect(['NO_BUSINESS', 'FORBIDDEN'], ataque[0]).toContain(r.body.code);
        }
      });

      it(`las listas de La Navaja nunca traen ids de ${clave}`, async () => {
        const a = ajenos[clave];
        for (const [nombre, token] of [['dueño', s.navaja.owner], ['barbero', s.navaja.julian]]) {
          const listas = {
            services: await leer(token, '/services', 'services'),
            products: await leer(token, '/products', 'products'),
            clients: await leer(token, '/clients', 'clients'),
            appointments: await leer(token, `/appointments${RANGO}`, 'appointments'),
            ventas: await leer(token, '/product-sales', 'ventas'),
            employees: await leer(token, '/auth/employees', 'employees'),
          };
          for (const [recurso, filas] of Object.entries(listas)) {
            const cruzados = filas.map((x) => x.id).filter((id) => a[recurso].includes(id));
            expect(cruzados, `${nombre} · ${recurso}`).toEqual([]);
          }
        }
      });

      it(`filtrar por un barbero o un negocio de ${clave} no devuelve sus datos`, async () => {
        const porBarbero = await leer(s.navaja.owner, `/appointments${RANGO}&employeeId=${ajenos[clave].employees[0]}`, 'appointments');
        expect(porBarbero).toEqual([]);
        const usuarios = await pedir('get', `${V1}/master/users?businessId=${ajenos[clave].negocio}`, s.navaja.owner);
        expect(usuarios.status).toBe(403);
        expect((await pedir('get', `${V1}/master/businesses`, s.navaja.owner)).status).toBe(403);
      });
    }

    it('después de todos los ataques, los datos de El Fade y de Barbería Nueva son idénticos fila por fila', async () => {
      for (const clave of ['fade', 'nueva']) {
        expect(await foto(ajenos[clave].negocio), `${clave} cambió`).toBe(antes[clave]);
      }
    });

    it('los tres negocios demo siguen siendo los del dataset (nombres y dueños)', async () => {
      const lista = (await pedir('get', `${V1}/master/businesses`, s.master)).body.businesses;
      for (const key of ['navaja', 'fade', 'nueva']) {
        const d = biz(key);
        expect(lista.find((b) => b.name === d.name)?.owner.email, d.name).toBe(d.owner.email);
      }
    });
  });
});
