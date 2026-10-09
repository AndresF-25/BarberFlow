/**
 * Módulo 9 — Ventas de productos (GET/POST /product-sales).
 * Lee las tres barberías demo en solo lectura; lo que crea o modifica usa negocios @test.local nuevos.
 * Valores esperados calculados desde el dataset.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  api, auth, prisma, registerOwner, createEmployee, requireSeed, demoSessions, bizDay, biz, hoy,
} from './helpers-demo.js';
import { addDays } from '../../src/lib/utils.js';

const listar = (token, query = '') => api().get(`/api/v1/product-sales${query}`).set(auth(token));
const vender = (token, body) => api().post('/api/v1/product-sales').set(auth(token)).send(body);
const crearProducto = (token, over = {}) => api().post('/api/v1/products').set(auth(token))
  .send({ nombre: 'Cera', categoria: 'Styling', stock: 10, stockMinimo: 2, unidad: 'unidad', precioVenta: 28000, precioCosto: 15000, ...over });
const CLAVES = ['cantidad', 'cliente', 'fecha', 'hora', 'id', 'precioUnitario', 'producto', 'productoId', 'total', 'vendedor'];
const SIN_INGLES = /Required|Expected|Invalid|must contain|String must|Number must/i;
const NOMBRE_VENDEDOR = { owner: 'Andrés Morales', julian: 'Julián Patiño', camilo: 'Camilo Reyes' };

const montar = async (label, { stock = 10 } = {}) => {
  const d = await registerOwner(label);
  const barbero = await createEmployee(d.token, `Barbero ${label}`);
  const p = (await crearProducto(d.token, { nombre: `Cera ${label}`, stock })).body.product;
  const stockDe = async () => (await prisma.product.findUnique({ where: { id: p.id } })).stock;
  const sumaAjustes = async () => (await prisma.stockAdjustment.aggregate({ where: { productId: p.id }, _sum: { delta: true } }))._sum.delta || 0;
  return { d, barbero, p, stockDe, sumaAjustes };
};

describe('Módulo 9 · ventas de productos', () => {
  let s;
  beforeAll(async () => { await requireSeed(); s = await demoSessions(); });

  describe('historial de los datos demo (solo lectura)', () => {
    const navaja = () => biz('navaja');
    const producto = (key) => navaja().products.find((p) => p.key === key);
    const cliente = (key) => navaja().clients.find((c) => c.key === key)?.name || '';

    it('La Navaja: lista todas sus ventas con la forma exacta, de la más reciente a la más antigua', async () => {
      const r = await listar(s.navaja.owner);
      expect(r.status).toBe(200);
      expect(Object.keys(r.body)).toEqual(['ventas']);
      expect(r.body.ventas).toHaveLength(navaja().sales.length);
      for (const v of r.body.ventas) expect(Object.keys(v).sort()).toEqual(CLAVES);
      const claves = r.body.ventas.map((v) => `${v.fecha} ${v.hora}`);
      expect(claves).toEqual([...claves].sort().reverse());
      expect(JSON.stringify(r.body)).not.toMatch(/soldById|businessId|Cents/);
    });

    it('cada venta coincide con el dataset: producto, cantidad, precio, total, cliente, fecha y vendedor', async () => {
      const ventas = (await listar(s.navaja.owner)).body.ventas;
      const esperadas = navaja().sales.map((v) => ({
        producto: producto(v.product).nombre, cantidad: v.qty, precioUnitario: producto(v.product).precioVenta,
        total: v.qty * producto(v.product).precioVenta, cliente: v.client ? cliente(v.client) : '', fecha: v.date, vendedor: NOMBRE_VENDEDOR[v.seller],
      }));
      const clave = (v) => JSON.stringify([v.fecha, v.producto, v.cantidad, v.cliente, v.vendedor]);
      expect(ventas.map(clave).sort()).toEqual(esperadas.map(clave).sort());
      for (const e of esperadas) {
        const v = ventas.find((x) => clave(x) === clave(e));
        expect(v, clave(e)).toMatchObject({ precioUnitario: e.precioUnitario, total: e.total });
      }
      expect(ventas.reduce((n, v) => n + v.total, 0)).toBe(esperadas.reduce((n, e) => n + e.total, 0));
    });

    it('?from y ?to filtran por día (inclusive) y los conteos coinciden con el dataset', async () => {
      const desde = addDays(hoy, -30);
      const hasta = addDays(hoy, -3);
      const esperado = navaja().sales.filter((v) => v.date >= desde && v.date <= hasta).length;
      expect((await listar(s.navaja.owner, `?from=${desde}&to=${hasta}`)).body.ventas).toHaveLength(esperado);
      expect((await listar(s.navaja.owner, `?from=${hoy}&to=${hoy}`)).body.ventas).toHaveLength(navaja().sales.filter((v) => v.date === hoy).length);
      expect((await listar(s.navaja.owner, `?from=${addDays(hoy, -10)}`)).body.ventas).toHaveLength(navaja().sales.filter((v) => v.date >= addDays(hoy, -10)).length);
      expect((await listar(s.navaja.owner, `?to=${addDays(hoy, -60)}`)).body.ventas).toHaveLength(navaja().sales.filter((v) => v.date <= addDays(hoy, -60)).length);
    });

    it('un rango al revés (from > to) o sin ventas devuelve lista vacía', async () => {
      expect((await listar(s.navaja.owner, `?from=${hoy}&to=${addDays(hoy, -5)}`)).body.ventas).toEqual([]);
      expect((await listar(s.navaja.owner, `?from=${addDays(hoy, 5)}`)).body.ventas).toEqual([]);
    });

    it('H61 [media]: una fecha inválida en los filtros da 400 en español, no 500', async () => {
      for (const q of ['?from=basura', '?to=basura', '?from=2030-02-31', '?to=2030-13-01', '?from=2030-1-1', '?from=30-01-2030', '?from=%20', '?to=2030-01-01T00:00:00Z']) {
        const r = await listar(s.navaja.owner, q);
        expect(r.status, q).toBe(400);
        expect(r.body.error).not.toMatch(SIN_INGLES);
      }
      expect((await listar(s.navaja.owner, '?from=')).status).toBe(200); // vacío = sin filtro
      expect((await listar(s.navaja.owner, `?from=${hoy}&from=basura`)).status).toBe(200); // repetido: se usa el primero
    });

    it('H63: un barbero ve solo SUS ventas (no el historial ni los clientes de los demás); el dueño ve todas', async () => {
      for (const [token, key] of [[s.navaja.julian, 'julian'], [s.navaja.camilo, 'camilo']]) {
        const r = await listar(token);
        expect(r.status).toBe(200);
        expect(r.body.ventas).toHaveLength(navaja().sales.filter((v) => v.seller === key).length);
        expect(new Set(r.body.ventas.map((v) => v.vendedor))).toEqual(new Set([NOMBRE_VENDEDOR[key]]));
      }
      expect((await listar(s.navaja.owner)).body.ventas.length).toBe(navaja().sales.length);
    });

    it('El Fade tiene sus propias ventas; Barbería Nueva, ninguna; el master 403 NO_BUSINESS; sin sesión 401', async () => {
      const [n, f] = await Promise.all([listar(s.navaja.owner), listar(s.fade.owner)]);
      expect(f.body.ventas).toHaveLength(biz('fade').sales.length);
      const idsN = new Set(n.body.ventas.map((v) => v.id));
      expect(f.body.ventas.every((v) => !idsN.has(v.id))).toBe(true);
      const mario = biz('fade').clients.find((c) => c.key === 'mario').name;
      expect(f.body.ventas.find((v) => v.cliente)?.cliente).toBe(mario);
      expect((await listar(s.nueva.owner)).body.ventas).toEqual([]);
      const m = await listar(s.master);
      expect(m.status).toBe(403);
      expect(m.body.code).toBe('NO_BUSINESS');
      expect((await api().get('/api/v1/product-sales')).status).toBe(401);
    });
  });

  describe('el día de la venta es el del negocio (zona horaria de Bogotá)', () => {
    it('H62 [media]: una venta de las 9:30 p. m. en Bogotá (02:30 UTC del día siguiente) cae en SU día en la fecha, la hora y los filtros', async () => {
      const { d, p } = await montar('tz');
      const user = await prisma.user.findFirst({ where: { businessId: d.business.id } });
      const dia = '2026-06-10';
      const instante = '2026-06-11T02:30:00.000Z';
      await prisma.productSale.create({ data: { businessId: d.business.id, productId: p.id, quantity: 1, unitPriceCents: 2800000, totalCents: 2800000, soldAt: new Date(instante), soldById: user.id } });
      const v = (await listar(d.token)).body.ventas[0];
      expect(v.fecha).toBe(dia);
      expect(v.hora).toBe('21:30');
      expect((await listar(d.token, `?from=${dia}&to=${dia}`)).body.ventas).toHaveLength(1);
      expect((await listar(d.token, `?to=${addDays(dia, -1)}`)).body.ventas).toHaveLength(0);
      expect((await listar(d.token, `?from=${addDays(dia, 1)}`)).body.ventas).toHaveLength(0);
    });

    it('las ventas de las 00:10 y de las 23:50 del negocio quedan cada una en su día', async () => {
      const { d, p } = await montar('bordes');
      const user = await prisma.user.findFirst({ where: { businessId: d.business.id } });
      const nueva = (instante) => prisma.productSale.create({ data: { businessId: d.business.id, productId: p.id, quantity: 1, unitPriceCents: 100, totalCents: 100, soldAt: new Date(instante), soldById: user.id } });
      await nueva('2026-06-10T05:10:00.000Z'); // 00:10 del 10 en Bogotá
      await nueva('2026-06-11T04:50:00.000Z'); // 23:50 del 10 en Bogotá
      await nueva('2026-06-11T05:05:00.000Z'); // 00:05 del 11
      expect((await listar(d.token, '?from=2026-06-10&to=2026-06-10')).body.ventas.map((x) => x.hora).sort()).toEqual(['00:10', '23:50']);
      expect((await listar(d.token, '?from=2026-06-11&to=2026-06-11')).body.ventas.map((x) => x.hora)).toEqual(['00:05']);
    });
  });

  describe('registrar una venta', () => {
    it('201 con la forma exacta; descuenta el stock; el historial deja la venta y el invariante se cumple', async () => {
      const { d, p, stockDe, sumaAjustes } = await montar('crea');
      const r = await vender(d.token, { productId: p.id, quantity: 3 });
      expect(r.status).toBe(201);
      expect(Object.keys(r.body)).toEqual(['venta']);
      expect(Object.keys(r.body.venta).sort()).toEqual(CLAVES);
      expect(r.body.venta).toMatchObject({ producto: p.nombre, productoId: p.id, cantidad: 3, precioUnitario: 28000, total: 84000, cliente: '', vendedor: 'Dueño crea' });
      expect(await stockDe()).toBe(7);
      const aj = await prisma.stockAdjustment.findMany({ where: { productId: p.id, reason: 'sale' } });
      expect(aj.map((a) => [a.delta, a.referenceId])).toEqual([[-3, r.body.venta.id]]);
      expect(await sumaAjustes()).toBe(7);
      const fila = await prisma.productSale.findUnique({ where: { id: r.body.venta.id } });
      expect(fila).toMatchObject({ businessId: d.business.id, unitPriceCents: 2800000, totalCents: 8400000 });
    });

    it('ignora lo que el cliente no puede fijar (precio, total, fecha, vendedor, negocio)', async () => {
      const { d, p } = await montar('extra');
      const otro = await registerOwner('extraB');
      const r = await vender(d.token, { productId: p.id, quantity: 1, unitPriceCents: 1, totalCents: 1, precioUnitario: 1, total: 1, soldAt: '2000-01-01T00:00:00Z', soldById: 'x', businessId: otro.business.id });
      expect(r.status).toBe(201);
      expect(r.body.venta).toMatchObject({ precioUnitario: 28000, total: 28000 });
      const fila = await prisma.productSale.findUnique({ where: { id: r.body.venta.id } });
      expect(fila.businessId).toBe(d.business.id);
      expect(fila.soldAt.getFullYear()).toBeGreaterThan(2020);
    });

    it('el precio queda fijado al vender: cambiar el precio después no altera la venta pasada, la siguiente usa el nuevo', async () => {
      const { d, p } = await montar('precio');
      const a = (await vender(d.token, { productId: p.id, quantity: 2 })).body.venta;
      await api().patch(`/api/v1/products/${p.id}`).set(auth(d.token)).send({ precioVenta: 35000 });
      const b = (await vender(d.token, { productId: p.id, quantity: 1 })).body.venta;
      expect(b).toMatchObject({ precioUnitario: 35000, total: 35000 });
      const lista = (await listar(d.token)).body.ventas;
      expect(lista.find((v) => v.id === a.id)).toMatchObject({ precioUnitario: 28000, total: 56000 });
    });

    it('con cliente: crea o reconoce la ficha (sin distinguir mayúsculas), cuenta como visita y la venta muestra su nombre canónico', async () => {
      const { d, p } = await montar('cliente');
      const a = await vender(d.token, { productId: p.id, quantity: 1, clientName: '  Laura    Gómez ' });
      expect(a.body.venta.cliente).toBe('Laura Gómez');
      const b = await vender(d.token, { productId: p.id, quantity: 1, clientName: 'LAURA GÓMEZ' });
      expect(b.body.venta.cliente).toBe('Laura Gómez');
      const clientes = (await api().get('/api/v1/clients').set(auth(d.token))).body.clients;
      expect(clientes).toHaveLength(1);
      expect(clientes[0]).toMatchObject({ nombre: 'Laura Gómez', visitas: 2, gasto: 28000 });
    });

    it('un nombre de solo espacios es «sin cliente»; de más de 80 caracteres o de otro tipo da 400', async () => {
      const { d, p } = await montar('nombre');
      const sin = await vender(d.token, { productId: p.id, quantity: 1, clientName: '     ' });
      expect(sin.status).toBe(201);
      expect(sin.body.venta.cliente).toBe('');
      expect(await prisma.client.count({ where: { businessId: d.business.id } })).toBe(0);
      for (const clientName of ['A'.repeat(81), 5, ['x'], { a: 1 }]) {
        const r = await vender(d.token, { productId: p.id, quantity: 1, clientName });
        expect(r.status, JSON.stringify(clientName).slice(0, 20)).toBe(400);
        expect(r.body.error).not.toMatch(SIN_INGLES);
      }
    });

    it('H65: con clientId de una ficha propia la venta se vincula y muestra el nombre de la ficha (aunque no se envíe clientName)', async () => {
      const { d, p } = await montar('clientId');
      const ficha = await prisma.client.create({ data: { businessId: d.business.id, name: 'Pedro Ruiz', phone: '3207778888' } });
      const r = await vender(d.token, { productId: p.id, quantity: 1, clientId: ficha.id });
      expect(r.status).toBe(201);
      expect(r.body.venta.cliente).toBe('Pedro Ruiz');
      expect((await prisma.productSale.findUnique({ where: { id: r.body.venta.id } })).clientId).toBe(ficha.id);
      expect((await api().get('/api/v1/clients').set(auth(d.token))).body.clients[0]).toMatchObject({ nombre: 'Pedro Ruiz', visitas: 1 });
    });

    it('H65b: si llegan clientId y clientName, manda la ficha (no se crea otro cliente con el nombre escrito)', async () => {
      const { d, p } = await montar('ambos');
      const ficha = await prisma.client.create({ data: { businessId: d.business.id, name: 'Pedro Ruiz', phone: '' } });
      const r = await vender(d.token, { productId: p.id, quantity: 1, clientId: ficha.id, clientName: 'Otro Nombre' });
      expect(r.status).toBe(201);
      expect(r.body.venta.cliente).toBe('Pedro Ruiz');
      expect(await prisma.client.count({ where: { businessId: d.business.id } })).toBe(1);
    });

    it('H66 [alta]: un clientId de OTRO negocio o inexistente da 404 (no 500 ni se vincula a una ficha ajena); el stock no cambia', async () => {
      const { d, p, stockDe } = await montar('ajeno');
      const otro = await registerOwner('fichaAjena');
      const ajena = await prisma.client.create({ data: { businessId: otro.business.id, name: 'Cliente Ajeno', phone: '' } });
      for (const clientId of [ajena.id, '00000000-0000-4000-8000-000000000000']) {
        const r = await vender(d.token, { productId: p.id, quantity: 1, clientId });
        expect(r.status, clientId).toBe(404);
        expect(r.body.code).toBe('NOT_FOUND');
        expect(r.body.error).toMatch(/cliente/i);
      }
      const noUuid = await vender(d.token, { productId: p.id, quantity: 1, clientId: 'no-es-uuid' });
      expect(noUuid.status).toBe(400);
      expect(await stockDe()).toBe(10);
      expect(await prisma.productSale.count({ where: { businessId: d.business.id } })).toBe(0);
      expect(await prisma.productSale.count({ where: { clientId: ajena.id } })).toBe(0);
    });

    it('H67: una venta rechazada (sin stock) no deja creada la ficha del cliente', async () => {
      const { d, p, stockDe } = await montar('huerfano', { stock: 1 });
      const r = await vender(d.token, { productId: p.id, quantity: 5, clientName: 'Cliente Fantasma' });
      expect(r.status).toBe(400);
      expect(r.body.code).toBe('INSUFFICIENT_STOCK');
      expect(await prisma.client.count({ where: { businessId: d.business.id } })).toBe(0);
      expect(await stockDe()).toBe(1);
    });

    it('rechaza cantidades y productos inválidos con 400 en español sin tocar el inventario', async () => {
      const { d, p, stockDe } = await montar('inv');
      const casos = [{}, { productId: p.id }, { quantity: 1 }, { productId: 'no-uuid', quantity: 1 }, { productId: p.id, quantity: 0 }, { productId: p.id, quantity: -1 },
        { productId: p.id, quantity: 1.5 }, { productId: p.id, quantity: '2' }, { productId: p.id, quantity: null }, { productId: p.id, quantity: 11 }, { productId: p.id, quantity: 1e21 }];
      for (const body of casos) {
        const r = await vender(d.token, body);
        expect(r.status, JSON.stringify(body)).toBe(400);
        expect(r.body.error).not.toMatch(SIN_INGLES);
      }
      expect(await stockDe()).toBe(10);
      expect((await vender(d.token, { productId: p.id, quantity: 10 })).status).toBe(201); // justo todo el stock
      expect(await stockDe()).toBe(0);
      expect((await vender(d.token, { productId: p.id, quantity: 1 })).body.code).toBe('INSUFFICIENT_STOCK');
    });

    it('un cuerpo que no es JSON válido da 400, no 500', async () => {
      const { d } = await montar('json');
      const r = await api().post('/api/v1/product-sales').set(auth(d.token)).set('Content-Type', 'application/json').send('{"productId":');
      expect(r.status).toBe(400);
    });

    it('producto inexistente, eliminado o de otro negocio: 404', async () => {
      const { d, p } = await montar('404');
      const otro = await registerOwner('prodAjeno');
      const ajeno = (await crearProducto(otro.token, { nombre: 'Ajeno' })).body.product;
      expect((await vender(d.token, { productId: '00000000-0000-4000-8000-000000000000', quantity: 1 })).status).toBe(404);
      expect((await vender(d.token, { productId: ajeno.id, quantity: 1 })).status).toBe(404);
      await api().delete(`/api/v1/products/${p.id}`).set(auth(d.token));
      expect((await vender(d.token, { productId: p.id, quantity: 1 })).status).toBe(404);
    });

    it('concurrencia: 12 ventas de 1 sobre 7 de stock venden exactamente 7; el historial suma lo que queda (0), sin 500', async () => {
      const { d, p, stockDe, sumaAjustes } = await montar('carrera', { stock: 7 });
      const rs = await Promise.all(Array.from({ length: 12 }, () => vender(d.token, { productId: p.id, quantity: 1 })));
      expect(rs.filter((r) => r.status >= 500)).toHaveLength(0);
      expect(rs.filter((r) => r.status === 201)).toHaveLength(7);
      expect(rs.filter((r) => r.status === 400).every((r) => r.body.code === 'INSUFFICIENT_STOCK')).toBe(true);
      expect(await stockDe()).toBe(0);
      expect(await sumaAjustes()).toBe(0);
      expect(await prisma.productSale.count({ where: { productId: p.id } })).toBe(7);
    });

    it('concurrencia: 8 ventas del mismo cliente nuevo dejan una sola ficha', async () => {
      const { d, p } = await montar('fichas', { stock: 20 });
      const rs = await Promise.all(Array.from({ length: 8 }, () => vender(d.token, { productId: p.id, quantity: 1, clientName: 'Cliente Nuevo' })));
      expect(rs.map((r) => r.status)).toEqual(Array(8).fill(201));
      expect(await prisma.client.count({ where: { businessId: d.business.id } })).toBe(1);
    });
  });

  describe('permisos y vendedor', () => {
    it('un barbero puede vender; la venta queda a su nombre y solo él (y el dueño) la ven', async () => {
      const { d, barbero, p } = await montar('barbero');
      const otroBarbero = await createEmployee(d.token, 'Otro barbero');
      const r = await vender(barbero.token, { productId: p.id, quantity: 2 });
      expect(r.status).toBe(201);
      expect(r.body.venta.vendedor).toBe('Barbero barbero');
      expect((await listar(barbero.token)).body.ventas.map((v) => v.id)).toEqual([r.body.venta.id]);
      expect((await listar(otroBarbero.token)).body.ventas).toEqual([]);
      expect((await listar(d.token)).body.ventas.map((v) => v.id)).toEqual([r.body.venta.id]);
    });

    it('el master 403 y sin sesión 401 al vender; el token de La Navaja no vende productos de El Fade', async () => {
      const { p } = await montar('roles');
      expect((await vender(s.master, { productId: p.id, quantity: 1 })).status).toBe(403);
      expect((await api().post('/api/v1/product-sales').send({ productId: p.id, quantity: 1 })).status).toBe(401);
      const ajeno = (await api().get('/api/v1/products').set(auth(s.fade.owner))).body.products[0];
      const antes = ajeno.stock;
      expect((await vender(s.navaja.owner, { productId: ajeno.id, quantity: 1 })).status).toBe(404);
      expect((await api().get('/api/v1/products').set(auth(s.fade.owner))).body.products.find((x) => x.id === ajeno.id).stock).toBe(antes);
    });
  });

  describe('higiene', () => {
    it('los datos de este módulo no tocan el seed: «hoy» sigue siendo el de la carga', () => {
      expect(bizDay(0)).toBe(hoy);
    });
  });
});
