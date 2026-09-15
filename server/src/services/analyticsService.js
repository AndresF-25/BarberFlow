import { prisma } from '../lib/prisma.js';
import {
  addDays,
  endOfMonth,
  endOfWeek,
  formatDateOnly,
  startOfMonth,
  startOfWeek,
} from '../lib/utils.js';

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function dateRange(from, to) {
  return {
    gte: new Date(`${from}T00:00:00.000Z`),
    lte: new Date(`${to}T23:59:59.999Z`),
  };
}

function apptDateRange(from, to) {
  return {
    gte: new Date(`${from}T00:00:00.000Z`),
    lte: new Date(`${to}T00:00:00.000Z`),
  };
}

async function sumRevenue(businessId, from, to) {
  const [serviceSum, productSum] = await Promise.all([
    prisma.serviceTransaction.aggregate({
      where: { businessId, completedAt: dateRange(from, to) },
      _sum: { amountCents: true },
    }),
    prisma.productSale.aggregate({
      where: { businessId, soldAt: dateRange(from, to) },
      _sum: { totalCents: true },
    }),
  ]);

  return (serviceSum._sum.amountCents || 0) + (productSum._sum.totalCents || 0);
}

export async function getDashboardAnalytics(businessId, dateStr) {
  const date = dateStr || formatDateOnly(new Date());
  const prevDate = addDays(date, -7);

  const [todayAppts, completedToday, revenueToday, revenuePrevWeekSameDay] = await Promise.all([
    prisma.appointment.count({
      where: { businessId, appointmentDate: new Date(`${date}T00:00:00.000Z`) },
    }),
    prisma.appointment.count({
      where: {
        businessId,
        appointmentDate: new Date(`${date}T00:00:00.000Z`),
        status: 'completed',
      },
    }),
    sumRevenue(businessId, date, date),
    sumRevenue(businessId, prevDate, prevDate),
  ]);

  const pendingToday = await prisma.appointment.count({
    where: {
      businessId,
      appointmentDate: new Date(`${date}T00:00:00.000Z`),
      status: { in: ['pending', 'confirmed'] },
    },
  });

  const weekFrom = startOfWeek(date);
  const weekTo = endOfWeek(date);
  const weekRevenue = await sumRevenue(businessId, weekFrom, weekTo);

  const monthFrom = startOfMonth(date);
  const monthTo = endOfMonth(date);
  const monthRevenue = await sumRevenue(businessId, monthFrom, monthTo);

  const totalSlots = 10;
  const occupancy = todayAppts > 0 ? Math.min(100, Math.round((todayAppts / totalSlots) * 100)) : 0;

  const revenueTrend = revenuePrevWeekSameDay > 0
    ? Math.round(((revenueToday - revenuePrevWeekSameDay) / revenuePrevWeekSameDay) * 100)
    : revenueToday > 0 ? 100 : 0;

  return {
    date,
    citasHoy: todayAppts,
    finalizadas: completedToday,
    pendientes: pendingToday,
    ingresosHoy: Math.round(revenueToday / 100),
    ingresosSemana: Math.round(weekRevenue / 100),
    ingresosMes: Math.round(monthRevenue / 100),
    ocupacion: occupancy,
    trends: {
      citas: 0,
      ingresos: revenueTrend,
      ocupacion: 0,
    },
  };
}

export async function getRevenueAnalytics(businessId, period, anchorDate) {
  const anchor = anchorDate || formatDateOnly(new Date());

  if (period === 'month') {
    const months = [];
    const base = new Date(`${startOfMonth(anchor)}T00:00:00.000Z`);
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(base);
      d.setUTCMonth(d.getUTCMonth() - i);
      const from = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
      const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
      const to = formatDateOnly(end);
      const revenue = await sumRevenue(businessId, from, to);
      const clients = await prisma.serviceTransaction.groupBy({
        by: ['clientId'],
        where: {
          businessId,
          completedAt: dateRange(from, to),
          clientId: { not: null },
        },
      });
      months.push({
        mes: MONTH_LABELS[d.getUTCMonth()],
        ingresos: Math.round(revenue / 100),
        clientes: clients.length,
      });
    }
    return { period: 'month', data: months };
  }

  const weekStart = startOfWeek(anchor);
  const data = [];
  for (let i = 0; i < 7; i += 1) {
    const day = addDays(weekStart, i);
    const d = new Date(`${day}T00:00:00.000Z`);
    const revenue = await sumRevenue(businessId, day, day);
    data.push({
      dia: DAY_LABELS[d.getUTCDay()],
      ingresos: Math.round(revenue / 100),
    });
  }
  return { period: 'week', data };
}

export async function getMetricsAnalytics(businessId, period, anchorDate) {
  const anchor = anchorDate || formatDateOnly(new Date());
  const from = period === 'month' ? startOfMonth(anchor) : startOfWeek(anchor);
  const to = period === 'month' ? endOfMonth(anchor) : endOfWeek(anchor);

  const appointments = await prisma.appointment.findMany({
    where: {
      businessId,
      appointmentDate: apptDateRange(from, to),
      status: { not: 'cancelled' },
    },
  });

  const hourBuckets = {};
  for (const appt of appointments) {
    const hour = parseInt(appt.startTime.split(':')[0], 10);
    const label = hour < 12 ? `${hour === 0 ? 12 : hour}am` : `${hour === 12 ? 12 : hour - 12}pm`;
    hourBuckets[label] = (hourBuckets[label] || 0) + 1;
  }

  const demandaHora = Object.entries(hourBuckets).map(([hora, citas]) => ({ hora, citas }));

  const rentabilidad = [];
  for (let i = 0; i < 7; i += 1) {
    const day = addDays(from, i);
    if (day > to) break;
    const d = new Date(`${day}T00:00:00.000Z`);
    const revenue = await sumRevenue(businessId, day, day);
    rentabilidad.push({
      dia: DAY_LABELS[d.getUTCDay()],
      valor: Math.round(revenue / 100),
    });
  }

  const serviceTx = await prisma.serviceTransaction.findMany({
    where: { businessId, completedAt: dateRange(from, to) },
    include: { client: true },
  });

  const clientFirstVisit = {};
  const allClientTx = await prisma.serviceTransaction.findMany({
    where: { businessId, clientId: { not: null } },
    select: { clientId: true, completedAt: true },
    orderBy: { completedAt: 'asc' },
  });
  for (const tx of allClientTx) {
    if (!clientFirstVisit[tx.clientId]) clientFirstVisit[tx.clientId] = tx.completedAt;
  }

  let nuevos = 0;
  let recurrentes = 0;
  const seen = new Set();
  for (const tx of serviceTx) {
    if (!tx.clientId || seen.has(tx.clientId)) continue;
    seen.add(tx.clientId);
    const first = clientFirstVisit[tx.clientId];
    if (first && new Date(first) >= new Date(`${from}T00:00:00.000Z`)) nuevos += 1;
    else recurrentes += 1;
  }

  const totalClients = nuevos + recurrentes || 1;
  const nuevosVsRecurrentes = [
    { name: 'Recurrentes', value: Math.round((recurrentes / totalClients) * 100) },
    { name: 'Nuevos', value: Math.round((nuevos / totalClients) * 100) },
  ];

  const topService = await prisma.service.findFirst({
    where: { businessId, isActive: true },
    orderBy: { timesPerformed: 'desc' },
  });

  const occupancy = appointments.length > 0
    ? Math.min(100, Math.round((appointments.filter((a) => a.status === 'completed').length / Math.max(appointments.length, 1)) * 100))
    : 0;

  return {
    demandaHora,
    rentabilidadDia: rentabilidad,
    nuevosVsRecurrentes,
    ocupacion: occupancy,
    topServicio: topService
      ? { nombre: topService.name, veces: topService.timesPerformed }
      : { nombre: '—', veces: 0 },
  };
}

export async function getPaymentMethods(businessId, from, to) {
  const anchor = formatDateOnly(new Date());
  const rangeFrom = from || startOfMonth(anchor);
  const rangeTo = to || endOfMonth(anchor);

  const grouped = await prisma.serviceTransaction.groupBy({
    by: ['paymentMethod'],
    where: { businessId, completedAt: dateRange(rangeFrom, rangeTo) },
    _count: { paymentMethod: true },
  });

  const labels = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia/Nequi' };
  const colors = { cash: '#C79A5B', card: '#7C97AC', transfer: '#7FA07A' };
  const total = grouped.reduce((a, g) => a + g._count.paymentMethod, 0) || 1;

  return grouped.map((g) => ({
    name: labels[g.paymentMethod] || g.paymentMethod,
    value: Math.round((g._count.paymentMethod / total) * 100),
    color: colors[g.paymentMethod] || '#6E6255',
  }));
}

export async function getAlerts(businessId) {
  const alerts = [];
  const today = formatDateOnly(new Date());
  const cutoff = addDays(today, -35);

  const clients = await prisma.client.findMany({ where: { businessId } });
  const enriched = await import('./clientService.js').then((m) => m.enrichClients(businessId, clients));
  const inactive = enriched.filter((c) => c.etiqueta === 'Inactivo').slice(0, 5);

  if (inactive.length) {
    alerts.push({
      id: 'inactivos',
      tipo: 'inactivos',
      prioridad: 'alta',
      titulo: 'Clientes que no regresan hace tiempo',
      detalle: `${inactive.length} cliente(s) no visitan la barbería hace más de 5 semanas.`,
      items: inactive.map((c) => ({ nombre: c.nombre, dato: `Última visita: ${c.ultima}` })),
      accion: 'Enviar recordatorio',
    });
  }

  const lowStock = await prisma.product.findMany({
    where: { businessId, isActive: true },
  });
  const bajo = lowStock.filter((p) => p.stock <= p.stockMin);
  if (bajo.length) {
    alerts.push({
      id: 'stock',
      tipo: 'stock',
      prioridad: 'media',
      titulo: 'Productos con stock bajo',
      detalle: `${bajo.length} producto(s) están en o por debajo del mínimo.`,
      items: bajo.slice(0, 5).map((p) => ({ nombre: p.name, dato: `${p.stock} ${p.unit}(s)` })),
      accion: 'Revisar inventario',
    });
  }

  const upcoming = await prisma.appointment.findMany({
    where: {
      businessId,
      appointmentDate: new Date(`${today}T00:00:00.000Z`),
      status: { in: ['confirmed', 'pending'] },
    },
    orderBy: { startTime: 'asc' },
    take: 5,
  });

  if (upcoming.length) {
    alerts.push({
      id: 'proximas',
      tipo: 'recordatorio',
      prioridad: 'baja',
      titulo: 'Próximas citas pendientes hoy',
      detalle: `${upcoming.length} cliente(s) tienen cita programada para hoy.`,
      items: upcoming.map((a) => ({ nombre: a.clientName, dato: `${a.startTime} · ${a.clientPhone}` })),
      accion: 'Ver agenda',
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
      items: [],
      accion: 'Diseñar programa de fidelidad',
    });
  }

  return alerts;
}

export async function getServicesRevenueComparison(businessId) {
  const services = await prisma.service.findMany({
    where: { businessId, isActive: true },
    orderBy: { timesPerformed: 'desc' },
  });

  return services.map((s) => ({
    name: s.name.split(' ')[0],
    ingresos: Math.round((s.priceCents * s.timesPerformed) / 100),
  }));
}
