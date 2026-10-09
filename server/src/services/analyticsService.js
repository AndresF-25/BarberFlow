import { prisma } from '../lib/prisma.js';
import {
  addDays,
  businessDateOf,
  endOfMonth,
  endOfWeek,
  formatDateEs,
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
const PAYMENT_COLORS = { cash: '#007A6E', card: '#4F46E5', transfer: '#D9930B' };

const toPesos = (cents) => Math.round(cents / 100);
// Variación porcentual; null cuando no hay base de comparación.
const pct = (current, previous) => (previous > 0 ? Math.round(((current - previous) / previous) * 100) : null);
const dateKey = (date) => date.toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

// Reparte 100 puntos entre las partes por el método del mayor resto: siempre suma exactamente 100.
function splitPercents(values) {
  const total = values.reduce((a, v) => a + v, 0);
  if (!total) return values.map(() => 0);
  const raw = values.map((v) => (v / total) * 100);
  const result = raw.map(Math.floor);
  let left = 100 - result.reduce((a, v) => a + v, 0);
  raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).forEach(([, i]) => {
    if (left > 0) { result[i] += 1; left -= 1; }
  });
  return result;
}

// Barberos que cuentan para la capacidad: los activos y los que atendieron citas ese día (aunque ya estén dados de baja).
async function staffCount(businessId, appointments) {
  const active = await prisma.user.findMany({ where: { businessId, role: 'employee', isActive: true }, select: { id: true } });
  const ids = new Set(active.map((u) => u.id));
  appointments.forEach((a) => ids.add(a.employeeId));
  return ids.size;
}

const UNIT_FORMS = { unidad: ['unidad', 'unidades'], paquete: ['paquete', 'paquetes'] };
function formatStock(stock, unit) {
  if (stock === 0) return 'Agotado';
  const forms = UNIT_FORMS[unit];
  return forms ? `${stock} ${stock === 1 ? forms[0] : forms[1]}` : `${stock} ${unit}`;
}

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
  const monthFrom = startOfMonth(date);
  const monthTo = endOfMonth(date);
  const prevMonthTo = addDays(monthFrom, -1);
  const prevMonthFrom = startOfMonth(prevMonthTo);

  const lo = [prevMonthFrom, prevWeekFrom, prevDay].sort()[0];
  const hi = [monthTo, weekTo].sort().reverse()[0];

  // La semana y el mes en curso se comparan con el MISMO tramo del período anterior (no con el anterior ya completo).
  const weekElapsed = daysBetween(weekFrom, date);
  const prevWeekSpanTo = addDays(prevWeekFrom, weekElapsed);
  const prevMonthSpanTo = [addDays(prevMonthFrom, Number(date.slice(8)) - 1), prevMonthTo].sort()[0];

  const [rows, appts, newClients, newClientsToDate, prevNewClientsSpan] = await Promise.all([
    loadMoneyRows(businessId, lo, hi),
    prisma.appointment.findMany({
      where: {
        businessId,
        appointmentDate: { in: [parseDateOnly(date), parseDateOnly(prevDay)] },
        status: { not: 'cancelled' },
      },
      include: { service: true },
    }),
    countClientsCreated(businessId, monthFrom, monthTo),
    countClientsCreated(businessId, monthFrom, date),
    countClientsCreated(businessId, prevMonthFrom, prevMonthSpanTo),
  ]);

  const today = appts.filter((a) => dateKey(a.appointmentDate) === date);
  const lastWeek = appts.filter((a) => dateKey(a.appointmentDate) === prevDay);

  const revenueToday = sumCents(inRange(rows, date, date));
  const revenuePrevDay = sumCents(inRange(rows, prevDay, prevDay));
  const revenueWeek = sumCents(inRange(rows, weekFrom, weekTo));
  const revenueWeekToDate = sumCents(inRange(rows, weekFrom, date));
  const revenuePrevWeekSpan = sumCents(inRange(rows, prevWeekFrom, prevWeekSpanTo));
  const revenueMonth = sumCents(inRange(rows, monthFrom, monthTo));
  const revenueMonthToDate = sumCents(inRange(rows, monthFrom, date));
  const revenuePrevMonthSpan = sumCents(inRange(rows, prevMonthFrom, prevMonthSpanTo));

  const [staffToday, staffPrev] = await Promise.all([staffCount(businessId, today), staffCount(businessId, lastWeek)]);
  const occToday = occupancy(today, staffToday);
  const occPrev = occupancy(lastWeek, staffPrev);

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
      semana: pct(revenueWeekToDate, revenuePrevWeekSpan),
      mes: pct(revenueMonthToDate, revenuePrevMonthSpan),
      clientesNuevos: pct(newClientsToDate, prevNewClientsSpan),
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
  // Mes en curso hasta la fecha vs. el mismo tramo del mes anterior.
  const prevMonthSpanTo = [addDays(prevMonthFrom, Number(anchor.slice(8)) - 1), endOfMonth(prevMonthFrom)].sort()[0];
  const monthToDateRevenue = sumCents(inRange(rows, monthFrom, anchor));
  const prevMonthRevenue = sumCents(inRange(rows, prevMonthFrom, prevMonthSpanTo));

  const byService = groupByService(monthServiceRows).sort((a, b) => b.cents - a.cents);
  const names = await serviceNames(byService.map((s) => s.serviceId));
  const servicesComparison = byService.map((s) => ({ name: names[s.serviceId] || 'Servicio', ingresos: toPesos(s.cents) }));

  const byMethod = {};
  for (const r of monthServiceRows) byMethod[r.method] = (byMethod[r.method] || 0) + r.cents;
  const methodEntries = Object.entries(byMethod);
  const methodPercents = splitPercents(methodEntries.map(([, cents]) => cents));
  const paymentMethods = methodEntries.map(([method], i) => ({
    name: PAYMENT_LABELS[method] || method,
    value: methodPercents[i],
    color: PAYMENT_COLORS[method] || '#66726E',
  }));

  return {
    period: period === 'month' ? 'month' : 'week',
    data,
    resumen: {
      ingresosMes: toPesos(sumCents(monthRows)),
      trendMes: pct(monthToDateRevenue, prevMonthRevenue),
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

  const [appointments, rows] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        businessId,
        appointmentDate: { gte: parseDateOnly(from), lte: parseDateOnly(to) },
        status: { not: 'cancelled' },
      },
      include: { service: true },
    }),
    loadMoneyRows(businessId, addMonths(anchor, -5), seriesTo),
  ]);
  const employees = await staffCount(businessId, appointments);

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
  const [recurrentesPct, nuevosPct] = splitPercents([recurrentes, nuevos]);
  const nuevosVsRecurrentes = clientIds.length
    ? [{ name: 'Recurrentes', value: recurrentesPct }, { name: 'Nuevos', value: nuevosPct }]
    : [];

  // Servicio más vendido: más veces; en empate, más ingresos; y luego el nombre (así el resultado no depende del orden).
  const grouped = groupByService(serviceRows);
  const names = await serviceNames(grouped.map((g) => g.serviceId));
  const top = grouped.sort((a, b) => b.count - a.count || b.cents - a.cents
    || (names[a.serviceId] || '').localeCompare(names[b.serviceId] || '', 'es'))[0];

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

  // Citas de días anteriores que siguen abiertas: hay que finalizarlas (cobrar) o cancelarlas.
  const unclosed = await prisma.appointment.findMany({
    where: { businessId, appointmentDate: { lt: parseDateOnly(today) }, status: { in: ['pending', 'confirmed'] } },
    orderBy: [{ appointmentDate: 'asc' }, { startTime: 'asc' }],
  });
  if (unclosed.length) {
    alerts.push({
      id: 'sincerrar',
      tipo: 'sincerrar',
      prioridad: 'alta',
      titulo: 'Citas de días anteriores sin cerrar',
      detalle: `${unclosed.length} cita(s) siguen pendientes o confirmadas aunque su día ya pasó: finalízalas para registrar el cobro o cancélalas.`,
      items: unclosed.slice(0, 5).map((a) => ({ nombre: a.clientName, dato: `${formatDateEs(dateKey(a.appointmentDate), { year: false })} ${a.startTime}` })),
      accion: 'Ir a la agenda',
      destino: 'agenda',
    });
  }

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
      items: inactive.slice(0, 5).map((c) => ({ nombre: c.nombre, dato: `Última visita: ${formatDateEs(c.ultima)}` })),
      accion: 'Ver clientes',
      destino: 'clientes',
    });
  }

  const products = await prisma.product.findMany({ where: { businessId, isActive: true } });
  // Los agotados primero; si hay alguno, la alerta es urgente.
  const low = products.filter((p) => p.stock <= p.stockMin).sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name, 'es'));
  if (low.length) {
    alerts.push({
      id: 'stock',
      tipo: 'stock',
      prioridad: low.some((p) => p.stock === 0) ? 'alta' : 'media',
      titulo: 'Productos con stock bajo',
      detalle: `${low.length} producto(s) están en o por debajo del mínimo.`,
      items: low.slice(0, 5).map((p) => ({ nombre: p.name, dato: formatStock(p.stock, p.unit) })),
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

  // Las urgentes primero (el orden dentro de cada prioridad se conserva).
  const orden = { alta: 0, media: 1, baja: 2 };
  return alerts.sort((a, b) => orden[a.prioridad] - orden[b.prioridad]);
}
