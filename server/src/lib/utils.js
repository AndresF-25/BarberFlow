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
  const { passwordHash, ...rest } = user;
  return {
    id: rest.id,
    name: rest.name,
    email: rest.email,
    role: rest.role,
    businessId: rest.businessId,
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
  if (Number.isNaN(d.getTime())) throw new Error('Fecha inválida');
  return d;
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

const STAFF_COLORS = ['#C79A5B', '#7C97AC', '#7FA07A', '#BD6552', '#D0A24E'];

export function pickStaffColor(index) {
  return STAFF_COLORS[index % STAFF_COLORS.length];
}
