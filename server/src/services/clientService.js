import { prisma } from '../lib/prisma.js';
import { businessDateOf, formatDateOnly, nowInBusinessTz } from '../lib/utils.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const INACTIVE_AFTER_DAYS = 35; // más de 5 semanas sin venir
const VIP_VISITS = 15;
const TX_OPTS = { maxWait: 15000, timeout: 15000 }; // una ráfaga de altas hace cola en el cerrojo

/** Texto para comparar: sin tildes, sin mayúsculas y con los espacios juntos. */
export const normalizeText = (s) => (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es').replace(/\s+/g, ' ').trim();

/** Nombre limpio para guardar: sin espacios de más. */
export const cleanName = (s) => (s || '').replace(/\s+/g, ' ').trim();

/** Teléfono para comparar: solo dígitos y sin el indicativo 57 de Colombia (12 dígitos). */
export function normalizePhone(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('57') ? digits.slice(2) : digits;
}

const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);

async function findOrCreateClient(db, businessId, name, phone) {
  const key = normalizePhone(phone);

  if (key) {
    const withPhone = await db.client.findMany({ where: { businessId, NOT: { phone: '' } }, orderBy: { createdAt: 'asc' } });
    const byPhone = withPhone.find((c) => normalizePhone(c.phone) === key);
    if (byPhone) return byPhone;
  }

  const sameName = (await db.client.findMany({ where: { businessId }, orderBy: { createdAt: 'asc' } }))
    .filter((c) => normalizeText(c.name) === normalizeText(name));

  if (key) {
    // Con teléfono: el mismo nombre solo sirve si esa ficha aún no tiene teléfono (se le completa).
    // Si ya tiene otro, es otra persona con el mismo nombre.
    const sinTelefono = sameName.find((c) => !c.phone);
    if (sinTelefono) return db.client.update({ where: { id: sinTelefono.id }, data: { phone: phone.trim() } });
  } else if (sameName.length) {
    return sameName[0];
  }

  return db.client.create({ data: { businessId, name, phone: phone?.trim() || '' } });
}

// `db` permite reutilizar la transacción activa (tx) en lugar del cliente global de Prisma.
export async function upsertClientFromInteraction(businessId, { name, phone }, db = prisma) {
  const cleaned = cleanName(name);
  if (!cleaned) return null;

  // Cerrojo por negocio: varias citas a la vez del mismo cliente nuevo no deben crear varias fichas.
  const run = async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`clients:${businessId}`}))`;
    return findOrCreateClient(tx, businessId, cleaned, phone || '');
  };
  return db === prisma ? prisma.$transaction(run, TX_OPTS) : run(db);
}

const SERVICE_DATE_ORDER = (a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`);

function frequencyLabel(visitDates) {
  const days = [...new Set(visitDates)].sort();
  if (days.length < 2) return '—';
  const avg = daysBetween(days[0], days[days.length - 1]) / (days.length - 1);
  if (avg < 21) {
    const n = Math.max(1, Math.round(avg));
    return `Cada ${n} ${n === 1 ? 'día' : 'días'}`;
  }
  return `Cada ${Math.round(avg / 7)} semanas`;
}

/**
 * Datos calculados de cada cliente. `today` (YYYY-MM-DD, día del negocio) se puede fijar en pruebas.
 * Visitas = servicios finalizados + compras de productos. Etiqueta: VIP (15+), Frecuente (2+), Nuevo (0–1);
 * Inactivo (más de 35 días sin venir, con al menos una visita) manda sobre las demás.
 */
export async function enrichClients(businessId, clients, { today = nowInBusinessTz().date } = {}) {
  const ids = clients.map((c) => c.id);
  if (!ids.length) return [];

  const [appointments, serviceTx, productSales] = await Promise.all([
    prisma.appointment.findMany({
      where: { businessId, clientId: { in: ids }, status: 'completed' },
      include: { service: true },
    }),
    prisma.serviceTransaction.findMany({ where: { businessId, clientId: { in: ids } } }),
    prisma.productSale.findMany({ where: { businessId, clientId: { in: ids } } }),
  ]);

  const byClient = Object.fromEntries(ids.map((id) => [id, { totalCents: 0, visitDates: [], services: [] }]));

  for (const appt of appointments) {
    const entry = byClient[appt.clientId];
    if (!entry) continue;
    const date = formatDateOnly(appt.appointmentDate); // @db.Date: ya es una fecha, sin hora
    entry.visitDates.push(date);
    entry.services.push({ date, time: appt.startTime, name: appt.service?.name });
  }
  for (const tx of serviceTx) {
    if (byClient[tx.clientId]) byClient[tx.clientId].totalCents += tx.amountCents;
  }
  for (const sale of productSales) {
    const entry = byClient[sale.clientId];
    if (!entry) continue;
    entry.totalCents += sale.totalCents;
    entry.visitDates.push(businessDateOf(sale.soldAt)); // un instante: se mira en la zona del negocio, no en UTC
  }

  return clients.map((client) => {
    const stats = byClient[client.id];
    const visits = stats.visitDates.length;
    const lastDate = visits ? [...stats.visitDates].sort().pop() : null;
    const daysSince = lastDate ? daysBetween(lastDate, today) : null;

    // Servicio favorito = el más frecuente (en empate, el más reciente); último = el más reciente. Los productos no cuentan.
    const recent = [...stats.services].sort(SERVICE_DATE_ORDER);
    const counts = {};
    recent.forEach((s) => { counts[s.name] = (counts[s.name] || 0) + 1; });
    const top = Math.max(0, ...Object.values(counts));

    let etiqueta = 'Nuevo';
    if (visits >= VIP_VISITS) etiqueta = 'VIP';
    else if (visits >= 2) etiqueta = 'Frecuente';
    if (daysSince !== null && daysSince > INACTIVE_AFTER_DAYS) etiqueta = 'Inactivo';

    return {
      id: client.id,
      nombre: client.name,
      telefono: client.phone || '—',
      notas: client.notes || '',
      ultima: lastDate || '—',
      frecuencia: frequencyLabel(stats.visitDates),
      ultimoServicio: recent[0]?.name || '—',
      favorito: recent.find((s) => counts[s.name] === top)?.name || '—',
      gasto: visits > 0 ? Math.round(stats.totalCents / visits / 100) : 0,
      visitas: visits,
      etiqueta,
    };
  });
}

export async function getClientHistory(businessId, clientId) {
  const [serviceTx, productSales] = await Promise.all([
    prisma.serviceTransaction.findMany({
      where: { businessId, clientId },
      include: { service: true, employee: true, appointment: true },
    }),
    prisma.productSale.findMany({
      where: { businessId, clientId },
      include: { product: true },
    }),
  ]);

  const history = [
    ...serviceTx.map((tx) => ({
      // Mismo día que «última visita»: el de la cita; si el cobro no viene de una cita, el día del negocio en que se cobró.
      fecha: tx.appointment ? formatDateOnly(tx.appointment.appointmentDate) : businessDateOf(tx.completedAt),
      orden: tx.completedAt.getTime(),
      servicio: tx.service.name,
      barbero: tx.employee.name,
      valor: Math.round(tx.amountCents / 100),
      tipo: 'servicio',
    })),
    ...productSales.map((sale) => ({
      fecha: businessDateOf(sale.soldAt),
      orden: sale.soldAt.getTime(),
      servicio: sale.product.name,
      barbero: '—',
      valor: Math.round(sale.totalCents / 100),
      tipo: 'producto',
    })),
  ];

  history.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.orden - a.orden);
  return history.map(({ orden: _orden, ...item }) => item);
}
