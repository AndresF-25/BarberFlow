/**
 * Módulo 10 — Analíticas (GET /analytics/dashboard, /revenue, /metrics, /alerts; solo dueño).
 * Los valores esperados se calculan desde el dataset con lógica independiente de la del servidor.
 * Lo que crea o modifica usa negocios @test.local nuevos.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  api, auth, prisma, registerOwner, createEmployee, createService, requireSeed, demoSessions, biz, hoy,
} from './helpers-demo.js';
import {
  addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
} from '../../src/lib/utils.js';

const pedir = (token, ruta, query = '') => api().get(`/api/v1/analytics/${ruta}${query}`).set(auth(token));
const SIN_INGLES = /Required|Expected|Invalid|must contain|String must|Number must/i;
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const diasEntre = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const mesAtras = (fecha, n) => { const d = new Date(`${startOfMonth(fecha)}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };
const pct = (a, b) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);

// --- modelo independiente del dataset ----------------------------------------------------------------
function modelo(key) {
  const b = biz(key);
  const servicio = Object.fromEntries(b.services.map((s) => [s.key, s]));
  const producto = Object.fromEntries(b.products.map((p) => [p.key, p]));
  const cliente = Object.fromEntries(b.clients.map((c) => [c.key, c]));
  const empleadosActivos = b.staff.filter((s) => s.active).length;
  const citas = b.appointments;
  const noCanceladas = (f) => citas.filter((a) => a.status !== 'cancelled' && f(a));
  const dinero = [
    ...citas.filter((a) => a.status === 'completed').map((a) => ({ fecha: a.date, centavos: servicio[a.service].precio, tipo: 'servicio', metodo: a.pay, cliente: a.client, servicio: a.service })),
    ...b.sales.map((v) => ({ fecha: v.date, centavos: v.qty * producto[v.product].precioVenta, tipo: 'producto' })),
  ];
  const suma = (filas) => filas.reduce((n, f) => n + f.centavos, 0);
  const enRango = (desde, hasta, filas = dinero) => filas.filter((f) => f.fecha >= desde && f.fecha <= hasta);
  const minutos = (lista) => lista.reduce((n, a) => n + servicio[a.service].duracion, 0);
  const ocupacion = (lista, dias = 1) => (empleadosActivos ? Math.min(100, Math.round((minutos(lista) / (empleadosActivos * 600 * dias)) * 100)) : 0);
  const nuevosClientes = (desde, hasta) => b.clients.filter((c) => c.createdDate >= desde && c.createdDate <= hasta).length;
  return { b, servicio, cliente, citas, noCanceladas, dinero, suma, enRango, minutos, ocupacion, nuevosClientes, empleadosActivos };
}

function esperadoPanel(m, fecha) {
  const semDesde = startOfWeek(fecha);
  const semHasta = endOfWeek(fecha);
  const mesDesde = startOfMonth(fecha);
  const mesHasta = endOfMonth(fecha);
  const hoyCitas = m.noCanceladas((a) => a.date === fecha);
  const haceUnaSemana = addDays(fecha, -7);
  const citasPrev = m.noCanceladas((a) => a.date === haceUnaSemana);
  const transcurridoSem = diasEntre(semDesde, fecha);
  const semPrevDesde = addDays(semDesde, -7);
  const mesPrevDesde = mesAtras(fecha, -1);
  const mesPrevHasta = endOfMonth(mesPrevDesde);
  const diaDelMes = Number(fecha.slice(8));
  const mesPrevTramoHasta = [addDays(mesPrevDesde, diaDelMes - 1), mesPrevHasta].sort()[0];
  const ingresosHoy = m.suma(m.enRango(fecha, fecha));
  return {
    citasHoy: hoyCitas.length,
    finalizadas: hoyCitas.filter((a) => a.status === 'completed').length,
    pendientes: hoyCitas.filter((a) => a.status === 'pending' || a.status === 'confirmed').length,
    ingresosHoy,
    ingresosSemana: m.suma(m.enRango(semDesde, semHasta)),
    ingresosMes: m.suma(m.enRango(mesDesde, mesHasta)),
    ocupacion: m.ocupacion(hoyCitas),
    clientesNuevosMes: m.nuevosClientes(mesDesde, mesHasta),
    semana: Array.from({ length: 7 }, (_, i) => ({ dia: DIAS[i], fecha: addDays(semDesde, i), ingresos: m.suma(m.enRango(addDays(semDesde, i), addDays(semDesde, i))) })),
    trends: {
      citas: pct(hoyCitas.length, citasPrev.length),
      ingresos: pct(ingresosHoy, m.suma(m.enRango(haceUnaSemana, haceUnaSemana))),
      ocupacion: pct(m.ocupacion(hoyCitas), m.ocupacion(citasPrev)),
      // Mismo tramo del período anterior: la semana/mes en curso no se compara con la anterior ya completa.
      semana: pct(m.suma(m.enRango(semDesde, fecha)), m.suma(m.enRango(semPrevDesde, addDays(semPrevDesde, transcurridoSem)))),
      mes: pct(m.suma(m.enRango(mesDesde, fecha)), m.suma(m.enRango(mesPrevDesde, mesPrevTramoHasta))),
      clientesNuevos: pct(m.nuevosClientes(mesDesde, fecha), m.nuevosClientes(mesPrevDesde, mesPrevTramoHasta)),
    },
  };
}

describe('Módulo 10 · analíticas', () => {
  let s;
  let navaja;
  beforeAll(async () => { await requireSeed(); s = await demoSessions(); navaja = modelo('navaja'); });

  describe('panel general (/analytics/dashboard)', () => {
    it('la forma exacta', async () => {
      const r = await pedir(s.navaja.owner, 'dashboard');
      expect(r.status).toBe(200);
      expect(Object.keys(r.body).sort()).toEqual(['citasHoy', 'clientesNuevosMes', 'date', 'finalizadas', 'ingresosHoy', 'ingresosMes', 'ingresosSemana', 'ocupacion', 'pendientes', 'rangoSemana', 'semana', 'trends'].sort());
      expect(Object.keys(r.body.trends).sort()).toEqual(['citas', 'clientesNuevos', 'ingresos', 'mes', 'ocupacion', 'semana']);
      expect(r.body.date).toBe(hoy);
      expect(r.body.rangoSemana).toEqual({ desde: startOfWeek(hoy), hasta: endOfWeek(hoy) });
      expect(r.body.semana).toHaveLength(7);
    });

    it('hoy: citas, finalizadas, por atender, ingresos de hoy/semana/mes, ocupación y clientes nuevos coinciden con el dataset', async () => {
      const r = (await pedir(s.navaja.owner, 'dashboard')).body;
      const e = esperadoPanel(navaja, hoy);
      expect(r).toMatchObject({
        citasHoy: e.citasHoy, finalizadas: e.finalizadas, pendientes: e.pendientes, ingresosHoy: e.ingresosHoy,
        ingresosSemana: e.ingresosSemana, ingresosMes: e.ingresosMes, ocupacion: e.ocupacion, clientesNuevosMes: e.clientesNuevosMes,
      });
      expect(r.semana).toEqual(e.semana);
      expect(r.citasHoy).toBeGreaterThan(0);
      expect(r.ingresosHoy).toBeGreaterThan(0);
    });

    it('el día se puede elegir con ?date= y todo se recalcula para ese día (4 fechas, incluidos lunes, domingo y fin de mes)', async () => {
      const lunes = addDays(startOfWeek(hoy), -7);
      const domingo = addDays(lunes, -1);
      const finDeMes = endOfMonth(addDays(startOfMonth(hoy), -1));
      for (const fecha of [addDays(hoy, -10), lunes, domingo, finDeMes, addDays(hoy, 5)]) {
        const r = await pedir(s.navaja.owner, 'dashboard', `?date=${fecha}`);
        expect(r.status, fecha).toBe(200);
        const e = esperadoPanel(navaja, fecha);
        expect(r.body.date).toBe(fecha);
        expect(r.body, fecha).toMatchObject({
          citasHoy: e.citasHoy, finalizadas: e.finalizadas, pendientes: e.pendientes, ingresosHoy: e.ingresosHoy,
          ingresosSemana: e.ingresosSemana, ingresosMes: e.ingresosMes, ocupacion: e.ocupacion, clientesNuevosMes: e.clientesNuevosMes,
        });
        expect(r.body.semana, fecha).toEqual(e.semana);
        expect(r.body.trends, fecha).toEqual(e.trends);
      }
    });

    it('H68 [media]: la semana y el mes en curso se comparan con el MISMO tramo del período anterior, no con el anterior completo', async () => {
      // Un lunes: la semana en curso solo tiene un día. Antes se comparaba con la semana pasada entera (≈ −85 %).
      const lunes = addDays(startOfWeek(hoy), -7);
      const r = (await pedir(s.navaja.owner, 'dashboard', `?date=${lunes}`)).body;
      const e = esperadoPanel(navaja, lunes);
      expect(r.trends.semana).toBe(e.trends.semana);
      // día 3 del mes: tres días contra los tres primeros del mes anterior
      const dia3 = `${startOfMonth(addDays(startOfMonth(hoy), -1)).slice(0, 8)}03`;
      const r3 = (await pedir(s.navaja.owner, 'dashboard', `?date=${dia3}`)).body;
      expect(r3.trends.mes).toBe(esperadoPanel(navaja, dia3).trends.mes);
      // el valor mostrado sigue siendo el de la semana/mes completos
      expect(r3.ingresosMes).toBe(esperadoPanel(navaja, dia3).ingresosMes);
    });

    it('las tendencias son null cuando no hay base de comparación (nunca NaN ni Infinity)', async () => {
      const r = (await pedir(s.nueva.owner, 'dashboard')).body;
      expect(Object.values(r.trends)).toEqual([null, null, null, null, null, null]);
      const todos = (await pedir(s.navaja.owner, 'dashboard', `?date=${addDays(hoy, -300)}`)).body;
      for (const v of Object.values(todos.trends)) expect(v === null || Number.isFinite(v)).toBe(true);
    });

    it('fechas inválidas dan 400 en español, no 500', async () => {
      for (const q of ['?date=basura', '?date=2030-02-31', '?date=2030-13-01', '?date=2030-1-1', '?date=30-01-2030', '?date=%20', '?date=2030-01-01T00:00:00Z']) {
        const r = await pedir(s.navaja.owner, 'dashboard', q);
        expect(r.status, q).toBe(400);
        expect(r.body.error).not.toMatch(SIN_INGLES);
      }
      expect((await pedir(s.navaja.owner, 'dashboard', '?date=')).status).toBe(200);
    });

    it('Barbería Nueva (vacía): todo en cero y la semana de 7 días con 0', async () => {
      const r = (await pedir(s.nueva.owner, 'dashboard')).body;
      expect(r).toMatchObject({ citasHoy: 0, finalizadas: 0, pendientes: 0, ingresosHoy: 0, ingresosSemana: 0, ingresosMes: 0, ocupacion: 0, clientesNuevosMes: 0 });
      expect(r.semana.map((d) => d.ingresos)).toEqual(Array(7).fill(0));
    });

    it('El Fade tiene sus propios números', async () => {
      const f = modelo('fade');
      const r = (await pedir(s.fade.owner, 'dashboard')).body;
      const e = esperadoPanel(f, hoy);
      expect(r).toMatchObject({ citasHoy: e.citasHoy, ingresosHoy: e.ingresosHoy, ingresosSemana: e.ingresosSemana, ingresosMes: e.ingresosMes });
      expect(r.ingresosMes).not.toBe(esperadoPanel(navaja, hoy).ingresosMes);
    });
  });

  describe('día del negocio y barberos dados de baja', () => {
    const montar = async (label) => {
      const d = await registerOwner(label);
      const user = await prisma.user.findFirst({ where: { businessId: d.business.id } });
      return { d, user };
    };

    it('H69 [media]: una venta de las 9:30 p. m. en Bogotá (02:30 UTC del día siguiente) cuenta en SU día en el panel y en la serie semanal', async () => {
      const { d, user } = await montar('tz');
      const p = await prisma.product.create({ data: { businessId: d.business.id, name: 'Cera', category: 'Styling', stock: 5, stockMin: 1, unit: 'unidad', salePriceCents: 2800000 } });
      await prisma.productSale.create({ data: { businessId: d.business.id, productId: p.id, quantity: 1, unitPriceCents: 2800000, totalCents: 2800000, soldAt: new Date('2026-06-11T02:30:00.000Z'), soldById: user.id } });
      const dia10 = (await pedir(d.token, 'dashboard', '?date=2026-06-10')).body;
      const dia11 = (await pedir(d.token, 'dashboard', '?date=2026-06-11')).body;
      expect(dia10.ingresosHoy).toBe(28000);
      expect(dia11.ingresosHoy).toBe(0);
      expect(dia10.semana.find((x) => x.fecha === '2026-06-10').ingresos).toBe(28000);
      expect(dia10.semana.find((x) => x.fecha === '2026-06-11').ingresos).toBe(0);
    });

    it('H70 [media]: la ocupación cuenta también a los barberos dados de baja que atendieron ese día (antes superaba el 100 % o se inflaba)', async () => {
      const { d, user } = await montar('baja');
      const servicio = await createService(d.token, { nombre: 'Corte', precio: 30000, duracion: 60 });
      const activo = await createEmployee(d.token, 'Barbero Activo');
      const saliente = await createEmployee(d.token, 'Barbero Saliente');
      const dia = '2026-06-10';
      const nueva = (employeeId, hora) => prisma.appointment.create({
        data: { businessId: d.business.id, serviceId: servicio.id, employeeId, appointmentDate: new Date(`${dia}T00:00:00.000Z`), startTime: hora, status: 'completed', clientName: 'Cliente', clientPhone: '', createdById: user.id },
      });
      for (const h of ['08:00', '09:00', '10:00', '11:00']) await nueva(activo.id, h); // 240 min
      for (const h of ['08:00', '09:00', '10:00', '11:00']) await nueva(saliente.id, h); // 240 min
      await api().patch(`/api/v1/auth/employees/${saliente.id}`).set(auth(d.token)).send({ active: false });
      const r = (await pedir(d.token, 'dashboard', `?date=${dia}`)).body;
      // 480 min reservados sobre 2 barberos × 600 min = 40 % (con solo el activo daría 80 %)
      expect(r.ocupacion).toBe(40);
      const m = (await pedir(d.token, 'metrics', `?anchorDate=${dia}`)).body;
      expect(m.ocupacion).toBe(40);
    });
  });

  describe('ingresos (/analytics/revenue)', () => {
    const esperadoMes = (m, ancla) => {
      const desde = startOfMonth(ancla);
      const hasta = endOfMonth(ancla);
      const filas = m.enRango(desde, hasta);
      const serv = filas.filter((f) => f.tipo === 'servicio');
      const porServicio = {};
      serv.forEach((f) => { porServicio[f.servicio] = (porServicio[f.servicio] || 0) + f.centavos; });
      return { filas, serv, porServicio, total: m.suma(filas) };
    };

    it('semana: la serie son los 7 días de la semana de la fecha y coincide con el dataset', async () => {
      const r = await pedir(s.navaja.owner, 'revenue');
      expect(r.status).toBe(200);
      expect(r.body.period).toBe('week');
      expect(r.body.data).toEqual(esperadoPanel(navaja, hoy).semana);
      expect(Object.keys(r.body).sort()).toEqual(['data', 'paymentMethods', 'period', 'resumen', 'servicesComparison']);
    });

    it('mes: 6 meses con su etiqueta, ingresos (servicios + productos) y clientes distintos atendidos', async () => {
      const r = (await pedir(s.navaja.owner, 'revenue', '?period=month')).body;
      expect(r.period).toBe('month');
      expect(r.data).toHaveLength(6);
      for (let i = 0; i < 6; i += 1) {
        const desde = mesAtras(hoy, i - 5);
        const filas = navaja.enRango(desde, endOfMonth(desde));
        const clientes = new Set(filas.filter((f) => f.tipo === 'servicio' && f.cliente).map((f) => f.cliente));
        expect(r.data[i], desde).toEqual({ mes: MESES[Number(desde.slice(5, 7)) - 1], ingresos: navaja.suma(filas), clientes: clientes.size });
      }
    });

    it('resumen del mes: ingresos, servicios realizados, ticket promedio (solo servicios) y servicio top', async () => {
      const r = (await pedir(s.navaja.owner, 'revenue')).body.resumen;
      const e = esperadoMes(navaja, hoy);
      expect(r.ingresosMes).toBe(e.total);
      expect(r.serviciosRealizados).toBe(e.serv.length);
      expect(r.ticketPromedio).toBe(Math.round(e.serv.reduce((n, f) => n + f.centavos, 0) / e.serv.length));
      const [topKey, topCent] = Object.entries(e.porServicio).sort((a, b) => b[1] - a[1])[0];
      expect(r.servicioTop).toEqual({ nombre: navaja.servicio[topKey].nombre, ingresos: topCent });
    });

    it('ingresos por servicio: ordenados de mayor a menor y suman los ingresos por servicios del mes', async () => {
      const r = (await pedir(s.navaja.owner, 'revenue')).body.servicesComparison;
      const e = esperadoMes(navaja, hoy);
      const valores = r.map((x) => x.ingresos);
      expect(valores).toEqual([...valores].sort((a, b) => b - a));
      expect(valores.reduce((n, v) => n + v, 0)).toBe(e.serv.reduce((n, f) => n + f.centavos, 0));
      expect(r.map((x) => x.name).sort()).toEqual(Object.keys(e.porServicio).map((k) => navaja.servicio[k].nombre).sort());
    });

    it('H71 [media]: los porcentajes de métodos de pago suman exactamente 100 y respetan la proporción', async () => {
      for (const ancla of [hoy, addDays(hoy, -30), addDays(hoy, -60), addDays(hoy, -90)]) {
        const r = (await pedir(s.navaja.owner, 'revenue', `?anchorDate=${ancla}`)).body.paymentMethods;
        if (r.length === 0) continue;
        expect(r.reduce((n, x) => n + x.value, 0), ancla).toBe(100);
        const e = esperadoMes(navaja, ancla);
        const porMetodo = {};
        e.serv.forEach((f) => { porMetodo[f.metodo] = (porMetodo[f.metodo] || 0) + f.centavos; });
        const total = Object.values(porMetodo).reduce((n, v) => n + v, 0);
        for (const x of r) {
          const clave = { Efectivo: 'cash', Tarjeta: 'card', 'Transferencia/Nequi': 'transfer' }[x.name];
          expect(Math.abs(x.value - (porMetodo[clave] / total) * 100), `${ancla} ${x.name}`).toBeLessThan(1);
        }
      }
    });

    it('los métodos de pago traen nombre, valor y color, y solo los usados', async () => {
      const r = (await pedir(s.navaja.owner, 'revenue')).body.paymentMethods;
      for (const m of r) expect(Object.keys(m).sort()).toEqual(['color', 'name', 'value']);
      expect(r.map((m) => m.name).sort()).toEqual(['Efectivo', 'Tarjeta', 'Transferencia/Nequi']);
    });

    it('H68b: la tendencia del mes compara con el mismo tramo del mes anterior', async () => {
      const dia = `${startOfMonth(hoy).slice(0, 8)}05`;
      const r = (await pedir(s.navaja.owner, 'revenue', `?anchorDate=${dia}`)).body.resumen;
      const mesDesde = startOfMonth(dia);
      const prevDesde = mesAtras(dia, -1);
      const prevTramo = [addDays(prevDesde, 4), endOfMonth(prevDesde)].sort()[0];
      expect(r.trendMes).toBe(pct(navaja.suma(navaja.enRango(mesDesde, dia)), navaja.suma(navaja.enRango(prevDesde, prevTramo))));
    });

    it('H72 [media]: un período desconocido da 400 en español (antes se tomaba «week» en silencio)', async () => {
      for (const ruta of ['revenue', 'metrics']) {
        for (const q of ['?period=year', '?period=MONTH', '?period=', '?period=1', '?period=week;x']) {
          const r = await pedir(s.navaja.owner, ruta, q);
          if (q === '?period=') { expect(r.status, `${ruta}${q}`).toBe(200); continue; }
          expect(r.status, `${ruta}${q}`).toBe(400);
          expect(r.body.code).toBe('VALIDATION_ERROR');
          expect(r.body.error).not.toMatch(SIN_INGLES);
          expect(r.body.error).toMatch(/per[ií]odo/i);
        }
        expect((await pedir(s.navaja.owner, ruta, '?period=week')).status).toBe(200);
        expect((await pedir(s.navaja.owner, ruta, '?period=month')).status).toBe(200);
      }
    });

    it('anchorDate inválida da 400; una fecha lejana sin datos da ceros', async () => {
      for (const ruta of ['revenue', 'metrics']) {
        for (const q of ['?anchorDate=basura', '?anchorDate=2030-02-31', '?anchorDate=2030-1-1']) expect((await pedir(s.navaja.owner, ruta, q)).status, `${ruta}${q}`).toBe(400);
      }
      const vacio = (await pedir(s.navaja.owner, 'revenue', '?anchorDate=2020-03-15&period=month')).body;
      expect(vacio.data.map((x) => x.ingresos)).toEqual(Array(6).fill(0));
      expect(vacio.resumen).toMatchObject({ ingresosMes: 0, trendMes: null, serviciosRealizados: 0, ticketPromedio: 0, servicioTop: null });
      expect(vacio.paymentMethods).toEqual([]);
      expect(vacio.servicesComparison).toEqual([]);
    });

    it('Barbería Nueva: ceros y listas vacías, sin dividir entre cero', async () => {
      const r = (await pedir(s.nueva.owner, 'revenue', '?period=month')).body;
      expect(r.resumen).toEqual({ ingresosMes: 0, trendMes: null, serviciosRealizados: 0, ticketPromedio: 0, servicioTop: null });
      expect(r.paymentMethods).toEqual([]);
      expect(r.data.every((x) => x.ingresos === 0 && x.clientes === 0)).toBe(true);
    });
  });

  describe('métricas (/analytics/metrics)', () => {
    const rango = (period, ancla) => (period === 'month' ? [startOfMonth(ancla), endOfMonth(ancla)] : [startOfWeek(ancla), endOfWeek(ancla)]);

    it('la forma exacta, para semana y mes', async () => {
      for (const period of ['week', 'month']) {
        const r = await pedir(s.navaja.owner, 'metrics', `?period=${period}`);
        expect(r.status).toBe(200);
        expect(Object.keys(r.body).sort()).toEqual(['demandaHora', 'evolucionMensual', 'nuevosVsRecurrentes', 'ocupacion', 'period', 'rentabilidadDia', 'topServicio']);
        expect(r.body.period).toBe(period);
      }
    });

    it('demanda por hora: citas no canceladas del período agrupadas por hora, de la mañana a la noche', async () => {
      for (const period of ['week', 'month']) {
        const [desde, hasta] = rango(period, hoy);
        const citas = navaja.noCanceladas((a) => a.date >= desde && a.date <= hasta);
        const porHora = {};
        citas.forEach((a) => { const h = Number(a.time.slice(0, 2)); porHora[h] = (porHora[h] || 0) + 1; });
        const esperado = Object.keys(porHora).map(Number).sort((a, b) => a - b).map((h) => ({ hora: `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`, citas: porHora[h] }));
        const r = (await pedir(s.navaja.owner, 'metrics', `?period=${period}`)).body;
        expect(r.demandaHora, period).toEqual(esperado);
      }
    });

    it('ingresos por día de la semana: suma del período (servicios + productos) por Lun…Dom', async () => {
      for (const period of ['week', 'month']) {
        const [desde, hasta] = rango(period, hoy);
        const esperado = Array(7).fill(0);
        navaja.enRango(desde, hasta).forEach((f) => { esperado[(new Date(`${f.fecha}T00:00:00Z`).getUTCDay() + 6) % 7] += f.centavos; });
        const r = (await pedir(s.navaja.owner, 'metrics', `?period=${period}`)).body;
        expect(r.rentabilidadDia, period).toEqual(DIAS.map((dia, i) => ({ dia, valor: esperado[i] })));
      }
    });

    it('H71b: nuevos vs. recurrentes suma exactamente 100 y se calcula por la primera visita de toda la vida', async () => {
      for (const ancla of [hoy, addDays(hoy, -20), addDays(hoy, -45), addDays(hoy, -75), addDays(hoy, -100)]) {
        const [desde, hasta] = rango('month', ancla);
        const dosFilas = navaja.enRango(desde, hasta).filter((f) => f.tipo === 'servicio' && f.cliente);
        const ids = [...new Set(dosFilas.map((f) => f.cliente))];
        const r = (await pedir(s.navaja.owner, 'metrics', `?period=month&anchorDate=${ancla}`)).body.nuevosVsRecurrentes;
        if (ids.length === 0) { expect(r, ancla).toEqual([]); continue; }
        const primera = (c) => navaja.dinero.filter((f) => f.tipo === 'servicio' && f.cliente === c).map((f) => f.fecha).sort()[0];
        const nuevos = ids.filter((c) => primera(c) >= desde).length;
        expect(r.reduce((n, x) => n + x.value, 0), ancla).toBe(100);
        const nuevosPct = r.find((x) => x.name === 'Nuevos').value;
        expect(Math.abs(nuevosPct - (nuevos / ids.length) * 100), ancla).toBeLessThan(1);
      }
    });

    it('H73: el servicio más vendido es determinista: en empate gana el de más ingresos y luego el de nombre menor', async () => {
      const d = await registerOwner('empate');
      const b = await createEmployee(d.token, 'Barbero Empate');
      const user = await prisma.user.findFirst({ where: { businessId: d.business.id } });
      const barato = await createService(d.token, { nombre: 'Zeta barato', precio: 10000, duracion: 30 });
      const caro = await createService(d.token, { nombre: 'Beta caro', precio: 50000, duracion: 30 });
      const igual = await createService(d.token, { nombre: 'Alfa caro', precio: 50000, duracion: 30 });
      const dia = '2026-06-10';
      const cobrar = async (serv, precio, hora) => {
        const cliente = await prisma.client.create({ data: { businessId: d.business.id, name: `C ${serv.nombre} ${hora}`, phone: '' } });
        const cita = await prisma.appointment.create({ data: { businessId: d.business.id, clientId: cliente.id, serviceId: serv.id, employeeId: b.id, appointmentDate: new Date(`${dia}T00:00:00.000Z`), startTime: hora, status: 'completed', clientName: cliente.name, clientPhone: '', createdById: user.id } });
        await prisma.serviceTransaction.create({ data: { businessId: d.business.id, appointmentId: cita.id, serviceId: serv.id, clientId: cliente.id, employeeId: b.id, amountCents: precio * 100, paymentMethod: 'cash', completedAt: new Date(`${dia}T18:00:00.000Z`) } });
      };
      // cada servicio se hizo una vez: empate a 1 → gana el de más ingresos; entre iguales, «Alfa» por nombre
      await cobrar(barato, 10000, '08:00');
      await cobrar(caro, 50000, '09:00');
      await cobrar(igual, 50000, '10:00');
      for (let i = 0; i < 4; i += 1) {
        const r = (await pedir(d.token, 'metrics', `?anchorDate=${dia}`)).body;
        expect(r.topServicio).toEqual({ nombre: 'Alfa caro', veces: 1 });
      }
    });

    it('la ocupación del período se limita a 100 y la evolución mensual coincide con la de ingresos', async () => {
      const m = (await pedir(s.navaja.owner, 'metrics', '?period=month')).body;
      const i = (await pedir(s.navaja.owner, 'revenue', '?period=month')).body;
      expect(m.ocupacion).toBeLessThanOrEqual(100);
      expect(m.evolucionMensual).toEqual(i.data);
    });

    it('Barbería Nueva: listas vacías, ocupación 0 y sin servicio top', async () => {
      const r = (await pedir(s.nueva.owner, 'metrics')).body;
      expect(r).toMatchObject({ demandaHora: [], nuevosVsRecurrentes: [], ocupacion: 0, topServicio: null });
      expect(r.rentabilidadDia.every((x) => x.valor === 0)).toBe(true);
    });
  });

  describe('alertas (/analytics/alerts)', () => {
    const alerta = (r, tipo) => r.body.alerts.find((a) => a.tipo === tipo);

    it('La Navaja: inactivos, stock bajo, citas de hoy y fidelización, con la forma exacta', async () => {
      const r = await pedir(s.navaja.owner, 'alerts');
      expect(r.status).toBe(200);
      expect(Object.keys(r.body)).toEqual(['alerts']);
      for (const a of r.body.alerts) expect(Object.keys(a).sort()).toEqual(['accion', 'destino', 'detalle', 'id', 'items', 'prioridad', 'tipo', 'titulo']);
      expect(r.body.alerts.map((a) => a.tipo)).toEqual(expect.arrayContaining(['inactivos', 'stock', 'recordatorio', 'fidelizacion']));
      const orden = { alta: 0, media: 1, baja: 2 };
      const prios = r.body.alerts.map((a) => orden[a.prioridad]);
      expect(prios).toEqual([...prios].sort());
    });

    it('inactivos: cuenta los clientes «Inactivo» de la lista de clientes y muestra su última visita en español legible', async () => {
      const clientes = (await api().get('/api/v1/clients').set(auth(s.navaja.owner))).body.clients;
      const inactivos = clientes.filter((c) => c.etiqueta === 'Inactivo');
      const a = alerta(await pedir(s.navaja.owner, 'alerts'), 'inactivos');
      expect(a.prioridad).toBe('alta');
      expect(a.detalle).toContain(`${inactivos.length} cliente(s)`);
      expect(a.items.length).toBe(Math.min(5, inactivos.length));
      for (const it of a.items) {
        expect(inactivos.map((c) => c.nombre)).toContain(it.nombre);
        expect(it.dato).toMatch(/^Última visita: \d{1,2} (ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic) \d{4}$/);
      }
    });

    it('H74: stock bajo — los agotados primero, cantidades legibles («2 unidades», «Agotado») y prioridad alta si hay agotados', async () => {
      const productos = (await api().get('/api/v1/products').set(auth(s.navaja.owner))).body.products;
      const bajos = productos.filter((p) => p.stock <= p.stockMinimo).sort((a, b) => a.stock - b.stock || a.nombre.localeCompare(b.nombre, 'es'));
      const a = alerta(await pedir(s.navaja.owner, 'alerts'), 'stock');
      expect(a.items.map((x) => x.nombre)).toEqual(bajos.slice(0, 5).map((p) => p.nombre));
      expect(a.items[0].dato).toBe('Agotado');
      expect(a.items.find((x) => x.nombre === 'Cera mate').dato).toBe('2 unidades');
      expect(a.prioridad).toBe('alta');
      expect(a.detalle).toContain(`${bajos.length} producto(s)`);
      expect(JSON.stringify(a)).not.toMatch(/unidad\(s\)/);
    });

    it('citas de hoy: cuenta las pendientes y confirmadas de hoy, por hora, con su teléfono', async () => {
      const abiertas = navaja.noCanceladas((x) => x.date === hoy && x.status !== 'completed');
      const a = alerta(await pedir(s.navaja.owner, 'alerts'), 'recordatorio');
      expect(a.detalle).toContain(`${abiertas.length} cliente(s)`);
      const horas = a.items.map((x) => x.dato.slice(0, 5));
      expect(horas).toEqual([...horas].sort());
    });

    it('fidelización: aparece con 3 o más VIP y nombra sus visitas', async () => {
      const vip = (await api().get('/api/v1/clients?tag=VIP').set(auth(s.navaja.owner))).body.clients;
      const a = alerta(await pedir(s.navaja.owner, 'alerts'), 'fidelizacion');
      if (vip.length >= 3) {
        expect(a.detalle).toContain(`${vip.length} clientes VIP`);
        for (const it of a.items) expect(it.dato).toMatch(/^\d+ visitas$/);
      } else {
        expect(a).toBeUndefined();
      }
    });

    it('H75 [media]: una cita de un día anterior que sigue pendiente o confirmada genera una alerta «sin cerrar» (prioridad alta), la más antigua primero', async () => {
      const d = await registerOwner('sincerrar');
      const user = await prisma.user.findFirst({ where: { businessId: d.business.id } });
      const servicio = await createService(d.token, { nombre: 'Corte', precio: 30000, duracion: 30 });
      const barbero = await createEmployee(d.token, 'Barbero Cierre');
      const nueva = (fecha, hora, status, nombre) => prisma.appointment.create({
        data: { businessId: d.business.id, serviceId: servicio.id, employeeId: barbero.id, appointmentDate: new Date(`${fecha}T00:00:00.000Z`), startTime: hora, status, clientName: nombre, clientPhone: '', createdById: user.id },
      });
      await nueva(addDays(hoy, -1), '10:00', 'pending', 'De Ayer');
      await nueva(addDays(hoy, -3), '09:00', 'confirmed', 'De Hace Tres');
      await nueva(addDays(hoy, -2), '09:00', 'completed', 'Ya Cerrada');
      await nueva(addDays(hoy, -2), '11:00', 'cancelled', 'Cancelada');
      const r = await pedir(d.token, 'alerts');
      const a = alerta(r, 'sincerrar');
      expect(a.prioridad).toBe('alta');
      expect(a.destino).toBe('agenda');
      expect(a.detalle).toContain('2 cita(s)');
      expect(a.items.map((x) => x.nombre)).toEqual(['De Hace Tres', 'De Ayer']);
      expect(a.items[0].dato).toMatch(/^\d{1,2} (ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic) 09:00$/);
      expect(r.body.alerts[0].tipo).toBe('sincerrar'); // las de prioridad alta van primero
    });

    it('sin citas sin cerrar no hay esa alerta (el seed no tiene ninguna)', async () => {
      expect(alerta(await pedir(s.navaja.owner, 'alerts'), 'sincerrar')).toBeUndefined();
    });

    it('Barbería Nueva: sin alertas', async () => {
      expect((await pedir(s.nueva.owner, 'alerts')).body).toEqual({ alerts: [] });
    });

    it('los textos de las alertas no tienen voseo ni fechas técnicas (2026-10-07)', async () => {
      const texto = JSON.stringify((await pedir(s.navaja.owner, 'alerts')).body);
      expect(texto).not.toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(texto).not.toMatch(/\b(tenés|querés|podés|hacé)\b/i);
    });
  });

  describe('permisos y aislamiento', () => {
    it('solo el dueño: barbero 403, master 403 NO_BUSINESS, sin sesión 401, en las cuatro rutas', async () => {
      for (const ruta of ['dashboard', 'revenue', 'metrics', 'alerts']) {
        const b = await pedir(s.navaja.julian, ruta);
        expect(b.status, `barbero ${ruta}`).toBe(403);
        expect(b.body.code).toBe('FORBIDDEN');
        const m = await pedir(s.master, ruta);
        expect(m.status, `master ${ruta}`).toBe(403);
        expect(m.body.code).toBe('NO_BUSINESS');
        expect((await api().get(`/api/v1/analytics/${ruta}`)).status, `anónimo ${ruta}`).toBe(401);
      }
    });

    it('cada dueño ve solo lo suyo: los ingresos del mes de La Navaja y El Fade son distintos y cada uno es el de su dataset', async () => {
      const [n, f] = await Promise.all([pedir(s.navaja.owner, 'revenue'), pedir(s.fade.owner, 'revenue')]);
      const mes = (m) => m.suma(m.enRango(startOfMonth(hoy), endOfMonth(hoy)));
      expect(n.body.resumen.ingresosMes).toBe(mes(navaja));
      expect(f.body.resumen.ingresosMes).toBe(mes(modelo('fade')));
    });
  });
});
