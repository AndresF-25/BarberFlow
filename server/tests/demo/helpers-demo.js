/**
 * Utilidades de las pruebas contra datos de demostración.
 * Regla: lo que lee datos agregados va contra el seed SOLO EN LECTURA; lo que crea o
 * modifica usa negocios @test.local nuevos (registerOwner, createEmployee... de ../helpers.js),
 * que el globalSetup limpia solo.
 */
import request from 'supertest';
import { api, prisma, dbUp } from '../helpers.js';
import { nowInBusinessTz } from '../../src/lib/utils.js';
import { buildDataset, summarize } from '../../prisma/demo/dataset.js';

export { api, auth, prisma, PASSWORD, uniqueEmail, registerOwner, createEmployee, createService, createAppointment, createMaster, bizDay } from '../helpers.js';

export const hoy = nowInBusinessTz().date;
export const dataset = buildDataset(hoy);
export const DEMO_DOMAIN = `@${dataset.meta.domain}`;
export const DEMO_PASSWORD = dataset.meta.password;
export const summaries = Object.fromEntries(dataset.businesses.map((b) => [b.key, summarize(b)]));
export const biz = (key) => dataset.businesses.find((b) => b.key === key);

/** Falla con un mensaje claro (no se omite en silencio) si no hay BD o los datos demo no están cargados al día. */
export async function requireSeed() {
  if (!dbUp) throw new Error('No hay base de datos: ejecuta `docker compose up -d` y `npm run db:deploy`.');
  const master = await prisma.user.findUnique({ where: { email: dataset.master.email } });
  if (!master) throw new Error('Datos demo no cargados: ejecuta `npm run db:seed:demo` (en server/).');

  const owner = await prisma.user.findUnique({ where: { email: biz('navaja').owner.email } });
  const hoyEnBd = await prisma.appointment.count({
    where: { businessId: owner.businessId, appointmentDate: new Date(`${hoy}T00:00:00.000Z`) },
  });
  const esperadas = biz('navaja').appointments.filter((a) => a.date === hoy).length;
  if (hoyEnBd !== esperadas) {
    throw new Error(`Los datos demo son de otro día (hoy tiene ${hoyEnBd} citas, se esperaban ${esperadas}): vuelve a cargar con \`npm run db:seed:demo\`.`);
  }
}

export async function loginDemo(email, password = DEMO_PASSWORD) {
  const res = await api().post('/api/v1/auth/login').send({ email, password });
  return { status: res.status, body: res.body, token: res.body.token };
}

/** Sesiones de todas las cuentas demo activas, por negocio y rol. */
export async function demoSessions() {
  const get = async (email) => {
    const r = await loginDemo(email);
    if (r.status !== 200) throw new Error(`No se pudo iniciar sesión con ${email}: ${r.status} ${JSON.stringify(r.body)}`);
    return r.token;
  };
  const navaja = biz('navaja');
  const fade = biz('fade');
  const nueva = biz('nueva');
  const activo = (b, key) => b.staff.find((s) => s.key === key).email;
  return {
    master: await get(dataset.master.email),
    navaja: { owner: await get(navaja.owner.email), julian: await get(activo(navaja, 'julian')), camilo: await get(activo(navaja, 'camilo')) },
    fade: { owner: await get(fade.owner.email), oscar: await get(activo(fade, 'oscar')) },
    nueva: { owner: await get(nueva.owner.email) },
  };
}

/** App nueva con límites propios (createApp lee el entorno al crearse; la app compartida ya está creada). */
export async function appCon(env) {
  const previo = {};
  for (const k of Object.keys(env)) { previo[k] = process.env[k]; process.env[k] = String(env[k]); }
  const { createApp } = await import('../../src/app.js');
  const app = createApp();
  for (const k of Object.keys(env)) { if (previo[k] === undefined) delete process.env[k]; else process.env[k] = previo[k]; }
  return request(app);
}
