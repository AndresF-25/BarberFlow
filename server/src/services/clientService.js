import { prisma } from '../lib/prisma.js';
import { formatDateOnly } from '../lib/utils.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// `db` permite reutilizar la transacción activa (tx) en lugar del cliente global de Prisma.
export async function upsertClientFromInteraction(businessId, { name, phone }, db = prisma) {
  const trimmedName = name?.trim();
  if (!trimmedName) return null;

  const normalizedPhone = phone?.trim() || '';
  let client = null;

  if (normalizedPhone) {
    client = await db.client.findFirst({
      where: { businessId, phone: normalizedPhone },
    });
  }

  if (!client) {
    client = await db.client.findFirst({
      where: {
        businessId,
        name: { equals: trimmedName, mode: 'insensitive' },
      },
    });
  }

  if (client) {
    return client;
  }

  return db.client.create({
    data: {
      businessId,
      name: trimmedName,
      phone: normalizedPhone,
    },
  });
}

export async function enrichClients(businessId, clients) {
  const ids = clients.map((c) => c.id);
  if (!ids.length) return [];

  const [appointments, serviceTx, productSales] = await Promise.all([
    prisma.appointment.findMany({
      where: { businessId, clientId: { in: ids }, status: 'completed' },
      include: { service: true },
      orderBy: { appointmentDate: 'desc' },
    }),
    prisma.serviceTransaction.findMany({
      where: { businessId, clientId: { in: ids } },
      include: { service: true },
      orderBy: { completedAt: 'desc' },
    }),
    prisma.productSale.findMany({
      where: { businessId, clientId: { in: ids } },
      include: { product: true },
      orderBy: { soldAt: 'desc' },
    }),
  ]);

  const byClient = Object.fromEntries(ids.map((id) => [id, { visits: 0, totalCents: 0, lastDate: null, favorite: null, firstDate: null }]));

  for (const appt of appointments) {
    const entry = byClient[appt.clientId];
    if (!entry) continue;
    entry.visits += 1;
    const date = appt.appointmentDate;
    if (!entry.lastDate || date > entry.lastDate) {
      entry.lastDate = date;
      entry.favorite = appt.service?.name || entry.favorite;
    }
    if (!entry.firstDate || date < entry.firstDate) entry.firstDate = date;
  }

  for (const tx of serviceTx) {
    const entry = byClient[tx.clientId];
    if (!entry) continue;
    entry.totalCents += tx.amountCents;
  }

  for (const sale of productSales) {
    const entry = byClient[sale.clientId];
    if (!entry) continue;
    entry.totalCents += sale.totalCents;
    entry.visits += 1;
    const date = sale.soldAt;
    if (!entry.lastDate || date > entry.lastDate) {
      entry.lastDate = date;
      entry.favorite = sale.product?.name || entry.favorite;
    }
    if (!entry.firstDate || date < entry.firstDate) entry.firstDate = date;
  }

  const now = Date.now();

  return clients.map((client) => {
    const stats = byClient[client.id] || { visits: 0, totalCents: 0, lastDate: null, favorite: null, firstDate: null };
    const lastDate = stats.lastDate;
    const daysSince = lastDate ? Math.floor((now - new Date(lastDate).getTime()) / DAY_MS) : null;

    let frecuencia = '—';
    if (daysSince !== null) {
      const weeks = Math.floor(daysSince / 7);
      if (weeks <= 2) frecuencia = '2 sem';
      else if (weeks <= 3) frecuencia = '3 sem';
      else if (weeks <= 5) frecuencia = '5+ sem';
      else frecuencia = '6+ sem';
    }

    let etiqueta = 'Nuevo';
    if (stats.visits >= 15) etiqueta = 'VIP';
    else if (stats.visits >= 5) etiqueta = 'Frecuente';
    else if (stats.visits > 1) etiqueta = 'Frecuente';
    else if (stats.visits === 1) etiqueta = 'Nuevo';
    if (daysSince !== null && daysSince > 35 && stats.visits > 1) etiqueta = 'Inactivo';

    const avgSpend = stats.visits > 0 ? Math.round(stats.totalCents / stats.visits / 100) : 0;

    return {
      id: client.id,
      nombre: client.name,
      telefono: client.phone || '—',
      ultima: lastDate ? formatDateOnly(new Date(lastDate)) : '—',
      frecuencia,
      favorito: stats.favorite || '—',
      gasto: avgSpend,
      visitas: stats.visits,
      etiqueta,
    };
  });
}

export async function getClientHistory(businessId, clientId) {
  const [serviceTx, productSales] = await Promise.all([
    prisma.serviceTransaction.findMany({
      where: { businessId, clientId },
      include: { service: true, employee: true },
      orderBy: { completedAt: 'desc' },
    }),
    prisma.productSale.findMany({
      where: { businessId, clientId },
      include: { product: true },
      orderBy: { soldAt: 'desc' },
    }),
  ]);

  const history = [
    ...serviceTx.map((tx) => ({
      fecha: formatDateOnly(new Date(tx.completedAt)),
      servicio: tx.service.name,
      barbero: tx.employee.name,
      valor: Math.round(tx.amountCents / 100),
      tipo: 'servicio',
    })),
    ...productSales.map((sale) => ({
      fecha: formatDateOnly(new Date(sale.soldAt)),
      servicio: sale.product.name,
      barbero: '—',
      valor: Math.round(sale.totalCents / 100),
      tipo: 'producto',
    })),
  ];

  history.sort((a, b) => b.fecha.localeCompare(a.fecha));
  return history;
}
