import { beforeAll, describe, expect, it } from 'vitest';
import { api, auth, createEmployee, createService, dbUp, registerOwner } from '../helpers.js';

describe.skipIf(!dbUp)('servicios', () => {
  let owner;
  let empleado;
  let rival;

  beforeAll(async () => {
    owner = await registerOwner('serv');
    empleado = await createEmployee(owner.token);
    rival = await registerOwner('rival');
  });

  it('el propietario crea, edita y elimina (de forma lógica) un servicio', async () => {
    const creado = await createService(owner.token, { nombre: 'Corte Clásico', precio: 35000, duracion: 30 });
    expect(creado).toMatchObject({ nombre: 'Corte Clásico', precio: 35000, duracion: 30, veces: 0 });

    const editado = await api().patch(`/api/v1/services/${creado.id}`).set(auth(owner.token)).send({ precio: 40000 });
    expect(editado.body.service).toMatchObject({ nombre: 'Corte Clásico', precio: 40000 });

    expect((await api().delete(`/api/v1/services/${creado.id}`).set(auth(owner.token))).status).toBe(200);
    const lista = await api().get('/api/v1/services').set(auth(owner.token));
    expect(lista.body.services.map((s) => s.id)).not.toContain(creado.id);
  });

  it('valida los datos', async () => {
    const post = (body) => api().post('/api/v1/services').set(auth(owner.token)).send(body);
    expect((await post({ nombre: '', categoria: 'Cortes', precio: 1000, duracion: 30 })).status).toBe(400);
    expect((await post({ nombre: 'X', categoria: 'Cortes', precio: -5, duracion: 30 })).status).toBe(400);
    expect((await post({ nombre: 'X', categoria: 'Cortes', precio: 1000, duracion: 0 })).status).toBe(400);
    expect((await post({ nombre: 'X', categoria: 'Cortes', precio: 1000, duracion: 12.5 })).status).toBe(400);
    expect((await post({ nombre: 'X', categoria: 'Cortes', precio: '1000', duracion: 30 })).status).toBe(400);
  });

  it('el empleado puede ver el catálogo pero no modificarlo', async () => {
    const servicio = await createService(owner.token, { nombre: 'Solo lectura' });
    const lista = await api().get('/api/v1/services').set(auth(empleado.token));
    expect(lista.body.services.map((s) => s.id)).toContain(servicio.id);

    expect((await api().post('/api/v1/services').set(auth(empleado.token)).send({ nombre: 'X', categoria: 'Cortes', precio: 1, duracion: 10 })).status).toBe(403);
    expect((await api().patch(`/api/v1/services/${servicio.id}`).set(auth(empleado.token)).send({ precio: 1 })).status).toBe(403);
    expect((await api().delete(`/api/v1/services/${servicio.id}`).set(auth(empleado.token))).status).toBe(403);
  });

  it('otro negocio no ve ni toca estos servicios', async () => {
    const servicio = await createService(owner.token, { nombre: 'Privado' });
    expect((await api().get('/api/v1/services').set(auth(rival.token))).body.services).toEqual([]);
    // aun siendo propietario de su propio negocio, el servicio ajeno no existe para él
    expect((await api().patch(`/api/v1/services/${servicio.id}`).set(auth(rival.token)).send({ precio: 1 })).status).toBe(404);
    expect((await api().delete(`/api/v1/services/${servicio.id}`).set(auth(rival.token))).status).toBe(404);
  });

  it('exige autenticación', async () => {
    expect((await api().get('/api/v1/services')).status).toBe(401);
  });
});
