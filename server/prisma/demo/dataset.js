/**
 * Conjunto de datos de demostración y prueba.
 *
 * `buildDataset(hoy)` es una función PURA: lee demo-data.json, resuelve las fechas
 * relativas (day=0 es `hoy`) y devuelve todo normalizado. La usan la carga a la BD
 * (scripts/seed-demo.js) y las pruebas, que calculan los valores esperados desde
 * aquí en vez de escribir números a mano.
 */
import { readFileSync } from 'node:fs';
import { addDays } from '../../src/lib/utils.js';

const DATA = JSON.parse(readFileSync(new URL('./demo-data.json', import.meta.url), 'utf8'));

// Generador pseudoaleatorio con semilla: mismos datos en cada carga.
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const weekday = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();
const pick = (rand, list) => list[Math.floor(rand() * list.length)];

function expandSeries(series) {
  return series.flatMap((s) => Array.from({ length: s.count }, (_, i) => ({
    client: s.client, service: s.service, staff: s.staff, time: s.time,
    day: s.start + i * s.step, pay: s.pay[i % s.pay.length],
  })));
}

function overlaps(list, startMin, endMin) {
  return list.some(([s, e]) => startMin < e && s < endMin);
}

/* Citas de relleno repartidas sin solapes, para dar volumen a las analíticas. */
function generateBulk(bulk, services, explicit, rand) {
  if (!bulk) return [];
  const busy = new Map();
  const claim = (staff, day, startMin, endMin) => {
    const k = `${staff}|${day}`;
    if (!busy.has(k)) busy.set(k, []);
    busy.get(k).push([startMin, endMin]);
  };
  explicit.forEach((a) => claim(a.staff, a.day, toMin(a.time), toMin(a.time) + services[a.service].duracion));

  const [from, to] = bulk.dayRange;
  const slots = [];
  for (let day = from; day <= to; day++) {
    for (const staff of bulk.staff) for (const time of bulk.times) slots.push({ day, staff, time });
  }
  // Barajado determinista (Fisher-Yates con el generador con semilla).
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }

  const out = [];
  for (const slot of slots) {
    if (out.length >= bulk.count) break;
    const service = pick(rand, bulk.services);
    const start = toMin(slot.time);
    const end = start + services[service].duracion;
    if (overlaps(busy.get(`${slot.staff}|${slot.day}`) || [], start, end)) continue;
    claim(slot.staff, slot.day, start, end);
    out.push({
      client: pick(rand, bulk.clients), service, staff: slot.staff,
      day: slot.day, time: slot.time, pay: pick(rand, bulk.pay),
    });
  }
  return out;
}

function buildBusiness(raw, hoy, meta, rand) {
  const email = (local) => `${local}@${meta.domain}`;
  const services = Object.fromEntries(raw.services.map((s) => [s.key, { ...s, active: s.active !== false }]));
  const products = Object.fromEntries(raw.products.map((p) => [p.key, { ...p, active: p.active !== false }]));

  const explicit = [...raw.appointments, ...expandSeries(raw.series)];
  const all = [...explicit, ...generateBulk(raw.bulk, services, explicit, rand)];

  const appointments = all
    .map((a) => {
      const status = a.status || (a.day < 0 ? 'completed' : 'pending');
      return {
        client: a.client, service: a.service, staff: a.staff,
        date: addDays(hoy, a.day), time: a.time, status,
        pay: status === 'completed' ? (a.pay || 'cash') : null,
      };
    })
    .sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time));

  const sales = raw.sales
    .map((s) => ({ ...s, date: addDays(hoy, s.day), client: s.client || null }))
    .sort((x, y) => x.date.localeCompare(y.date));

  const adjustments = raw.adjustments.map((a) => ({ ...a, date: addDays(hoy, a.day) }));

  // Stock inicial = final − ajustes + vendido, de modo que la historia cuadre con el stock actual.
  const initialStock = {};
  for (const [key, p] of Object.entries(products)) {
    const sold = sales.filter((s) => s.product === key).reduce((n, s) => n + s.qty, 0);
    const adj = adjustments.filter((a) => a.product === key).reduce((n, a) => n + a.delta, 0);
    initialStock[key] = p.stock - adj + sold;
    if (initialStock[key] < 0) throw new Error(`Stock inicial negativo para ${raw.key}/${key}: revisa ventas y ajustes.`);
  }

  // Cada cliente nace en su primera interacción (alimenta "clientes nuevos del mes").
  const firstSeen = {};
  const touch = (key, date) => { if (key && (!firstSeen[key] || date < firstSeen[key])) firstSeen[key] = date; };
  appointments.forEach((a) => touch(a.client, a.date));
  sales.forEach((s) => touch(s.client, s.date));
  const lastSeen = {};
  const seen = (key, date) => { if (key && (!lastSeen[key] || date > lastSeen[key])) lastSeen[key] = date; };
  appointments.filter((a) => a.status === 'completed').forEach((a) => seen(a.client, a.date));
  sales.forEach((s) => seen(s.client, s.date));

  const clients = raw.clients.map((c) => ({
    ...c,
    createdDate: firstSeen[c.key] || addDays(hoy, -1),
    lastDate: lastSeen[c.key] || firstSeen[c.key] || addDays(hoy, -1),
  }));

  const clientKeys = new Set(raw.clients.map((c) => c.key));
  for (const a of appointments) {
    if (!clientKeys.has(a.client)) throw new Error(`${raw.key}: cliente desconocido "${a.client}"`);
    if (!services[a.service]) throw new Error(`${raw.key}: servicio desconocido "${a.service}"`);
    if (a.staff && !raw.staff.some((s) => s.key === a.staff)) throw new Error(`${raw.key}: barbero desconocido "${a.staff}"`);
  }

  return {
    key: raw.key,
    name: raw.name,
    description: raw.description,
    phone: raw.phone,
    address: raw.address,
    owner: { ...raw.owner, email: email(raw.owner.email) },
    staff: raw.staff.map((s) => ({ ...s, email: email(s.email), active: s.active !== false })),
    services: Object.values(services),
    products: Object.values(products),
    initialStock,
    clients,
    appointments,
    sales,
    adjustments,
  };
}

export function buildDataset(hoy) {
  const meta = DATA.meta;
  const rand = mulberry32(meta.seed);
  return {
    meta,
    hoy,
    master: { ...DATA.master, email: `${DATA.master.email}@${meta.domain}` },
    businesses: DATA.businesses.map((b) => buildBusiness(b, hoy, meta, rand)),
  };
}

/** Totales calculados desde los datos (no desde la BD): sirven de valor esperado en las pruebas. */
export function summarize(biz) {
  const price = Object.fromEntries(biz.services.map((s) => [s.key, s.precio]));
  const productPrice = Object.fromEntries(biz.products.map((p) => [p.key, p.precioVenta]));
  const completed = biz.appointments.filter((a) => a.status === 'completed');

  const visitsByClient = {};
  const spendByClient = {};
  const add = (key, amount) => {
    visitsByClient[key] = (visitsByClient[key] || 0) + 1;
    spendByClient[key] = (spendByClient[key] || 0) + amount;
  };
  completed.forEach((a) => add(a.client, price[a.service]));
  biz.sales.filter((s) => s.client).forEach((s) => add(s.client, s.qty * productPrice[s.product]));

  const byStatus = {};
  biz.appointments.forEach((a) => { byStatus[a.status] = (byStatus[a.status] || 0) + 1; });

  const servicesRevenueByDate = {};
  completed.forEach((a) => { servicesRevenueByDate[a.date] = (servicesRevenueByDate[a.date] || 0) + price[a.service]; });
  const salesRevenueByDate = {};
  biz.sales.forEach((s) => { salesRevenueByDate[s.date] = (salesRevenueByDate[s.date] || 0) + s.qty * productPrice[s.product]; });

  const payMix = {};
  completed.forEach((a) => { payMix[a.pay] = (payMix[a.pay] || 0) + price[a.service]; });

  return {
    visitsByClient,
    spendByClient,
    byStatus,
    servicesRevenueByDate,
    salesRevenueByDate,
    payMix,
    totals: {
      appointments: biz.appointments.length,
      completed: completed.length,
      services: biz.services.length,
      activeServices: biz.services.filter((s) => s.active).length,
      products: biz.products.length,
      activeProducts: biz.products.filter((p) => p.active).length,
      clients: biz.clients.length,
      sales: biz.sales.length,
      activeStaff: biz.staff.filter((s) => s.active).length,
      staff: biz.staff.length,
    },
  };
}
