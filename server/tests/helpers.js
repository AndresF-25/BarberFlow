import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/lib/password.js';
import { addDays, nowInBusinessTz } from '../src/lib/utils.js';

export { prisma };
export const app = createApp();
export const api = () => request(app);
export const PASSWORD = 'Clave1234';

// Los tests de integración se omiten si no hay base de datos disponible.
export const dbUp = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);

let counter = 0;
export const uniqueEmail = (label) => `${label}${Date.now()}${counter++}@test.local`;

export const bizToday = () => nowInBusinessTz().date;
export const bizDay = (offset) => addDays(bizToday(), offset);

export const auth = (token) => ({ Authorization: `Bearer ${token}` });

/** Registra un propietario (con su negocio) y devuelve su token. */
export async function registerOwner(label = 'owner') {
  const email = uniqueEmail(label);
  const res = await api().post('/api/v1/auth/register').send({ name: `Dueño ${label}`, email, password: PASSWORD });
  if (res.status !== 201) throw new Error(`registro falló: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.token, email, user: res.body.user, business: res.body.business };
}

/** Crea un empleado para el negocio del propietario y devuelve su id, correo y token. */
export async function createEmployee(ownerToken, name = 'Barbero') {
  const email = uniqueEmail('emp');
  const created = await api().post('/api/v1/auth/employees').set(auth(ownerToken)).send({ name, email, password: PASSWORD });
  if (created.status !== 201) throw new Error(`empleado falló: ${created.status} ${JSON.stringify(created.body)}`);
  const login = await api().post('/api/v1/auth/login').send({ email, password: PASSWORD });
  return { id: created.body.user.id, email, token: login.body.token };
}

export async function createService(ownerToken, data = {}) {
  const res = await api().post('/api/v1/services').set(auth(ownerToken))
    .send({ nombre: 'Corte', categoria: 'Cortes', precio: 30000, duracion: 60, ...data });
  if (res.status !== 201) throw new Error(`servicio falló: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.service;
}

export async function createAppointment(token, { serviceId, employeeId, date, time, clientName = 'Cliente', clientPhone = '' }) {
  return api().post('/api/v1/appointments').set(auth(token))
    .send({ clientName, clientPhone, serviceId, employeeId, appointmentDate: date, startTime: time });
}

/** Crea un usuario master directamente en la base (no existe un endpoint para ello). */
export async function createMaster() {
  const email = uniqueEmail('master');
  await prisma.user.create({
    data: { email, name: 'Master Test', passwordHash: await hashPassword(PASSWORD), role: 'master', businessId: null },
  });
  const login = await api().post('/api/v1/auth/login').send({ email, password: PASSWORD });
  return { email, token: login.body.token };
}
