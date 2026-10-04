import { prisma } from '../lib/prisma.js';
import {
  addDays,
  businessDateOf,
  endOfMonth,
  endOfWeek,
  nowInBusinessTz,
  parseDateOnly,
  startOfMonth,
  startOfWeek,
} from '../lib/utils.js';
import { enrichClients } from './clientService.js';

// Jornada de referencia por barbero para calcular la ocupación de la agenda.
const WORKDAY_MINUTES = 600;
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const PAYMENT_LABELS = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia/Nequi' };
const PAYMENT_COLORS = { cash: '#C79A5B', card: '#7C97AC', transfer: '#7FA07A' };

const toPesos = (cents) => Math.round(cents / 100);
// Variación porcentual; null cuando no hay base de comparación.
const pct = (current, previous) => (previous > 0 ? Math.round(((current - previous) / previous) * 100) : null);
const dateKey = (date) => date.toISOString().slice(0, 10);

function addMonths(dateStr, n) {
  const d = parseDateOnly(startOfMonth(dateStr));
  d.setUTCMonth(d.getUTCMonth() + n);
  return dateKey(d);
}

function inRange(rows, from, to) {
  return rows.filter((r) => r.date >= from && r.date <= to);
}

const sumCents = (rows) => rows.reduce((a, r) => a + r.cents, 0);

/* Ingresos (servicios finalizados + ventas de productos) con su fecha en la zona del negocio.
   Se consulta con un día de margen y se filtra en JS, para no depender del huso del servidor. */
async function loadMoneyRows(businessId, from, to) {
  const gte = parseDateOnly(addDays(from, -1));
  const lte = new Date(parseDateOnly(addDays(to, 1)).getTime() + 24 * 60 * 60 * 1000 - 1);

  const [txs, sales] = await Promise.all([
    prisma.serviceTransaction.findMany({
      where: { businessId, completedAt: { gte, lte } },
      select: { completedAt: true, amountCents: true, paymentMethod: true, clientId: true, serviceId: true },
    }),
    prisma.productSale.findMany({
      where: { businessId, soldAt: { gte, lte } },
      select: { soldAt: true, totalCents: true },
    }),
  ]);

  const rows = [
    ...txs.map((t) => ({
      kind: 'service', date: businessDateOf(t.completedAt), cents: t.amountCents,
      method: t.paymentMethod, clientId: t.clientId, serviceId: t.serviceId,
    })),
    ...sales.map((s) => ({ kind: 'product', date: businessDateOf(s.soldAt), cents: s.totalCents })),
  ];
  return inRange(rows, from, to);
}

function occupancy(appointments, employees, days = 1) {
  const capacity = employees * WORKDAY_MINUTES * days;
  if (!capacity) return 0;
  const booked = appointments.reduce((a, appt) => a + (appt.service?.durationMinutes || 0), 0);
  return Math.min(100, Math.round((booked / capacity) * 100));
}

async function countClientsCreated(businessId, from, to) {
  const clients = await prisma.client.findMany({
    where: {
      businessId,
      createdAt: { gte: parseDateOnly(addDays(from, -1)), lte: new Date(parseDateOnly(addDays(to, 1)).getTime() + 24 * 60 * 60 * 1000 - 1) },
    },
    select: { createdAt: true },
  });
  return clients.filter((c) => {
    const d = businessDateOf(c.createdAt);
    return d >= from && d <= to;
  }).length;
}

function buildMonthlySeries(rows, anchor) {
  const first = addMonths(anchor, -5);
  return Array.from({ length: 6 }, (_, i) => {
    const from = addMonths(first, i);
    const monthRows = inRange(rows, from, endOfMonth(from));
    const clients = new Set(monthRows.filter((r) => r.kind === 'service' && r.clientId).map((r) => r.clientId));
    return {
      mes: MONTH_LABELS[parseDateOnly(from).getUTCMonth()],
      ingresos: toPesos(sumCents(monthRows)),
      clientes: clients.size,
    };
  });
}

function groupByService(serviceRows) {
  const byService = new Map();
  for (const r of serviceRows) {
    const entry = byService.get(r.serviceId) || { serviceId: r.serviceId, cents: 0, count: 0 };
    entry.cents += r.cents;
    entry.count += 1;
    byService.set(r.serviceId, entry);
  }
  return [...byService.values()];
}

async function serviceNames(ids) {
  if (!ids.length) return {};
  const services = await prisma.service.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  return Object.fromEntries(services.map((s) => [s.id, s.name]));
}

export async function getDashboardAnalytics(businessId, dateStr) {
  const date = dateStr || nowInBusinessTz().date;
  parseDateOnly(date);

  const prevDay = addDays(date, -7);
  const weekFrom = startOfWeek(date);
  const weekTo = endOfWeek(date);
  const prevWeekFrom = addDays(weekFrom, -7);
  const prevWeekTo = addDays(weekTo, -7);
  const monthFrom = startOfMonth(date);
  const monthTo = endOfMonth(date);
  const prevMonthTo = addDays(monthFrom, -1);
  const prevMonthFrom = startOfMonth(prevMonthTo);

  const lo = [prevMonthFrom, prevWeekFrom, prevDay].sort()[0];
  const hi = [monthTo, weekTo].sort().reverse()[0];

  const [rows, appts, employees, newClients, prevNewClients] = await Promise.all([
    loadMoneyRows(businessId, lo, hi),
    prisma.appointment.findMany({
      where: {
        businessId,
        appointmentDate: { in: [parseDateOnly(date), parseDateOnly(prevDay)] },
        status: { not: 'cancelled' },
      },
      include: { service: true },
    }),
    prisma.user.count({ where: { businessId, role: 'employee', isActive: true } }),
    countClientsCreated(businessId, monthFrom, monthTo),
    countClientsCreated(businessId, prevMonthFrom, prevMonthTo),
  ]);

  const today = appts.filter((a) => dateKey(a.appointmentDate) === date);
  const lastWeek = appts.filter((a) => dateKey(a.appointmentDate) === prevDay);

  const revenueToday = sumCents(inRange(rows, date, date));
  const revenuePrevDay = sumCents(inRange(rows, prevDay, prevDay));
  const revenueWeek = sumCents(inRange(rows, weekFrom, weekTo));
  const revenuePrevWeek = sumCents(inRange(rows, prevWeekFrom, prevWeekTo));
  const revenueMonth = sumCents(inRange(rows, monthFrom, monthTo));
  const revenuePrevMonth = sumCents(inRange(rows, prevMonthFrom, prevMonthTo));

  const occToday = occupancy(today, employees);
  const occPrev = occupancy(lastWeek, employees);

  return {
    date,
    citasHoy: today.length,
    finalizadas: today.filter((a) => a.status === 'completed').length,
    pendientes: today.filter((a) => a.status === 'pending' || a.status === 'confirmed').length,
    ingresosHoy: toPesos(revenueToday),
    ingresosSemana: toPesos(revenueWeek),
    ingresosMes: toPesos(revenueMonth),
    ocupacion: occToday,
    clientesNuevosMes: newClients,
    rangoSemana: { desde: weekFrom, hasta: weekTo },
    semana: Array.from({ length: 7 }, (_, i) => {
      const day = addDays(weekFrom, i);
      return { dia: WEEKDAYS[i], fecha: day, ingresos: toPesos(sumCents(inRange(rows, day, day))) };
    }),
    trends: {
      citas: pct(today.length, lastWeek.length),
      ingresos: pct(revenueToday, revenuePrevDay),
      ocupacion: pct(occToday, occPrev),
      semana: pct(revenueWeek, revenuePrevWeek),
      mes: pct(revenueMonth, revenuePrevMonth),
      clientesNuevos: pct(newClients, prevNewClients),
    },
  };
}

export async function getRevenueAnalytics(businessId, period, anchorDate) {
  const anchor = anchorDate || nowInBusinessTz().date;
  parseDateOnly(anchor);

  const monthFrom = startOfMonth(anchor);
  const monthTo = endOfMonth(anchor);
  const prevMonthFrom = addMonths(anchor, -1);
  const weekFrom = startOfWeek(anchor);
  const weekTo = endOfWeek(anchor);
  const hi = [monthTo, weekTo].sort().reverse()[0];
  const rows = await loadMoneyRows(businessId, addMonths(anchor, -5), hi);

  const data = period === 'month'
    ? buildMonthlySeries(rows, anchor)
    : Array.from({ length: 7 }, (_, i) => {
      const day = addDays(weekFrom, i);
      return { dia: WEEKDAYS[i], fecha: day, ingresos: toPesos(sumCents(inRange(rows, day, day))) };
    });

  const monthRows = inRange(rows, monthFrom, monthTo);
  const monthServiceRows = monthRows.filter((r) => r.kind === 'service');
  const prevMonthRevenue = sumCents(inRange(rows, prevMonthFrom, endOfMonth(prevMonthFrom)));

  const byService = groupByService(monthServiceRows).sort((a, b) => b.cents - a.cents);
  const names = await serviceNames(byService.map((s) => s.serviceId));
  const servicesComparison = byService.map((s) => ({ name: names[s.serviceId] || 'Servicio', ingresos: toPesos(s.cents) }));

  const byMethod = {};
  for (const r of monthServiceRows) byMethod[r.method] = (byMethod[r.method] || 0) + r.cents;
  const methodTotal = Object.values(byMethod).reduce((a, v) => a + v, 0);
  const paymentMethods = Object.entries(byMethod).map(([method, cents]) => ({
    name: PAYMENT_LABELS[method] || method,
    value: Math.round((cents / methodTotal) * 100),
    color: PAYMENT_COLORS[method] || '#6E6255',
  }));

  return {
    period: period === 'month' ? 'month' : 'week',
    data,
    resumen: {
      ingresosMes: toPesos(sumCents(monthRows)),
      trendMes: pct(sumCents(monthRows), prevMonthRevenue),
      serviciosRealizados: monthServiceRows.length,
      ticketPromedio: monthServiceRows.length ? toPesos(sumCents(monthServiceRows) / monthServiceRows.length) : 0,
      servicioTop: servicesComparison[0]
        ? { nombre: servicesComparison[0].name, ingresos: servicesComparison[0].ingresos }
        : null,
    },
    paymentMethods,
    servicesComparison,
  };
}

export async function getMetricsAnalytics(businessId, period, anchorDate) {
  const anchor = anchorDate || nowInBusinessTz().date;
  parseDateOnly(anchor);

  const from = period === 'month' ? startOfMonth(anchor) : startOfWeek(anchor);
  const to = period === 'month' ? endOfMonth(anchor) : endOfWeek(anchor);
  const seriesTo = [to, endOfMonth(anchor)].sort().reverse()[0];

  const [appointments, employees, rows] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        businessId,
        appointmentDate: { gte: parseDateOnly(from), lte: parseDateOnly(to) },
        status: { not: 'cancelled' },
      },
      include: { service: true },
    }),
    prisma.user.count({ where: { businessId, role: 'employee', isActive: true } }),
    loadMoneyRows(businessId, addMonths(anchor, -5), seriesTo),
  ]);

  // Demanda por hora, ordenada de la mañana a la noche.
  const hourBuckets = new Map();
  for (const appt of appointments) {
    const hour = parseInt(appt.startTime.split(':')[0], 10);
    hourBuckets.set(hour, (hourBuckets.get(hour) || 0) + 1);
  }
  const demandaHora = [...hourBuckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hour, citas]) => ({
      hora: `${hour % 12 === 0 ? 12 : hour % 12}${hour < 12 ? 'am' : 'pm'}`,
      citas,
    }));

  // Ingresos acumulados por día de la semana dentro del periodo.
  const rangeRows = inRange(rows, from, to);
  const byWeekday = Array(7).fill(0);
  for (const r of rangeRows) byWeekday[(parseDateOnly(r.date).getUTCDay() + 6) % 7] += r.cents;
  const rentabilidadDia = WEEKDAYS.map((dia, i) => ({ dia, valor: toPesos(byWeekday[i]) }));

  // Clientes nuevos (primera visita dentro del periodo) vs. recurrentes.
  const serviceRows = rangeRows.filter((r) => r.kind === 'service');
  const clientIds = [...new Set(serviceRows.filter((r) => r.clientId).map((r) => r.clientId))];
  let nuevos = 0;
  if (clientIds.length) {
    const firsts = await prisma.serviceTransaction.groupBy({
      by: ['clientId'],
      where: { businessId, clientId: { in: clientIds } },
      _min: { completedAt: true },
    });
    nuevos = firsts.filter((f) => businessDateOf(f._min.completedAt) >= from).length;
  }
  const recurrentes = clientIds.length - nuevos;
  const nuevosVsRecurrentes = clientIds.length
    ? [
      { name: 'Recurrentes', value: Math.round((recurrentes / clientIds.length) * 100) },
      { name: 'Nuevos', value: Math.round((nuevos / clientIds.length) * 100) },
    ]
    : [];

  const top = groupByService(serviceRows).sort((a, b) => b.count - a.count)[0];
  const names = top ? await serviceNames([top.serviceId]) : {};

  const activeDays = new Set(appointments.map((a) => dateKey(a.appointmentDate))).size;

  return {
    period: period === 'month' ? 'month' : 'week',
    demandaHora,
    rentabilidadDia,
    nuevosVsRecurrentes,
    ocupacion: occupancy(appointments, employees, Math.max(activeDays, 1)),
    topServicio: top ? { nombre: names[top.serviceId] || 'Servicio', veces: top.count } : null,
    evolucionMensual: buildMonthlySeries(rows, anchor),
  };
}

export async function getAlerts(businessId) {
  const alerts = [];
  const today = nowInBusinessTz().date;

  const clients = await prisma.client.findMany({ where: { businessId } });
  const enriched = await enrichClients(businessId, clients);
  const inactive = enriched.filter((c) => c.etiqueta === 'Inactivo');

  if (inactive.length) {
    alerts.push({
      id: 'inactivos',
      tipo: 'inactivos',
      prioridad: 'alta',
      titulo: 'Clientes que no regresan hace tiempo',
      detalle: `${inactive.length} cliente(s) no visitan la barbería hace más de 5 semanas.`,
      items: inactive.slice(0, 5).map((c) => ({ nombre: c.nombre, dato: `Última visita: ${c.ultima}` })),
      accion: 'Ver clientes',
      destino: 'clientes',
    });
  }

  const products = await prisma.product.findMany({ where: { businessId, isActive: true } });
  const low = products.filter((p) => p.stock <= p.stockMin);
  if (low.length) {
    alerts.push({
      id: 'stock',
      tipo: 'stock',
      prioridad: 'media',
      titulo: 'Productos con stock bajo',
      detalle: `${low.length} producto(s) están en o por debajo del mínimo.`,
      items: low.slice(0, 5).map((p) => ({ nombre: p.name, dato: `${p.stock} ${p.unit}(s)` })),
      accion: 'Revisar inventario',
      destino: 'inventario',
    });
  }

  const upcoming = await prisma.appointment.findMany({
    where: {
      businessId,
      appointmentDate: parseDateOnly(today),
      status: { in: ['confirmed', 'pending'] },
    },
    orderBy: { startTime: 'asc' },
  });

  if (upcoming.length) {
    alerts.push({
      id: 'proximas',
      tipo: 'recordatorio',
      prioridad: 'baja',
      titulo: 'Citas por atender hoy',
      detalle: `${upcoming.length} cliente(s) tienen una cita pendiente o confirmada para hoy.`,
      items: upcoming.slice(0, 5).map((a) => ({ nombre: a.clientName, dato: `${a.startTime}${a.clientPhone ? ` · ${a.clientPhone}` : ''}` })),
      accion: 'Ver agenda',
      destino: 'agenda',
    });
  }

  const vip = enriched.filter((c) => c.etiqueta === 'VIP');
  if (vip.length >= 3) {
    alerts.push({
      id: 'fidelizacion',
      tipo: 'fidelizacion',
      prioridad: 'baja',
      titulo: 'Oportunidad de fidelización',
      detalle: `${vip.length} clientes VIP visitan con frecuencia. Considera un programa de puntos.`,
      items: vip.slice(0, 5).map((c) => ({ nombre: c.nombre, dato: `${c.visitas} visitas` })),
      accion: 'Ver clientes',
      destino: 'clientes',
    });
  }

  return alerts;
}
