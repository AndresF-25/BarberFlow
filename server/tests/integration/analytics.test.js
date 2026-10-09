import { beforeAll, describe, expect, it } from 'vitest';
import {
  api, auth, bizDay, bizToday, createAppointment, createEmployee, createService, dbUp, registerOwner,
} from '../helpers.js';

const get = (token, path) => api().get(`/api/v1/analytics${path}`).set(auth(token));

describe.skipIf(!dbUp)('analíticas', () => {
  describe('negocio sin actividad', () => {
    let owner;
    beforeAll(async () => { owner = await registerOwner('vacio'); });

    it('todo en cero, sin NaN y con las series completas', async () => {
      const d = (await get(owner.token, '/dashboard')).body;
      expect(d).toMatchObject({ citasHoy: 0, finalizadas: 0, pendientes: 0, ingresosHoy: 0, ingresosSemana: 0, ingresosMes: 0, ocupacion: 0, clientesNuevosMes: 0 });
      expect(d.semana).toHaveLength(7);
      expect(d.semana.map((s) => s.dia)).toEqual(['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']);
      expect(JSON.stringify(d)).not.toMatch(/NaN|Infinity/);
    });

    it('las tendencias sin base de comparación son null (no 0 ni 100)', async () => {
      const { trends } = (await get(owner.token, '/dashboard')).body;
      expect(Object.values(trends).every((t) => t === null)).toBe(true);
    });

    it('ingresos, métricas y alertas responden vacíos', async () => {
      const r = (await get(owner.token, '/revenue?period=month')).body;
      expect(r.data).toHaveLength(6);
      expect(r.resumen).toMatchObject({ ingresosMes: 0, serviciosRealizados: 0, ticketPromedio: 0, servicioTop: null });
      expect(r.paymentMethods).toEqual([]);

      const m = (await get(owner.token, '/metrics?period=week')).body;
      expect(m).toMatchObject({ demandaHora: [], nuevosVsRecurrentes: [], ocupacion: 0, topServicio: null });
      expect(m.rentabilidadDia).toHaveLength(7);
      expect(m.evolucionMensual).toHaveLength(6);

      expect((await get(owner.token, '/alerts')).body.alerts).toEqual([]);
    });
  });

  describe('con actividad', () => {
    let owner;

    beforeAll(async () => {
      owner = await registerOwner('actividad');
      const e1 = await createEmployee(owner.token, 'Uno');
      await createEmployee(owner.token, 'Dos'); // 2 barberos activos para la ocupación
      const corte = await createService(owner.token, { nombre: 'Corte', precio: 30000, duracion: 60 });
      const barba = await createService(owner.token, { nombre: 'Barba', precio: 20000, duracion: 30 });

      const reservar = async (servicio, time, cliente, metodo) => {
        const c = await createAppointment(owner.token, { serviceId: servicio.id, employeeId: e1.id, date: bizDay(1), time, clientName: cliente });
        await api().patch(`/api/v1/appointments/${c.body.appointment.id}`).set(auth(owner.token)).send({ status: 'completed', paymentMethod: metodo });
      };
      await reservar(corte, '09:00', 'Ana', 'cash');
      await reservar(corte, '10:00', 'Beto', 'card');
      await reservar(barba, '11:00', 'Ana', 'cash');

      const p = await api().post('/api/v1/products').set(auth(owner.token))
        .send({ nombre: 'Cera', categoria: 'Styling', stock: 1, stockMinimo: 2, unidad: 'unidad', precioVenta: 10000 });
      await api().post('/api/v1/product-sales').set(auth(owner.token)).send({ productId: p.body.product.id, quantity: 1 });
    });

    it('el panel suma servicios finalizados y ventas de productos', async () => {
      const d = (await get(owner.token, '/dashboard')).body;
      expect(d.ingresosHoy).toBe(90000); // 30.000 + 30.000 + 20.000 + 10.000
      expect(d.ingresosMes).toBeGreaterThanOrEqual(90000);
      expect(d.semana.reduce((a, s) => a + s.ingresos, 0)).toBe(d.ingresosSemana);
      expect(d.clientesNuevosMes).toBe(2); // Ana y Beto
    });

    it('usa la fecha del negocio para "hoy" y acepta consultar otro día', async () => {
      expect((await get(owner.token, `/dashboard?date=${bizToday()}`)).body.ingresosHoy).toBe(90000);
      expect((await get(owner.token, `/dashboard?date=${bizDay(-30)}`)).body.ingresosHoy).toBe(0);
    });

    it('ingresos: resumen, servicio top, ticket promedio y métodos de pago', async () => {
      const r = (await get(owner.token, '/revenue?period=month')).body;
      expect(r.resumen).toMatchObject({ ingresosMes: 90000, serviciosRealizados: 3, servicioTop: { nombre: 'Corte', ingresos: 60000 } });
      expect(r.resumen.ticketPromedio).toBe(Math.round(80000 / 3)); // solo servicios, no productos
      expect(r.servicesComparison.map((s) => `${s.name}:${s.ingresos}`)).toEqual(['Corte:60000', 'Barba:20000']);
      expect(r.paymentMethods.find((m) => m.name === 'Efectivo').value).toBe(63); // 50.000 de 80.000
      expect(r.paymentMethods.reduce((a, m) => a + m.value, 0)).toBeGreaterThanOrEqual(99);
      expect(r.data[5]).toMatchObject({ ingresos: 90000, clientes: 2 });
    });

    it('la vista semanal entrega 7 días que suman lo mismo que el panel', async () => {
      const r = (await get(owner.token, '/revenue?period=week')).body;
      expect(r.data).toHaveLength(7);
      const panel = (await get(owner.token, '/dashboard')).body;
      expect(r.data.reduce((a, d) => a + d.ingresos, 0)).toBe(panel.ingresosSemana);
    });

    it('métricas: demanda ordenada por hora, ocupación, nuevos vs recurrentes y rentabilidad', async () => {
      const m = (await get(owner.token, '/metrics?period=month')).body;
      expect(m.demandaHora.map((h) => h.hora)).toEqual(['9am', '10am', '11am']);
      expect(m.ocupacion).toBe(13); // 150 min agendados / (2 barberos × 600 min × 1 día activo)
      expect(m.nuevosVsRecurrentes.find((x) => x.name === 'Nuevos').value).toBe(100);
      expect(m.topServicio).toEqual({ nombre: 'Corte', veces: 2 });
      expect(m.rentabilidadDia).toHaveLength(7);
      expect(m.rentabilidadDia.reduce((a, d) => a + d.valor, 0)).toBe(90000);
    });

    it('alertas: stock bajo con destino a inventario', async () => {
      const { alerts } = (await get(owner.token, '/alerts')).body;
      expect(alerts.find((a) => a.id === 'stock')).toMatchObject({ destino: 'inventario', prioridad: 'alta' }); // la venta del beforeAll agota el único producto: urgente
    });
  });

  describe('seguridad y validación', () => {
    it('solo el propietario accede; el empleado y los anónimos no', async () => {
      const owner = await registerOwner('seg');
      const emp = await createEmployee(owner.token);
      for (const ruta of ['/dashboard', '/revenue', '/metrics', '/alerts']) {
        expect((await get(emp.token, ruta)).status).toBe(403);
        expect((await api().get(`/api/v1/analytics${ruta}`)).status).toBe(401);
      }
    });

    it('cada negocio ve solo sus propias cifras', async () => {
      const a = await registerOwner('a');
      const b = await registerOwner('b');
      const servicio = await createService(a.token);
      const emp = await createEmployee(a.token);
      const cita = await createAppointment(a.token, { serviceId: servicio.id, employeeId: emp.id, date: bizDay(1), time: '10:00' });
      await api().patch(`/api/v1/appointments/${cita.body.appointment.id}`).set(auth(a.token)).send({ status: 'completed' });
      expect((await get(a.token, '/dashboard')).body.ingresosHoy).toBe(30000);
      expect((await get(b.token, '/dashboard')).body.ingresosHoy).toBe(0);
    });

    it('una fecha inválida responde 400', async () => {
      const owner = await registerOwner('fecha');
      expect((await get(owner.token, '/dashboard?date=2030-02-31')).status).toBe(400);
      expect((await get(owner.token, '/revenue?anchorDate=basura')).status).toBe(400);
      expect((await get(owner.token, '/metrics?anchorDate=2030-13-01')).status).toBe(400);
    });
  });
});
