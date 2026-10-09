const STATUS_MAP = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  completed: 'Finalizada',
  cancelled: 'Cancelada',
};

const STATUS_REVERSE = {
  Pendiente: 'pending',
  Confirmada: 'confirmed',
  Finalizada: 'completed',
  Cancelada: 'cancelled',
};

export function appointmentStatusToUi(status) {
  return STATUS_MAP[status] || status;
}

export function appointmentStatusFromUi(status) {
  return STATUS_REVERSE[status] || status;
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    businessId: user.businessId,
  };
}

export function publicBusiness(business) {
  if (!business) return null;
  return {
    id: business.id,
    name: business.name,
    logo: business.logoUrl,
    description: business.description,
    phone: business.phone,
    address: business.address,
  };
}

export function centsToAmount(cents) {
  return Math.round(cents / 100);
}

export function amountToCents(amount) {
  return Math.round(Number(amount) * 100);
}

export function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

export function parseDateOnly(str) {
  const d = new Date(`${str}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== str) {
    const err = new Error('Fecha inválida.');
    err.status = 400;
    err.code = 'INVALID_DATE';
    throw err;
  }
  return d;
}

const BUSINESS_TZ = process.env.BUSINESS_TZ || 'America/Bogota';

// Fecha (YYYY-MM-DD) y hora (HH:MM) actuales en la zona horaria del negocio.
export function nowInBusinessTz() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type).value;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  };
}

// Fecha (YYYY-MM-DD) de un instante, vista desde la zona horaria del negocio.
export function businessDateOf(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

// Hora del negocio (HH:MM) de un instante.
export function businessTimeOf(date) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: BUSINESS_TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}

// Desfase (ms) de la zona del negocio respecto de UTC en un instante: local = UTC + desfase.
function businessOffsetMs(instant) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  const localAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return localAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

// Instante en que empieza el día `dateStr` (YYYY-MM-DD) en la zona del negocio (00:00 locales).
export function businessDayStart(dateStr) {
  const base = parseDateOnly(dateStr).getTime();
  const first = base - businessOffsetMs(new Date(base));
  return new Date(base - businessOffsetMs(new Date(first)));
}

// Último milisegundo del día `dateStr` en la zona del negocio.
export function businessDayEnd(dateStr) {
  return new Date(businessDayStart(addDays(dateStr, 1)).getTime() - 1);
}

const MESES_CORTOS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// «7 oct 2026» (con año) o «7 oct» (sin él) a partir de YYYY-MM-DD; siempre igual, sin depender del idioma del servidor.
export function formatDateEs(dateStr, { year = true } = {}) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d} ${MESES_CORTOS_ES[m - 1]}${year ? ` ${y}` : ''}`;
}

export function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function startOfDay(dateStr) {
  return parseDateOnly(dateStr);
}

export function endOfDay(dateStr) {
  const d = parseDateOnly(dateStr);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

export function addDays(dateStr, days) {
  const d = parseDateOnly(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDateOnly(d);
}

export function startOfWeek(dateStr) {
  const d = parseDateOnly(dateStr);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return formatDateOnly(d);
}

export function endOfWeek(dateStr) {
  const start = parseDateOnly(startOfWeek(dateStr));
  start.setUTCDate(start.getUTCDate() + 6);
  return formatDateOnly(start);
}

export function startOfMonth(dateStr) {
  const d = parseDateOnly(dateStr);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

export function endOfMonth(dateStr) {
  const d = parseDateOnly(dateStr);
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return formatDateOnly(d);
}

const STAFF_COLORS = ['#007A6E', '#4F46E5', '#D9930B', '#C62F36', '#0E7490'];

export function pickStaffColor(index) {
  return STAFF_COLORS[index % STAFF_COLORS.length];
}
