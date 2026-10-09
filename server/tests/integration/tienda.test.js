import { beforeAll, describe, expect, it } from 'vitest';
import { api, auth, createEmployee, dbUp, registerOwner } from '../helpers.js';

describe.skipIf(!dbUp)('inventario y ventas', () => {
  let owner;
  let empleado;
  let rival;

  let n = 0; // los nombres de producto son únicos por negocio
  const nuevoProducto = async (extra = {}) => {
    const res = await api().post('/api/v1/products').set(auth(owner.token)).send({
      nombre: `Cera ${++n}`, categoria: 'Styling', stock: 5, stockMinimo: 2, unidad: 'unidad', precioVenta: 28000, precioCosto: 15000, ...extra,
    });
    if (res.status !== 201) throw new Error(`producto falló: ${res.status} ${JSON.stringify(res.body)}`);
    return res.body.product;
  };
  const vender = (token, body) => api().post('/api/v1/product-sales').set(auth(token)).send(body);
  const stockDe = async (id) => (await api().get('/api/v1/products').set(auth(owner.token))).body.products.find((p) => p.id === id)?.stock;

  beforeAll(async () => {
    owner = await registerOwner('tienda');
    empleado = await createEmployee(owner.token);
    rival = await registerOwner('rival');
  });

  describe('productos', () => {
    it('crea, edita y elimina (de forma lógica)', async () => {
      const p = await nuevoProducto({ nombre: 'Gel' });
      expect(p).toMatchObject({ nombre: 'Gel', stock: 5, precioVenta: 28000, precioCosto: 15000 });

      const editado = await api().patch(`/api/v1/products/${p.id}`).set(auth(owner.token)).send({ precioVenta: 30000, stockMinimo: 3 });
      expect(editado.body.product).toMatchObject({ precioVenta: 30000, stockMinimo: 3, nombre: 'Gel' });

      expect((await api().delete(`/api/v1/products/${p.id}`).set(auth(owner.token))).status).toBe(200);
      expect(await stockDe(p.id)).toBeUndefined();
    });

    it('valida los datos (sin stock negativo ni decimales)', async () => {
      const post = (extra) => api().post('/api/v1/products').set(auth(owner.token)).send({
        nombre: 'X', categoria: 'Styling', stock: 1, stockMinimo: 1, unidad: 'unidad', precioVenta: 1000, ...extra,
      });
      expect((await post({ stock: -1 })).status).toBe(400);
      expect((await post({ stock: 1.5 })).status).toBe(400);
      expect((await post({ precioVenta: -10 })).status).toBe(400);
      expect((await post({ nombre: '' })).status).toBe(400);
    });

    it('filtra por stock bajo', async () => {
      const bajo = await nuevoProducto({ nombre: 'Bajo', stock: 1, stockMinimo: 4 });
      const ok = await nuevoProducto({ nombre: 'Holgado', stock: 50, stockMinimo: 4 });
      const res = await api().get('/api/v1/products?lowStock=true').set(auth(owner.token));
      const ids = res.body.products.map((p) => p.id);
      expect(ids).toContain(bajo.id);
      expect(ids).not.toContain(ok.id);
    });

    it('el ajuste de stock suma y resta, y nunca deja el stock negativo', async () => {
      const p = await nuevoProducto({ stock: 3 });
      const ajustar = (delta) => api().post(`/api/v1/products/${p.id}/adjust-stock`).set(auth(owner.token)).send({ delta, reason: 'correction' });
      expect((await ajustar(10)).body.product.stock).toBe(13);
      expect((await ajustar(-4)).body.product.stock).toBe(9);
      expect((await ajustar(-100)).body.product.stock).toBe(0);
      expect((await api().post(`/api/v1/products/${p.id}/adjust-stock`).set(auth(owner.token)).send({ delta: 1.5 })).status).toBe(400);
    });

    it('el empleado ve productos pero no los administra', async () => {
      const p = await nuevoProducto({ nombre: 'Visible' });
      const lista = await api().get('/api/v1/products').set(auth(empleado.token));
      expect(lista.body.products.map((x) => x.id)).toContain(p.id);
      const crear = await api().post('/api/v1/products').set(auth(empleado.token))
        .send({ nombre: 'X', categoria: 'Styling', stock: 1, stockMinimo: 1, unidad: 'unidad', precioVenta: 1 });
      expect(crear.status).toBe(403);
      expect((await api().patch(`/api/v1/products/${p.id}`).set(auth(empleado.token)).send({ stock: 999 })).status).toBe(403);
      expect((await api().delete(`/api/v1/products/${p.id}`).set(auth(empleado.token))).status).toBe(403);
      expect((await api().post(`/api/v1/products/${p.id}/adjust-stock`).set(auth(empleado.token)).send({ delta: 5 })).status).toBe(403);
    });

    it('otro negocio no ve ni modifica estos productos', async () => {
      const p = await nuevoProducto({ nombre: 'Ajeno' });
      expect((await api().get('/api/v1/products').set(auth(rival.token))).body.products).toEqual([]);
      expect((await api().patch(`/api/v1/products/${p.id}`).set(auth(rival.token)).send({ stock: 999 })).status).toBe(404);
      expect((await api().post(`/api/v1/products/${p.id}/adjust-stock`).set(auth(rival.token)).send({ delta: 5 })).status).toBe(404);
      expect(await stockDe(p.id)).toBe(5);
    });
  });

  describe('ventas', () => {
    it('descuenta el stock, calcula el total y registra el cliente', async () => {
      const p = await nuevoProducto({ stock: 5, precioVenta: 28000 });
      const res = await vender(owner.token, { productId: p.id, quantity: 2, clientName: 'Cliente Tienda' });
      expect(res.status).toBe(201);
      expect(res.body.venta).toMatchObject({ cantidad: 2, precioUnitario: 28000, total: 56000, cliente: 'Cliente Tienda' });
      expect(await stockDe(p.id)).toBe(3);

      const clientes = await api().get('/api/v1/clients?search=Cliente Tienda').set(auth(owner.token));
      expect(clientes.body.clients).toHaveLength(1);
      expect(clientes.body.clients[0].gasto).toBe(56000);
    });

    it('el empleado sí puede vender', async () => {
      const p = await nuevoProducto({ stock: 2 });
      expect((await vender(empleado.token, { productId: p.id, quantity: 1 })).status).toBe(201);
    });

    it('rechaza cantidades inválidas y stock insuficiente sin tocar el inventario', async () => {
      const p = await nuevoProducto({ stock: 2 });
      expect((await vender(owner.token, { productId: p.id, quantity: 3 })).status).toBe(400);
      expect((await vender(owner.token, { productId: p.id, quantity: 0 })).status).toBe(400);
      expect((await vender(owner.token, { productId: p.id, quantity: -1 })).status).toBe(400);
      expect((await vender(owner.token, { productId: p.id, quantity: 1.5 })).status).toBe(400);
      expect(await stockDe(p.id)).toBe(2);
    });

    it('dos ventas simultáneas por la última unidad: solo una pasa y el stock no queda negativo', async () => {
      const p = await nuevoProducto({ stock: 3 });
      const [a, b] = await Promise.all([
        vender(owner.token, { productId: p.id, quantity: 3 }),
        vender(owner.token, { productId: p.id, quantity: 3 }),
      ]);
      expect([a.status, b.status].sort()).toEqual([201, 400]);
      expect(await stockDe(p.id)).toBe(0);
    });

    it('muchas ventas simultáneas nunca venden más de lo que hay', async () => {
      const p = await nuevoProducto({ stock: 4 });
      const resultados = await Promise.all(Array.from({ length: 8 }, () => vender(owner.token, { productId: p.id, quantity: 1 })));
      expect(resultados.filter((r) => r.status === 201)).toHaveLength(4);
      expect(await stockDe(p.id)).toBe(0);
    });

    it('no se puede vender un producto eliminado ni de otro negocio', async () => {
      const eliminado = await nuevoProducto({ nombre: 'Eliminado' });
      await api().delete(`/api/v1/products/${eliminado.id}`).set(auth(owner.token));
      expect((await vender(owner.token, { productId: eliminado.id, quantity: 1 })).status).toBe(404);

      const ajeno = await nuevoProducto({ nombre: 'Ajeno 2' });
      expect((await vender(rival.token, { productId: ajeno.id, quantity: 1 })).status).toBe(404);
      expect(await stockDe(ajeno.id)).toBe(5);
    });

    it('el historial se conserva al eliminar el producto y no se filtra a otro negocio', async () => {
      const p = await nuevoProducto({ nombre: 'Historia', stock: 5 });
      await vender(owner.token, { productId: p.id, quantity: 1 });
      await api().delete(`/api/v1/products/${p.id}`).set(auth(owner.token));
      const propias = await api().get('/api/v1/product-sales').set(auth(owner.token));
      expect(propias.body.ventas.some((v) => v.producto === 'Historia')).toBe(true);
      const ajenas = await api().get('/api/v1/product-sales').set(auth(rival.token));
      expect(ajenas.body.ventas).toEqual([]);
    });
  });
});
