import { beforeAll, describe, expect, it } from 'vitest';
import {
  api, auth, bizDay, createAppointment, createEmployee, createMaster, createService, dbUp, registerOwner,
} from '../helpers.js';

describe.skipIf(!dbUp)('panel master', () => {
  let master;
  let owner;

  beforeAll(async () => {
    master = await createMaster();
    owner = await registerOwner('negocio');
  });

  it('el master lista negocios y usuarios', async () => {
    const negocios = await api().get('/api/v1/master/businesses').set(auth(master.token));
    expect(negocios.status).toBe(200);
    expect(negocios.body.businesses.map((b) => b.id)).toContain(owner.business.id);

    const usuarios = await api().get('/api/v1/master/users').set(auth(master.token));
    expect(usuarios.body.users.map((u) => u.email)).toContain(owner.email);
    expect(JSON.stringify(usuarios.body)).not.toMatch(/passwordHash|password_hash/);
  });

  it('filtra por rol y por negocio; un rol inválido da 400 y no 500', async () => {
    const porRol = await api().get('/api/v1/master/users?role=owner').set(auth(master.token));
    expect(porRol.body.users.every((u) => u.role === 'owner')).toBe(true);

    const porNegocio = await api().get(`/api/v1/master/users?businessId=${owner.business.id}`).set(auth(master.token));
    expect(porNegocio.body.users).toHaveLength(1);

    expect((await api().get('/api/v1/master/users?role=superadmin').set(auth(master.token))).status).toBe(400);
  });

  it('busca negocios por nombre', async () => {
    await api().patch('/api/v1/businesses/me').set(auth(owner.token)).send({ name: 'Barbería Búsqueda Unica' });
    const res = await api().get('/api/v1/master/businesses?search=búsqueda unica').set(auth(master.token));
    expect(res.body.businesses.map((b) => b.id)).toContain(owner.business.id);
  });

  it('propietarios, empleados y anónimos no acceden', async () => {
    const emp = await createEmployee(owner.token);
    for (const ruta of ['/api/v1/master/businesses', '/api/v1/master/users']) {
      expect((await api().get(ruta).set(auth(owner.token))).status).toBe(403);
      expect((await api().get(ruta).set(auth(emp.token))).status).toBe(403);
      expect((await api().get(ruta)).status).toBe(401);
    }
  });

  it('el master no tiene negocio: no puede operar sobre datos de un negocio', async () => {
    expect((await api().get('/api/v1/services').set(auth(master.token))).status).toBe(403);
    expect((await api().get('/api/v1/appointments').set(auth(master.token))).status).toBe(403);
  });
});

describe.skipIf(!dbUp)('clientes', () => {
  let owner;
  let servicio;
  let barbero;

  const finalizar = async (cliente, { dia = 1, hora = '10:00', telefono = '' } = {}) => {
    const c = await createAppointment(owner.token, { serviceId: servicio.id, employeeId: barbero.id, date: bizDay(dia), time: hora, clientName: cliente, clientPhone: telefono });
    await api().patch(`/api/v1/appointments/${c.body.appointment.id}`).set(auth(owner.token)).send({ status: 'completed', paymentMethod: 'cash' });
  };
  const buscar = async (texto) => (await api().get(`/api/v1/clients?search=${encodeURIComponent(texto)}`).set(auth(owner.token))).body.clients;

  beforeAll(async () => {
    owner = await registerOwner('clientes');
    barbero = await createEmployee(owner.token);
    servicio = await createService(owner.token, { precio: 30000, duracion: 30 });
  });

  it('agendar crea el cliente con 0 visitas; finalizar cuenta la visita y el gasto', async () => {
    const c = await createAppointment(owner.token, { serviceId: servicio.id, employeeId: barbero.id, date: bizDay(1), time: '09:00', clientName: 'Laura Gómez', clientPhone: '3105556666' });
    expect((await buscar('Laura'))[0]).toMatchObject({ nombre: 'Laura Gómez', telefono: '3105556666', visitas: 0, etiqueta: 'Nuevo' });

    await api().patch(`/api/v1/appointments/${c.body.appointment.id}`).set(auth(owner.token)).send({ status: 'completed' });
    expect((await buscar('Laura'))[0]).toMatchObject({ visitas: 1, gasto: 30000, favorito: 'Corte' });
  });

  it('no duplica al cliente: lo reconoce por teléfono o por nombre sin distinguir mayúsculas', async () => {
    await finalizar('Pedro Ruiz', { hora: '10:00', telefono: '3207778888' });
    await finalizar('PEDRO RUIZ', { hora: '11:00' });
    await finalizar('Otro Nombre', { hora: '12:00', telefono: '3207778888' });
    const pedro = await buscar('Pedro');
    expect(pedro).toHaveLength(1);
    expect(pedro[0].visitas).toBe(3);
  });

  it('busca por nombre o por teléfono y filtra por etiqueta', async () => {
    expect((await buscar('3105556666')).map((c) => c.nombre)).toContain('Laura Gómez');
    const nuevos = await api().get('/api/v1/clients?tag=Nuevo').set(auth(owner.token));
    expect(nuevos.body.clients.every((c) => c.etiqueta === 'Nuevo')).toBe(true);
  });

  it('el detalle trae el historial de servicios finalizados', async () => {
    const [laura] = await buscar('Laura');
    const res = await api().get(`/api/v1/clients/${laura.id}`).set(auth(owner.token));
    expect(res.status).toBe(200);
    expect(res.body.historial).toEqual([expect.objectContaining({ servicio: 'Corte', valor: 30000, tipo: 'servicio' })]);
  });

  it('otro negocio no ve a estos clientes', async () => {
    const rival = await registerOwner('rival');
    const [laura] = await buscar('Laura');
    expect((await api().get('/api/v1/clients').set(auth(rival.token))).body.clients).toEqual([]);
    expect((await api().get(`/api/v1/clients/${laura.id}`).set(auth(rival.token))).status).toBe(404);
  });
});
