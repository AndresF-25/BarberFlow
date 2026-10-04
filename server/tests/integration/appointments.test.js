import { beforeAll, describe, expect, it } from 'vitest';
import { nowInBusinessTz } from '../../src/lib/utils.js';
import {
  api, auth, bizDay, bizToday, createAppointment, createEmployee, createService, dbUp, registerOwner,
} from '../helpers.js';

describe.skipIf(!dbUp)('citas', () => {
  let owner;
  let barbero1;
  let barbero2;
  let servicio; // 60 min
  let rival; // otro negocio

  const cita = (extra) => createAppointment(owner.token, { serviceId: servicio.id, employeeId: barbero1.id, date: bizDay(2), time: '10:00', ...extra });
  const listar = (token, query = '') => api().get(`/api/v1/appointments${query}`).set(auth(token));

  beforeAll(async () => {
    owner = await registerOwner('citas');
    barbero1 = await createEmployee(owner.token, 'Barbero Uno');
    barbero2 = await createEmployee(owner.token, 'Barbero Dos');
    servicio = await createService(owner.token, { duracion: 60 });
    rival = await registerOwner('rival');
  });

  describe('validaciones', () => {
    it('rechaza citas en el pasado', async () => {
      const res = await cita({ date: bizDay(-1) });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('PAST_APPOINTMENT');
    });

    it('rechaza una hora anterior a la actual en el día de hoy', async () => {
      if (nowInBusinessTz().time === '00:00') return; // único minuto del día en que 00:00 no es pasado
      const res = await cita({ date: bizToday(), time: '00:00' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('PAST_APPOINTMENT');
    });

    it.each(['99:99', '24:00', '9:30', '10:60', 'abc'])('rechaza la hora "%s"', async (time) => {
      expect((await cita({ time })).status).toBe(400);
    });

    it.each(['2030-02-31', '2030-13-01', '30-01-2030'])('rechaza la fecha "%s"', async (date) => {
      expect((await cita({ date })).status).toBe(400);
    });

    it('exige nombre del cliente y servicio/empleado válidos', async () => {
      expect((await cita({ clientName: '' })).status).toBe(400);
      const sinServicio = await createAppointment(owner.token, { serviceId: '00000000-0000-4000-8000-000000000000', employeeId: barbero1.id, date: bizDay(2), time: '11:00' });
      expect(sinServicio.status).toBe(404);
      const sinEmpleado = await createAppointment(owner.token, { serviceId: servicio.id, employeeId: '00000000-0000-4000-8000-000000000000', date: bizDay(2), time: '11:00' });
      expect(sinEmpleado.status).toBe(404);
    });

    it('un filtro con fecha inválida devuelve 400 y no 500', async () => {
      expect((await listar(owner.token, '?date=2030-02-31')).status).toBe(400);
      expect((await listar(owner.token, '?from=basura')).status).toBe(400);
    });
  });

  describe('cruces de horario', () => {
    const dia = bizDay(5);

    it('bloquea una cita que se cruza con otra del mismo barbero', async () => {
      expect((await cita({ date: dia, time: '09:00' })).status).toBe(201); // 09:00-10:00
      const cruce = await cita({ date: dia, time: '09:30' });
      expect(cruce.status).toBe(409);
      expect(cruce.body.code).toBe('APPOINTMENT_CONFLICT');
    });

    it('permite citas contiguas y el mismo horario con otro barbero', async () => {
      expect((await cita({ date: dia, time: '10:00' })).status).toBe(201); // empieza justo cuando termina la anterior
      expect((await cita({ date: dia, time: '09:00', employeeId: barbero2.id })).status).toBe(201);
    });

    it('una cita cancelada libera el horario', async () => {
      const creada = await cita({ date: dia, time: '14:00' });
      expect((await cita({ date: dia, time: '14:30' })).status).toBe(409);
      await api().patch(`/api/v1/appointments/${creada.body.appointment.id}`).set(auth(owner.token)).send({ status: 'cancelled' });
      expect((await cita({ date: dia, time: '14:30' })).status).toBe(201);
    });

    it('la duración del servicio cuenta: uno de 30 min deja libre la segunda mitad de la hora', async () => {
      const corto = await createService(owner.token, { nombre: 'Barba', duracion: 30 });
      expect((await cita({ date: dia, time: '16:00', serviceId: corto.id })).status).toBe(201); // 16:00-16:30
      expect((await cita({ date: dia, time: '16:30', serviceId: corto.id })).status).toBe(201);
    });
  });

  describe('ciclo de vida', () => {
    it('confirma y finaliza con método de pago, creando la transacción y el cliente', async () => {
      const creada = await cita({ date: bizDay(6), time: '10:00', clientName: 'Cliente Ciclo', clientPhone: '3001234567' });
      const id = creada.body.appointment.id;
      expect(creada.body.appointment.estado).toBe('Pendiente');

      const confirmada = await api().patch(`/api/v1/appointments/${id}`).set(auth(owner.token)).send({ status: 'Confirmada' });
      expect(confirmada.body.appointment.status).toBe('confirmed');

      const final = await api().patch(`/api/v1/appointments/${id}`).set(auth(owner.token)).send({ status: 'completed', paymentMethod: 'card' });
      expect(final.status).toBe(200);
      expect(final.body.appointment.estado).toBe('Finalizada');

      const clientes = await api().get('/api/v1/clients?search=Cliente Ciclo').set(auth(owner.token));
      expect(clientes.body.clients[0]).toMatchObject({ nombre: 'Cliente Ciclo', visitas: 1, gasto: 30000 });
    });

    it('finalizar dos veces no duplica el cobro', async () => {
      const creada = await cita({ date: bizDay(6), time: '12:00', clientName: 'Cliente Doble' });
      const id = creada.body.appointment.id;
      await api().patch(`/api/v1/appointments/${id}`).set(auth(owner.token)).send({ status: 'completed' });
      await api().patch(`/api/v1/appointments/${id}`).set(auth(owner.token)).send({ status: 'completed' });
      const clientes = await api().get('/api/v1/clients?search=Cliente Doble').set(auth(owner.token));
      expect(clientes.body.clients[0].visitas).toBe(1);
    });

    it('no se puede finalizar una cancelada ni cancelar una finalizada', async () => {
      const a = (await cita({ date: bizDay(7), time: '10:00' })).body.appointment.id;
      await api().patch(`/api/v1/appointments/${a}`).set(auth(owner.token)).send({ status: 'cancelled' });
      expect((await api().patch(`/api/v1/appointments/${a}`).set(auth(owner.token)).send({ status: 'completed' })).status).toBe(400);

      const b = (await cita({ date: bizDay(7), time: '12:00' })).body.appointment.id;
      await api().patch(`/api/v1/appointments/${b}`).set(auth(owner.token)).send({ status: 'completed' });
      expect((await api().patch(`/api/v1/appointments/${b}`).set(auth(owner.token)).send({ status: 'cancelled' })).status).toBe(400);
    });

    it('rechaza estados y métodos de pago desconocidos', async () => {
      const id = (await cita({ date: bizDay(7), time: '15:00' })).body.appointment.id;
      expect((await api().patch(`/api/v1/appointments/${id}`).set(auth(owner.token)).send({ status: 'inventado' })).status).toBe(400);
      expect((await api().patch(`/api/v1/appointments/${id}`).set(auth(owner.token)).send({ paymentMethod: 'bitcoin' })).status).toBe(400);
    });
  });

  describe('permisos del empleado', () => {
    it('solo ve sus propias citas, aunque pida las de otro', async () => {
      const dia = bizDay(8);
      await cita({ date: dia, time: '09:00', clientName: 'De Uno' });
      await cita({ date: dia, time: '09:00', clientName: 'De Dos', employeeId: barbero2.id });

      const propias = await listar(barbero1.token, `?date=${dia}`);
      expect(propias.body.appointments.map((a) => a.cliente)).toEqual(['De Uno']);

      const intento = await listar(barbero1.token, `?date=${dia}&employeeId=${barbero2.id}`);
      expect(intento.body.appointments.map((a) => a.cliente)).toEqual(['De Uno']);

      const todas = await listar(owner.token, `?date=${dia}`);
      expect(todas.body.appointments.map((a) => a.cliente).sort()).toEqual(['De Dos', 'De Uno']);
    });

    it('no puede modificar la cita de otro barbero', async () => {
      const id = (await cita({ date: bizDay(8), time: '12:00', employeeId: barbero2.id })).body.appointment.id;
      const res = await api().patch(`/api/v1/appointments/${id}`).set(auth(barbero1.token)).send({ status: 'confirmed' });
      expect(res.status).toBe(403);
    });

    it('al crear una cita queda asignada a sí mismo, aunque indique a otro', async () => {
      const res = await createAppointment(barbero1.token, { serviceId: servicio.id, employeeId: barbero2.id, date: bizDay(8), time: '15:00' });
      expect(res.status).toBe(201);
      expect(res.body.appointment.employeeId).toBe(barbero1.id);
    });
  });

  describe('aislamiento entre negocios', () => {
    it('otro negocio no ve ni modifica estas citas', async () => {
      const id = (await cita({ date: bizDay(9), time: '10:00' })).body.appointment.id;
      expect((await listar(rival.token, `?date=${bizDay(9)}`)).body.appointments).toEqual([]);
      expect((await api().patch(`/api/v1/appointments/${id}`).set(auth(rival.token)).send({ status: 'cancelled' })).status).toBe(404);
    });

    it('no se puede agendar con el servicio o el barbero de otro negocio', async () => {
      const res = await createAppointment(rival.token, { serviceId: servicio.id, employeeId: barbero1.id, date: bizDay(9), time: '10:00' });
      expect(res.status).toBe(404);
    });
  });

  it('sin token no hay acceso', async () => {
    expect((await api().get('/api/v1/appointments')).status).toBe(401);
    expect((await api().post('/api/v1/appointments').send({})).status).toBe(401);
  });
});
