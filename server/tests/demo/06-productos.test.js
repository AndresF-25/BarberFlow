/**
 * Módulo 6 — Productos e inventario (GET/POST/PATCH/DELETE /products y POST /products/:id/adjust-stock).
 * Lee las tres barberías demo en solo lectura; lo que crea o modifica usa negocios @test.local nuevos.
 * Invariante central: la suma del historial de ajustes (StockAdjustment) de un producto = su stock.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  api, auth, prisma, registerOwner, createEmployee, requireSeed, demoSessions, biz, uniqueEmail,
} from './helpers-demo.js';

const listar = (token, query = '') => api().get(`/api/v1/products${query}`).set(auth(token));
const crear = (token, body) => api().post('/api/v1/products').set(auth(token)).send(body);
const editar = (token, id, body) => api().patch(`/api/v1/products/${id}`).set(auth(token)).send(body);
const borrar = (token, id) => api().delete(`/api/v1/products/${id}`).set(auth(token));
const ajustar = (token, id, body) => api().post(`/api/v1/products/${id}/adjust-stock`).set(auth(token)).send(body);
const vender = (token, body) => api().post('/api/v1/product-sales').set(auth(token)).send(body);
const valido = (over = {}) => ({ nombre: 'Cera de prueba', categoria: 'Styling', stock: 10, stockMinimo: 3, unidad: 'unidad', precioVenta: 28000, precioCosto: 15000, ...over });
const CLAVES = ['categoria', 'id', 'nombre', 'precioCosto', 'precioVenta', 'stock', 'stockMinimo', 'unidad'];
const SIN_INGLES = /Required|Expected|Invalid|must contain|String must|Number must/i;

const sumaAjustes = async (productId) => {
  const r = await prisma.stockAdjustment.aggregate({ where: { productId }, _sum: { delta: true } });
  return r._sum.delta || 0;
};
const filaDe = (id) => prisma.product.findUnique({ where: { id } });

describe('Módulo 6 · productos e inventario', () => {
  let s;
  beforeAll(async () => { await requireSeed(); s = await demoSessions(); });

  describe('catálogo de los datos demo (solo lectura)', () => {
    it('La Navaja: lista sus 5 productos activos con la forma exacta, ordenados por nombre', async () => {
      const r = await listar(s.navaja.owner);
      expect(r.status).toBe(200);
      expect(Object.keys(r.body)).toEqual(['products']);
      expect(r.body.products).toHaveLength(5);
      for (const p of r.body.products) expect(Object.keys(p).sort()).toEqual(CLAVES);
      const nombres = r.body.products.map((p) => p.nombre);
      expect(nombres).toEqual([...nombres].sort((a, b) => a.localeCompare(b, 'es')));
      expect(nombres).not.toContain('Peine de madera');
      expect(JSON.stringify(r.body)).not.toMatch(/isActive|businessId|salePriceCents|costPriceCents|stockMin"/);
    });

    it('nombre, categoría, stock, mínimo, unidad y precios coinciden con el dataset', async () => {
      const r = await listar(s.navaja.owner);
      const activos = biz('navaja').products.filter((p) => p.active !== false);
      const f = (p) => [p.nombre, p.categoria, p.stock, p.stockMin ?? p.stockMinimo, p.unidad, p.precioVenta, p.precioCosto];
      expect(r.body.products.map((p) => [p.nombre, p.categoria, p.stock, p.stockMinimo, p.unidad, p.precioVenta, p.precioCosto]).sort())
        .toEqual(activos.map(f).sort());
    });

    it('invariante: en cada producto demo (también el desactivado) la suma del historial de ajustes = su stock', async () => {
      for (const key of ['navaja', 'fade']) {
        const owner = await prisma.user.findUnique({ where: { email: biz(key).owner.email } });
        const productos = await prisma.product.findMany({ where: { businessId: owner.businessId } });
        expect(productos.length).toBeGreaterThan(0);
        for (const p of productos) expect(await sumaAjustes(p.id), `${key}/${p.name}`).toBe(p.stock);
      }
    });

    it('?category filtra por categoría exacta; una categoría desconocida o con otras mayúsculas da []', async () => {
      const r = await listar(s.navaja.owner, '?category=Styling');
      expect(r.body.products.map((p) => p.nombre).sort()).toEqual(['Cera mate', 'Pomada de fijación fuerte']);
      expect((await listar(s.navaja.owner, '?category=Bebidas')).body.products.map((p) => p.nombre)).toEqual(['Cerveza artesanal']);
      expect((await listar(s.navaja.owner, '?category=Inexistente')).body.products).toEqual([]);
      expect((await listar(s.navaja.owner, '?category=styling')).body.products).toEqual([]);
    });

    it('?category vacío no filtra; con valor repetido no rompe (200)', async () => {
      expect((await listar(s.navaja.owner, '?category=')).body.products).toHaveLength(5);
      expect((await listar(s.navaja.owner, '?category=Styling&category=Bebidas')).status).toBe(200);
    });

    it('?lowStock=true devuelve los de stock ≤ mínimo (incluye agotados); sin la opción o con otro valor no filtra', async () => {
      const bajo = await listar(s.navaja.owner, '?lowStock=true');
      expect(bajo.body.products.map((p) => p.nombre).sort()).toEqual(['Cera mate', 'Pomada de fijación fuerte']);
      for (const p of bajo.body.products) expect(p.stock).toBeLessThanOrEqual(p.stockMinimo);
      expect((await listar(s.navaja.owner, '?lowStock=false')).body.products).toHaveLength(5);
      expect((await listar(s.navaja.owner, '?lowStock=1')).body.products).toHaveLength(5);
    });

    it('category y lowStock se combinan', async () => {
      const r = await listar(s.navaja.owner, '?category=Styling&lowStock=true');
      expect(r.body.products).toHaveLength(2);
      expect((await listar(s.navaja.owner, '?category=Bebidas&lowStock=true')).body.products).toEqual([]);
    });

    it('El Fade tiene sus propios productos (sin fugas de La Navaja); Barbería Nueva, vacío', async () => {
      const [n, f] = await Promise.all([listar(s.navaja.owner), listar(s.fade.owner)]);
      const idsN = new Set(n.body.products.map((p) => p.id));
      expect(f.body.products).toHaveLength(biz('fade').products.filter((p) => p.active !== false).length);
      for (const p of f.body.products) expect(idsN.has(p.id)).toBe(false);
      expect((await listar(s.nueva.owner)).body.products).toEqual([]);
    });

    it('el master no tiene negocio (403 NO_BUSINESS) y sin sesión da 401', async () => {
      const m = await listar(s.master);
      expect(m.status).toBe(403);
      expect(m.body.code).toBe('NO_BUSINESS');
      expect((await api().get('/api/v1/products')).status).toBe(401);
    });
  });

  describe('crear', () => {
    it('201 con la forma exacta; guarda centavos, negocio y estado activo; aparece en el listado', async () => {
      const d = await registerOwner('crear');
      const r = await crear(d.token, valido({ nombre: 'Aceite', precioVenta: 35000, precioCosto: 18000, stock: 14, stockMinimo: 4 }));
      expect(r.status).toBe(201);
      expect(Object.keys(r.body)).toEqual(['product']);
      expect(Object.keys(r.body.product).sort()).toEqual(CLAVES);
      expect(r.body.product).toMatchObject({ nombre: 'Aceite', stock: 14, stockMinimo: 4, precioVenta: 35000, precioCosto: 18000 });
      expect((await listar(d.token)).body.products).toEqual([r.body.product]);
      expect(await filaDe(r.body.product.id)).toMatchObject({ businessId: d.business.id, salePriceCents: 3500000, costPriceCents: 1800000, isActive: true });
    });

    it('H40: el stock inicial queda en el historial (ajuste «manual» por el total) y el invariante se cumple', async () => {
      const d = await registerOwner('inicial');
      const p = (await crear(d.token, valido({ stock: 14 }))).body.product;
      const filas = await prisma.stockAdjustment.findMany({ where: { productId: p.id } });
      expect(filas.map((f) => [f.delta, f.reason])).toEqual([[14, 'manual']]);
      expect(await sumaAjustes(p.id)).toBe(14);
      const sinStock = (await crear(d.token, valido({ nombre: 'Sin stock', stock: 0 }))).body.product;
      expect(await prisma.stockAdjustment.count({ where: { productId: sinStock.id } })).toBe(0);
    });

    it('precioCosto es opcional (0 por defecto); acepta tildes, emojis y HTML como texto', async () => {
      const d = await registerOwner('texto');
      const sinCosto = valido();
      delete sinCosto.precioCosto;
      const r = await crear(d.token, sinCosto);
      expect(r.status).toBe(201);
      expect(r.body.product.precioCosto).toBe(0);
      for (const nombre of ['Cera niño ñandú ✂️', '<b>Gel</b> & "fijador"']) {
        const x = await crear(d.token, valido({ nombre }));
        expect(x.status, nombre).toBe(201);
        expect(x.body.product.nombre).toBe(nombre);
      }
    });

    it('ignora campos que el cliente no puede fijar (id, isActive, businessId)', async () => {
      const a = await registerOwner('extraA');
      const b = await registerOwner('extraB');
      const r = await crear(a.token, valido({ id: 'x', isActive: false, businessId: b.business.id }));
      expect(r.status).toBe(201);
      expect(r.body.product.id).not.toBe('x');
      expect(await filaDe(r.body.product.id)).toMatchObject({ businessId: a.business.id, isActive: true });
      expect((await listar(b.token)).body.products).toEqual([]);
    });

    it('rechaza campos faltantes, de otro tipo, negativos o con decimales: 400 VALIDATION_ERROR en español', async () => {
      const d = await registerOwner('inv');
      const sin = (k) => { const v = valido(); delete v[k]; return v; };
      const casos = [
        {}, sin('nombre'), sin('categoria'), sin('stock'), sin('stockMinimo'), sin('unidad'), sin('precioVenta'),
        valido({ nombre: 5 }), valido({ nombre: null }), valido({ stock: '10' }), valido({ stock: -1 }), valido({ stock: 1.5 }),
        valido({ stockMinimo: -1 }), valido({ stockMinimo: 0.5 }), valido({ precioVenta: -1 }), valido({ precioVenta: '5' }),
        valido({ precioCosto: -1 }), valido({ precioCosto: '5' }), valido({ nombre: '' }), valido({ categoria: '' }), valido({ unidad: '' }),
      ];
      for (const body of casos) {
        const r = await crear(d.token, body);
        expect(r.status, JSON.stringify(body)).toBe(400);
        expect(r.body.code).toBe('VALIDATION_ERROR');
        expect(r.body.error).not.toMatch(SIN_INGLES);
      }
      expect((await listar(d.token)).body.products).toEqual([]);
    });

    it('un cuerpo que no es JSON válido da 400, no 500', async () => {
      const d = await registerOwner('json');
      const r = await api().post('/api/v1/products').set(auth(d.token)).set('Content-Type', 'application/json').send('{"nombre":');
      expect(r.status).toBe(400);
    });

    it('10 altas simultáneas se guardan las 10', async () => {
      const d = await registerOwner('rafaga');
      const rs = await Promise.all(Array.from({ length: 10 }, (_, i) => crear(d.token, valido({ nombre: `Producto ${i}` }))));
      expect(rs.map((r) => r.status)).toEqual(Array(10).fill(201));
      expect((await listar(d.token)).body.products).toHaveLength(10);
    });
  });

  describe('límites y reglas del catálogo', () => {
    const rechaza = async (body) => {
      const d = await registerOwner('lim');
      const r = await crear(d.token, valido(body));
      expect(r.status, JSON.stringify(body).slice(0, 90)).toBe(400);
      expect(r.body.code).toBe('VALIDATION_ERROR');
      expect(r.body.error).not.toMatch(SIN_INGLES);
      expect((await listar(d.token)).body.products).toEqual([]);
    };

    it('H39: nombre, categoría y unidad se recortan, no pueden ser solo espacios y tienen máximo (80, 40 y 20)', async () => {
      await rechaza({ nombre: '    ' });
      await rechaza({ categoria: '    ' });
      await rechaza({ unidad: '    ' });
      await rechaza({ nombre: 'A'.repeat(81) });
      await rechaza({ categoria: 'C'.repeat(41) });
      await rechaza({ unidad: 'U'.repeat(21) });
      const d = await registerOwner('recorte');
      const r = await crear(d.token, valido({ nombre: '  Cera  ', categoria: ' Styling ', unidad: ' unidad ' }));
      expect(r.body.product).toMatchObject({ nombre: 'Cera', categoria: 'Styling', unidad: 'unidad' });
    });

    it('H37 [media]: stock y mínimo van de 0 a 1.000.000; nada de 500 por desbordar la base', async () => {
      for (const stock of [1000001, 3e9, 1e21]) await rechaza({ stock });
      for (const stockMinimo of [1000001, 3e9]) await rechaza({ stockMinimo });
      const d = await registerOwner('tope');
      expect((await crear(d.token, valido({ stock: 1000000, stockMinimo: 1000000 }))).status).toBe(201);
    });

    it('H37b [media]: los precios son enteros de pesos, de 0 a 10.000.000; nada de 500', async () => {
      for (const precioVenta of [28000.5, 10000001, 1e12, 3e9]) await rechaza({ precioVenta });
      for (const precioCosto of [100.5, 10000001, 3e9]) await rechaza({ precioCosto });
      const d = await registerOwner('topeP');
      expect((await crear(d.token, valido({ precioVenta: 10000000, precioCosto: 10000000 }))).status).toBe(201);
    });

    it('H37c [media]: un precio infinito (1e400 en el JSON) da 400, no 500', async () => {
      const d = await registerOwner('inf');
      const r = await api().post('/api/v1/products').set(auth(d.token)).set('Content-Type', 'application/json')
        .send('{"nombre":"X","categoria":"Styling","stock":1,"stockMinimo":1,"unidad":"unidad","precioVenta":1e400}');
      expect(r.status).toBe(400);
    });

    it('H38: dos productos activos no pueden llamarse igual (sin distinguir mayúsculas ni espacios); uno eliminado libera el nombre', async () => {
      const d = await registerOwner('dup');
      const a = await crear(d.token, valido({ nombre: 'Cera mate' }));
      expect(a.status).toBe(201);
      for (const nombre of ['Cera mate', 'cera mate', '  Cera mate  ']) {
        const r = await crear(d.token, valido({ nombre }));
        expect(r.status, nombre).toBe(409);
        expect(r.body.code).toBe('DUPLICATE_NAME');
        expect(r.body.error).toMatch(/ya existe/i);
      }
      const otro = (await crear(d.token, valido({ nombre: 'Otra cera' }))).body.product;
      expect((await editar(d.token, otro.id, { nombre: 'CERA MATE' })).status).toBe(409);
      expect((await editar(d.token, a.body.product.id, { nombre: 'Cera mate', precioVenta: 29000 })).status).toBe(200);
      await borrar(d.token, a.body.product.id);
      expect((await crear(d.token, valido({ nombre: 'Cera mate' }))).status).toBe(201);
    });

    it('H38b: negocios distintos sí pueden repetir nombre; 6 altas simultáneas con el mismo nombre dejan una', async () => {
      const a = await registerOwner('mismoA');
      const b = await registerOwner('mismoB');
      expect((await crear(a.token, valido({ nombre: 'Gel' }))).status).toBe(201);
      expect((await crear(b.token, valido({ nombre: 'Gel' }))).status).toBe(201);
      const d = await registerOwner('dupRace');
      const rs = await Promise.all(Array.from({ length: 6 }, () => crear(d.token, valido({ nombre: 'Gemelo' }))));
      expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
      expect(rs.filter((r) => r.status >= 500)).toHaveLength(0);
      expect((await listar(d.token)).body.products).toHaveLength(1);
    });
  });

  describe('editar', () => {
    it('cambia solo un campo y deja los demás igual', async () => {
      const d = await registerOwner('parcial');
      const p = (await crear(d.token, valido())).body.product;
      for (const cambio of [{ nombre: 'Nuevo' }, { categoria: 'Bebidas' }, { stockMinimo: 7 }, { unidad: 'paquete' }, { precioVenta: 31000 }, { precioCosto: 16000 }]) {
        const r = await editar(d.token, p.id, cambio);
        expect(r.status).toBe(200);
        Object.assign(p, cambio);
        expect(r.body.product).toEqual(p);
      }
      expect((await listar(d.token)).body.products).toEqual([p]);
    });

    it('un cuerpo vacío no cambia nada y responde 200; ignora id, isActive y businessId', async () => {
      const a = await registerOwner('vacio');
      const b = await registerOwner('vacioB');
      const p = (await crear(a.token, valido())).body.product;
      expect((await editar(a.token, p.id, {})).body.product).toEqual(p);
      const r = await editar(a.token, p.id, { isActive: false, businessId: b.business.id, id: 'otro', precioVenta: 30000 });
      expect(r.status).toBe(200);
      expect(r.body.product).toMatchObject({ id: p.id, precioVenta: 30000 });
      expect(await filaDe(p.id)).toMatchObject({ businessId: a.business.id, isActive: true });
    });

    it('aplica las mismas validaciones y recortes que al crear', async () => {
      const d = await registerOwner('editInv');
      const p = (await crear(d.token, valido())).body.product;
      const malos = [{ nombre: '' }, { nombre: '   ' }, { nombre: 'A'.repeat(81) }, { categoria: ' ' }, { unidad: 'U'.repeat(21) }, { stock: -1 }, { stock: 1.5 },
        { stock: 1000001 }, { stock: 3e9 }, { stockMinimo: -1 }, { stockMinimo: 3e9 }, { precioVenta: -1 }, { precioVenta: 1.5 }, { precioVenta: 3e9 }, { precioCosto: 3e9 }, { nombre: 5 }];
      for (const body of malos) {
        const r = await editar(d.token, p.id, body);
        expect(r.status, JSON.stringify(body)).toBe(400);
        expect(r.body.error).not.toMatch(SIN_INGLES);
      }
      expect((await listar(d.token)).body.products).toEqual([p]);
      const ok = await editar(d.token, p.id, { nombre: '  Con espacios ' });
      expect(ok.body.product.nombre).toBe('Con espacios');
    });

    it('H33: cambiar el stock con PATCH queda en el historial como corrección (delta = diferencia) y el invariante se cumple', async () => {
      const d = await registerOwner('patchStock');
      const p = (await crear(d.token, valido({ stock: 10 }))).body.product;
      const r = await editar(d.token, p.id, { stock: 4 });
      expect(r.status).toBe(200);
      expect(r.body.product.stock).toBe(4);
      const filas = await prisma.stockAdjustment.findMany({ where: { productId: p.id }, orderBy: { createdAt: 'asc' } });
      expect(filas.map((f) => [f.delta, f.reason])).toEqual([[10, 'manual'], [-6, 'correction']]);
      expect(await sumaAjustes(p.id)).toBe(4);
      // el mismo valor no genera un ajuste vacío
      await editar(d.token, p.id, { stock: 4, nombre: 'Mismo stock' });
      expect(await prisma.stockAdjustment.count({ where: { productId: p.id } })).toBe(2);
    });

    it('un producto inexistente, con id raro o de otro negocio da 404 y no se modifica', async () => {
      const a = await registerOwner('ajenoA');
      const b = await registerOwner('ajenoB');
      const p = (await crear(a.token, valido())).body.product;
      for (const id of ['00000000-0000-0000-0000-000000000000', 'no-es-uuid', '%00', 'x'.repeat(300)]) {
        expect((await editar(a.token, encodeURIComponent(id), { precioVenta: 1 })).status, id).toBe(404);
      }
      expect((await editar(b.token, p.id, { precioVenta: 1 })).status).toBe(404);
      expect((await listar(a.token)).body.products[0].precioVenta).toBe(28000);
    });

    it('dos ediciones simultáneas de campos distintos se aplican las dos', async () => {
      const d = await registerOwner('simul');
      const p = (await crear(d.token, valido())).body.product;
      const [x, y] = await Promise.all([editar(d.token, p.id, { precioVenta: 50000 }), editar(d.token, p.id, { stockMinimo: 9 })]);
      expect([x.status, y.status]).toEqual([200, 200]);
      expect((await listar(d.token)).body.products[0]).toMatchObject({ precioVenta: 50000, stockMinimo: 9 });
    });
  });

  describe('eliminar (baja lógica)', () => {
    it('200 { ok: true }, deja de aparecer; la fila, su historial y sus ventas se conservan', async () => {
      const d = await registerOwner('baja');
      const p = (await crear(d.token, valido({ stock: 5 }))).body.product;
      expect((await vender(d.token, { productId: p.id, quantity: 2 })).status).toBe(201);
      const r = await borrar(d.token, p.id);
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ ok: true });
      expect((await listar(d.token)).body.products).toEqual([]);
      expect(await filaDe(p.id)).toMatchObject({ isActive: false, stock: 3 });
      expect(await sumaAjustes(p.id)).toBe(3);
      const ventas = await api().get('/api/v1/product-sales').set(auth(d.token));
      expect(ventas.body.ventas.map((v) => v.producto)).toEqual(['Cera de prueba']);
    });

    it('H32 [media]: un producto eliminado no se puede editar, volver a eliminar, ajustar ni vender (404)', async () => {
      const d = await registerOwner('fantasma');
      const p = (await crear(d.token, valido())).body.product;
      await borrar(d.token, p.id);
      expect((await editar(d.token, p.id, { precioVenta: 99999 })).status).toBe(404);
      expect((await borrar(d.token, p.id)).status).toBe(404);
      expect((await ajustar(d.token, p.id, { delta: 5 })).status).toBe(404);
      expect((await vender(d.token, { productId: p.id, quantity: 1 })).status).toBe(404);
      expect(await filaDe(p.id)).toMatchObject({ salePriceCents: 2800000, stock: 10 });
    });

    it('otro negocio, un id inexistente o uno raro dan 404', async () => {
      const a = await registerOwner('delA');
      const b = await registerOwner('delB');
      const p = (await crear(a.token, valido())).body.product;
      expect((await borrar(b.token, p.id)).status).toBe(404);
      expect((await borrar(a.token, '00000000-0000-0000-0000-000000000000')).status).toBe(404);
      expect((await borrar(a.token, 'no-es-uuid')).status).toBe(404);
      expect((await listar(a.token)).body.products).toHaveLength(1);
    });
  });

  describe('ajuste de stock', () => {
    const montar = async (label, stock = 10) => {
      const d = await registerOwner(label);
      const p = (await crear(d.token, valido({ stock }))).body.product;
      return { d, p };
    };

    it('suma y resta; la razón por defecto es «manual» y se guarda lo pedido (manual/correction)', async () => {
      const { d, p } = await montar('suma');
      const a = await ajustar(d.token, p.id, { delta: 5 });
      expect(a.status).toBe(200);
      expect(Object.keys(a.body)).toEqual(['product']);
      expect(a.body.product.stock).toBe(15);
      expect((await ajustar(d.token, p.id, { delta: -3, reason: 'correction' })).body.product.stock).toBe(12);
      const filas = await prisma.stockAdjustment.findMany({ where: { productId: p.id }, orderBy: { createdAt: 'asc' } });
      expect(filas.map((f) => [f.delta, f.reason])).toEqual([[10, 'manual'], [5, 'manual'], [-3, 'correction']]);
      expect(await sumaAjustes(p.id)).toBe(12);
    });

    it('la razón «sale» no se puede pedir a mano (400) ni una desconocida; tampoco delta 0, decimal, texto ni ausente', async () => {
      const { d, p } = await montar('razon');
      for (const body of [{ delta: 1, reason: 'sale' }, { delta: 1, reason: 'robo' }, { delta: 0 }, { delta: 1.5 }, { delta: '5' }, { delta: null }, {}, { reason: 'manual' }]) {
        const r = await ajustar(d.token, p.id, body);
        expect(r.status, JSON.stringify(body)).toBe(400);
        expect(r.body.code).toBe('VALIDATION_ERROR');
        expect(r.body.error).not.toMatch(SIN_INGLES);
      }
      expect((await filaDe(p.id)).stock).toBe(10);
      expect(await sumaAjustes(p.id)).toBe(10);
    });

    it('H36 [media]: un delta fuera de ±1.000.000 o que deje más de 1.000.000 en stock da 400, no 500', async () => {
      const { d, p } = await montar('enorme');
      for (const delta of [1000001, -1000001, 3e9, -3e9, 1e21]) expect((await ajustar(d.token, p.id, { delta })).status, String(delta)).toBe(400);
      expect((await ajustar(d.token, p.id, { delta: 1000000 })).status).toBe(400); // 10 + 1.000.000 > tope
      expect((await ajustar(d.token, p.id, { delta: 999990 })).status).toBe(200);
      expect((await filaDe(p.id)).stock).toBe(1000000);
    });

    it('H35: el stock nunca queda negativo y el historial guarda el cambio REAL (el invariante se cumple)', async () => {
      const { d, p } = await montar('piso', 3);
      const r = await ajustar(d.token, p.id, { delta: -100 });
      expect(r.status).toBe(200);
      expect(r.body.product.stock).toBe(0);
      expect(await sumaAjustes(p.id)).toBe(0); // se registró -3, no -100
      const otra = await ajustar(d.token, p.id, { delta: -5 }); // ya está en 0: no cambia nada
      expect(otra.body.product.stock).toBe(0);
      expect(await sumaAjustes(p.id)).toBe(0);
      expect(await prisma.stockAdjustment.count({ where: { productId: p.id, delta: 0 } })).toBe(0);
    });

    it('H34 [media]: 10 ajustes simultáneos de +1 suman exactamente 10 (no se pierden actualizaciones)', async () => {
      const { d, p } = await montar('carrera', 10);
      const rs = await Promise.all(Array.from({ length: 10 }, () => ajustar(d.token, p.id, { delta: 1 })));
      expect(rs.map((r) => r.status)).toEqual(Array(10).fill(200));
      expect((await filaDe(p.id)).stock).toBe(20);
      expect(await sumaAjustes(p.id)).toBe(20);
    });

    it('H34b: ajustes y ventas simultáneos mantienen el stock y el historial coherentes, sin 500', async () => {
      const { d, p } = await montar('mezcla', 5);
      const trabajos = [
        ...Array.from({ length: 6 }, () => ajustar(d.token, p.id, { delta: -1 })),
        ...Array.from({ length: 6 }, () => vender(d.token, { productId: p.id, quantity: 1 })),
        ...Array.from({ length: 4 }, () => ajustar(d.token, p.id, { delta: 2 })),
      ];
      const rs = await Promise.all(trabajos);
      expect(rs.filter((r) => r.status >= 500)).toHaveLength(0);
      const fila = await filaDe(p.id);
      expect(fila.stock).toBeGreaterThanOrEqual(0);
      expect(await sumaAjustes(p.id)).toBe(fila.stock);
    });

    it('H34c: 10 ajustes de −1 sobre 5 de stock dejan 0 (nunca negativo) y el historial suma 0', async () => {
      const { d, p } = await montar('vacia', 5);
      await Promise.all(Array.from({ length: 10 }, () => ajustar(d.token, p.id, { delta: -1 })));
      expect((await filaDe(p.id)).stock).toBe(0);
      expect(await sumaAjustes(p.id)).toBe(0);
    });
  });

  describe('historial de movimientos (GET /products/:id/stock-history)', () => {
    const historial = (token, id, query = '') => api().get(`/api/v1/products/${id}/stock-history${query}`).set(auth(token));

    it('cuenta la historia completa: alta, venta, entrada, salida y corrección, del más reciente al más antiguo, con el saldo tras cada uno', async () => {
      const d = await registerOwner('hist');
      const p = (await crear(d.token, valido({ stock: 10 }))).body.product;
      const venta = (await vender(d.token, { productId: p.id, quantity: 2 })).body.venta;
      await ajustar(d.token, p.id, { delta: 5 });
      await ajustar(d.token, p.id, { delta: -3 });
      await editar(d.token, p.id, { stock: 20 });
      const r = await historial(d.token, p.id);
      expect(r.status).toBe(200);
      expect(Object.keys(r.body).sort()).toEqual(['movements', 'total']);
      expect(r.body.total).toBe(5);
      // stock 10 → venta −2 (8) → +5 (13) → −3 (10) → corrección a 20 (+10)
      expect(r.body.movements.map((m) => [m.motivo, m.cambio, m.saldo])).toEqual([
        ['correccion', 10, 20], ['ajuste', -3, 10], ['ajuste', 5, 13], ['venta', -2, 8], ['ajuste', 10, 10],
      ]);
      for (const m of r.body.movements) {
        expect(Object.keys(m).sort()).toEqual(['cambio', 'fecha', 'id', 'motivo', 'saldo', 'ventaId']);
        expect(new Date(m.fecha).toISOString()).toBe(m.fecha);
      }
      expect(r.body.movements[3].ventaId).toBe(venta.id);
      expect(r.body.movements[0].ventaId).toBeNull();
      expect(r.body.movements[0].saldo).toBe((await filaDe(p.id)).stock);
    });

    it('el saldo del movimiento más antiguo es el stock inicial y cada saldo = el siguiente + su cambio', async () => {
      const d = await registerOwner('saldos');
      const p = (await crear(d.token, valido({ stock: 7 }))).body.product;
      for (const delta of [3, -2, 5, -4]) await ajustar(d.token, p.id, { delta });
      const m = (await historial(d.token, p.id)).body.movements;
      expect(m[m.length - 1]).toMatchObject({ cambio: 7, saldo: 7 });
      for (let i = 0; i < m.length - 1; i += 1) expect(m[i].saldo - m[i].cambio).toBe(m[i + 1].saldo);
    });

    it('un producto anterior al historial (sin ajuste inicial) igual da saldos coherentes con su stock actual', async () => {
      const d = await registerOwner('antiguo');
      const p = (await crear(d.token, valido({ stock: 0 }))).body.product;
      await prisma.product.update({ where: { id: p.id }, data: { stock: 50 } }); // simula un producto previo al historial
      await ajustar(d.token, p.id, { delta: 4 });
      const m = (await historial(d.token, p.id)).body.movements;
      expect(m).toHaveLength(1);
      expect(m[0]).toMatchObject({ cambio: 4, saldo: 54 });
    });

    it('?limit recorta la lista pero total sigue contando todos; límites inválidos dan 400 en español', async () => {
      const d = await registerOwner('limite');
      const p = (await crear(d.token, valido({ stock: 1 }))).body.product;
      for (let i = 0; i < 4; i += 1) await ajustar(d.token, p.id, { delta: 1 });
      const r = await historial(d.token, p.id, '?limit=2');
      expect(r.body.movements).toHaveLength(2);
      expect(r.body.total).toBe(5);
      expect((await historial(d.token, p.id)).body.movements).toHaveLength(5);
      for (const q of ['?limit=0', '?limit=201', '?limit=abc', '?limit=1.5']) {
        const x = await historial(d.token, p.id, q);
        expect(x.status, q).toBe(400);
        expect(x.body.error).not.toMatch(SIN_INGLES);
      }
    });

    it('un producto sin movimientos da lista vacía; uno eliminado, inexistente, raro o de otro negocio da 404', async () => {
      const a = await registerOwner('vacioH');
      const b = await registerOwner('vacioHB');
      const sin = (await crear(a.token, valido({ nombre: 'Sin stock', stock: 0 }))).body.product;
      expect((await historial(a.token, sin.id)).body).toEqual({ movements: [], total: 0 });
      const gone = (await crear(a.token, valido({ nombre: 'Se va' }))).body.product;
      await borrar(a.token, gone.id);
      for (const id of [gone.id, '00000000-0000-0000-0000-000000000000', 'no-es-uuid']) expect((await historial(a.token, id)).status, id).toBe(404);
      expect((await historial(b.token, sin.id)).status).toBe(404);
    });

    it('datos demo: la Cera mate de La Navaja muestra su historia real (ventas, ajustes) y su saldo final = stock', async () => {
      const cera = (await listar(s.navaja.owner)).body.products.find((p) => p.nombre === 'Cera mate');
      const r = await historial(s.navaja.owner, cera.id, '?limit=200');
      expect(r.status).toBe(200);
      expect(r.body.total).toBeGreaterThan(2);
      expect(r.body.movements[0].saldo).toBe(cera.stock);
      expect(new Set(r.body.movements.map((m) => m.motivo))).toEqual(new Set(['venta', 'ajuste', 'correccion']));
      // recorriendo toda la lista hacia atrás se llega al stock inicial (suma de cambios = stock)
      const suma = r.body.movements.reduce((n, m) => n + m.cambio, 0);
      expect(suma).toBe(cera.stock);
    });

    it('solo el dueño: barbero 403, master 403, sin sesión 401; y el token de otro negocio no ve el historial ajeno', async () => {
      const d = await registerOwner('permH');
      const barbero = await createEmployee(d.token, 'Barbero Hist');
      const p = (await crear(d.token, valido())).body.product;
      expect((await historial(barbero.token, p.id)).status).toBe(403);
      expect((await historial(s.master, p.id)).status).toBe(403);
      expect((await api().get(`/api/v1/products/${p.id}/stock-history`)).status).toBe(401);
      const ajeno = (await listar(s.fade.owner)).body.products[0];
      expect((await historial(s.navaja.owner, ajeno.id)).status).toBe(404);
    });
  });

  describe('permisos y aislamiento', () => {
    it('H41: un barbero ve el catálogo pero NO el precio de costo (dato del dueño); el dueño sí', async () => {
      const d = await registerOwner('costo');
      const barbero = await createEmployee(d.token, 'Barbero Costo');
      await crear(d.token, valido());
      const b = await listar(barbero.token);
      expect(b.status).toBe(200);
      expect(b.body.products).toHaveLength(1);
      expect(b.body.products[0]).toMatchObject({ nombre: 'Cera de prueba', precioVenta: 28000, stock: 10 });
      expect(Object.keys(b.body.products[0])).not.toContain('precioCosto');
      expect((await listar(d.token)).body.products[0].precioCosto).toBe(15000);
    });

    it('matriz de roles: dueño escribe; barbero solo lee (403); master 403; sin sesión 401', async () => {
      const d = await registerOwner('matriz');
      const barbero = await createEmployee(d.token, 'Barbero Matriz');
      const p = (await crear(d.token, valido())).body.product;
      expect((await crear(barbero.token, valido({ nombre: 'X' }))).status).toBe(403);
      expect((await editar(barbero.token, p.id, { precioVenta: 1 })).status).toBe(403);
      expect((await borrar(barbero.token, p.id)).status).toBe(403);
      expect((await ajustar(barbero.token, p.id, { delta: 5 })).status).toBe(403);
      for (const f of [() => crear(s.master, valido()), () => editar(s.master, p.id, { precioVenta: 1 }), () => borrar(s.master, p.id), () => ajustar(s.master, p.id, { delta: 1 })]) {
        expect((await f()).status).toBe(403);
      }
      expect((await api().post('/api/v1/products').send(valido())).status).toBe(401);
      expect((await api().patch(`/api/v1/products/${p.id}`).send({ precioVenta: 1 })).status).toBe(401);
      expect((await api().delete(`/api/v1/products/${p.id}`)).status).toBe(401);
      expect((await api().post(`/api/v1/products/${p.id}/adjust-stock`).send({ delta: 1 })).status).toBe(401);
      expect((await listar(d.token)).body.products).toEqual([p]);
    });

    it('el token de La Navaja no puede tocar los productos de El Fade (404) y no cambian', async () => {
      const ajenos = (await listar(s.fade.owner)).body.products;
      expect(ajenos.length).toBeGreaterThan(0);
      for (const p of ajenos) {
        expect((await editar(s.navaja.owner, p.id, { precioVenta: 1 })).status).toBe(404);
        expect((await borrar(s.navaja.owner, p.id)).status).toBe(404);
        expect((await ajustar(s.navaja.owner, p.id, { delta: 1 })).status).toBe(404);
      }
      expect((await listar(s.fade.owner)).body.products).toEqual(ajenos);
    });
  });

  describe('higiene', () => {
    it('los correos de prueba de este módulo terminan en @test.local', () => {
      expect(uniqueEmail('x')).toMatch(/@test\.local$/);
    });
  });
});
