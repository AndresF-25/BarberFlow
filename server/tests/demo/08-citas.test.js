/**
 * Módulo 8 — Citas (GET/POST/PATCH /appointments).
 * Lee las tres barberías demo en solo lectura; lo que crea o modifica usa negocios @test.local nuevos.
 * Valores esperados calculados desde el dataset.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  api, auth, prisma, registerOwner, createEmployee, createService, createAppointment,
  requireSeed, demoSessions, bizDay, biz, hoy,
} from './helpers-demo.js';
import { addDays, nowInBusinessTz } from '../../src/lib/utils.js';

const listar = (token, query = '') => api().get(`/api/v1/appointments${query}`).set(auth(token));
const cambiar = (token, id, body) => api().patch(`/api/v1/appointments/${id}`).set(auth(token)).send(body);
const CLAVES = ['barbero', 'cliente', 'clientId', 'employeeId', 'estado', 'fecha', 'hora', 'id', 'metodoPago', 'serviceId', 'servicio', 'status', 'telefono', 'valor'].sort();
const SIN_INGLES = /Required|Expected|Invalid|must contain|String must|Number must/i;
const ESTADO_UI = { pending: 'Pendiente', confirmed: 'Confirmada', completed: 'Finalizada', cancelled: 'Cancelada' };

describe('Módulo 8 · citas', () => {
  let s;
  beforeAll(async () => { await requireSeed(); s = await demoSessions(); });

  describe('listado de los datos demo (solo lectura)', () => {
    const navaja = () => biz('navaja');
    const nombreCliente = (key) => navaja().clients.find((c) => c.key === key).name;
    const nombreServicio = (key) => navaja().services.find((x) => x.key === key).nombre;
    const nombreBarbero = (key) => navaja().staff.find((x) => x.key === key).name;

    it('La Navaja: sin filtros devuelve todas sus citas, con la forma exacta y del día más antiguo al más reciente', async () => {
      const r = await listar(s.navaja.owner);
      expect(r.status).toBe(200);
      expect(Object.keys(r.body)).toEqual(['appointments']);
      expect(r.body.appointments).toHaveLength(navaja().appointments.length);
      for (const a of r.body.appointments) expect(Object.keys(a).sort()).toEqual(CLAVES);
      const claves = r.body.appointments.map((a) => `${a.fecha} ${a.hora}`);
      expect(claves).toEqual([...claves].sort());
    });

    it('cada cita del dataset coincide: cliente, servicio, barbero, hora, fecha y estado en español', async () => {
      const del = (await listar(s.navaja.owner, `?date=${hoy}`)).body.appointments;
      const esperadas = navaja().appointments.filter((a) => a.date === hoy);
      expect(del).toHaveLength(esperadas.length);
      for (const e of esperadas) {
        const a = del.find((x) => x.cliente === nombreCliente(e.client) && x.hora === e.time);
        expect(a, `${e.client} ${e.time}`).toMatchObject({
          servicio: nombreServicio(e.service), barbero: nombreBarbero(e.staff), fecha: hoy, status: e.status, estado: ESTADO_UI[e.status],
        });
      }
    });

    it('hoy hay citas en los 4 estados; las finalizadas traen método de pago y valor, las demás null', async () => {
      const del = (await listar(s.navaja.owner, `?date=${hoy}`)).body.appointments;
      expect(new Set(del.map((a) => a.status))).toEqual(new Set(['pending', 'confirmed', 'completed', 'cancelled']));
      for (const a of del) {
        if (a.status === 'completed') {
          const e = navaja().appointments.find((x) => x.date === hoy && nombreCliente(x.client) === a.cliente && x.time === a.hora);
          expect(a.metodoPago, a.cliente).toBe(e.pay);
          expect(a.valor, a.cliente).toBe(navaja().services.find((x) => x.key === e.service).precio);
        } else {
          expect(a.metodoPago).toBeNull();
          expect(a.valor).toBeNull();
        }
      }
    });

    it('?from y ?to filtran por rango (inclusive) y el conteo coincide con el dataset', async () => {
      const desde = addDays(hoy, -7);
      const hasta = addDays(hoy, 3);
      const esperado = navaja().appointments.filter((a) => a.date >= desde && a.date <= hasta).length;
      expect((await listar(s.navaja.owner, `?from=${desde}&to=${hasta}`)).body.appointments).toHaveLength(esperado);
      expect((await listar(s.navaja.owner, `?from=${hoy}`)).body.appointments).toHaveLength(navaja().appointments.filter((a) => a.date >= hoy).length);
      expect((await listar(s.navaja.owner, `?to=${addDays(hoy, -30)}`)).body.appointments).toHaveLength(navaja().appointments.filter((a) => a.date <= addDays(hoy, -30)).length);
    });

    it('un rango al revés (from > to) devuelve lista vacía; ?date manda sobre from/to', async () => {
      expect((await listar(s.navaja.owner, `?from=${hoy}&to=${addDays(hoy, -5)}`)).body.appointments).toEqual([]);
      const r = await listar(s.navaja.owner, `?date=${hoy}&from=${addDays(hoy, -30)}&to=${addDays(hoy, 30)}`);
      expect(r.body.appointments.every((a) => a.fecha === hoy)).toBe(true);
    });

    it('?status acepta el estado en inglés o en español y filtra', async () => {
      for (const [q, st] of [['pending', 'pending'], ['Confirmada', 'confirmed'], ['completed', 'completed'], ['Cancelada', 'cancelled']]) {
        const r = await listar(s.navaja.owner, `?status=${q}`);
        expect(r.status, q).toBe(200);
        expect(r.body.appointments).toHaveLength(navaja().appointments.filter((a) => a.status === st).length);
        expect(r.body.appointments.every((a) => a.status === st)).toBe(true);
      }
    });

    it('H52 [media]: un estado desconocido da 400 en español, no 500', async () => {
      for (const q of ['inventado', 'PENDING', 'pendiente', '%20', 'a;b']) {
        const r = await listar(s.navaja.owner, `?status=${q}`);
        expect(r.status, q).toBe(400);
        expect(r.body.code).toBe('VALIDATION_ERROR');
        expect(r.body.error).not.toMatch(SIN_INGLES);
        expect(r.body.error).toMatch(/estado/i);
      }
    });

    it('fechas inválidas en los filtros dan 400 (no 500)', async () => {
      for (const q of ['?date=2030-02-31', '?date=basura', '?from=basura', '?to=2030-13-01', '?from=2030-1-1', '?date=']) {
        const r = await listar(s.navaja.owner, q);
        if (q === '?date=') expect(r.status).toBe(200);
        else expect(r.status, q).toBe(400);
      }
    });

    it('?employeeId filtra por barbero (el desactivado también tiene su historial); un id raro da lista vacía', async () => {
      const lista = (await listar(s.navaja.owner)).body.appointments;
      const julian = lista.find((a) => a.barbero === 'Julián Patiño').employeeId;
      const r = await listar(s.navaja.owner, `?employeeId=${julian}`);
      expect(r.body.appointments).toHaveLength(navaja().appointments.filter((a) => a.staff === 'julian').length);
      const sebas = lista.find((a) => a.barbero === 'Sebastián Ortiz').employeeId;
      expect((await listar(s.navaja.owner, `?employeeId=${sebas}`)).body.appointments).toHaveLength(navaja().appointments.filter((a) => a.staff === 'sebas').length);
      expect((await listar(s.navaja.owner, '?employeeId=no-es-uuid')).body.appointments).toEqual([]);
    });

    it('un barbero solo ve las suyas (aunque pida las de otro) y no ve las de los demás', async () => {
      const esperadas = navaja().appointments.filter((a) => a.staff === 'julian').length;
      const r = await listar(s.navaja.julian);
      expect(r.body.appointments).toHaveLength(esperadas);
      expect(new Set(r.body.appointments.map((a) => a.barbero))).toEqual(new Set(['Julián Patiño']));
      const camilo = (await listar(s.navaja.owner)).body.appointments.find((a) => a.barbero === 'Camilo Reyes').employeeId;
      expect((await listar(s.navaja.julian, `?employeeId=${camilo}`)).body.appointments).toHaveLength(esperadas);
    });

    it('El Fade tiene sus propias citas; Barbería Nueva, ninguna; el master 403 NO_BUSINESS; sin sesión 401', async () => {
      const [n, f] = await Promise.all([listar(s.navaja.owner), listar(s.fade.owner)]);
      expect(f.body.appointments).toHaveLength(biz('fade').appointments.length);
      const idsN = new Set(n.body.appointments.map((a) => a.id));
      expect(f.body.appointments.every((a) => !idsN.has(a.id))).toBe(true);
      expect((await listar(s.nueva.owner)).body.appointments).toEqual([]);
      const m = await listar(s.master);
      expect(m.status).toBe(403);
      expect(m.body.code).toBe('NO_BUSINESS');
      expect((await api().get('/api/v1/appointments')).status).toBe(401);
    });
  });

  describe('crear', () => {
    const montar = async (label, { duracion = 60 } = {}) => {
      const d = await registerOwner(label);
      const barbero = await createEmployee(d.token, `Barbero ${label}`);
      const barbero2 = await createEmployee(d.token, `Segundo ${label}`);
      const servicio = await createService(d.token, { nombre: 'Corte', precio: 30000, duracion });
      const crear = (extra = {}, token = d.token) => createAppointment(token, { serviceId: servicio.id, employeeId: barbero.id, date: bizDay(3), time: '10:00', clientName: 'Laura Gómez', clientPhone: '3105556666', ...extra });
      return { d, barbero, barbero2, servicio, crear };
    };

    it('201 con la forma exacta, estado Pendiente, y guarda la cita con su cliente y quién la creó', async () => {
      const { d, barbero, servicio, crear } = await montar('crea');
      const nombreBarbero = (await prisma.user.findUnique({ where: { id: barbero.id } })).name;
      const r = await crear();
      expect(r.status).toBe(201);
      expect(Object.keys(r.body)).toEqual(['appointment']);
      expect(Object.keys(r.body.appointment).sort()).toEqual(CLAVES);
      expect(r.body.appointment).toMatchObject({ estado: 'Pendiente', status: 'pending', cliente: 'Laura Gómez', telefono: '3105556666', hora: '10:00', fecha: bizDay(3), servicio: 'Corte', barbero: nombreBarbero, metodoPago: null, valor: null });
      const fila = await prisma.appointment.findUnique({ where: { id: r.body.appointment.id } });
      expect(fila).toMatchObject({ businessId: d.business.id, serviceId: servicio.id, employeeId: barbero.id, status: 'pending', startTime: '10:00' });
      expect(fila.clientId).toBeTruthy();
      expect(fila.createdById).toBeTruthy();
    });

    it('ignora campos que el cliente no puede fijar (status, id, businessId, createdById)', async () => {
      const { d, barbero, servicio } = await montar('extra');
      const otro = await registerOwner('extraB');
      const r = await api().post('/api/v1/appointments').set(auth(d.token)).send({
        clientName: 'Ana', serviceId: servicio.id, employeeId: barbero.id, appointmentDate: bizDay(3), startTime: '11:00',
        status: 'completed', id: 'x', businessId: otro.business.id, createdById: 'otro',
      });
      expect(r.status).toBe(201);
      expect(r.body.appointment.status).toBe('pending');
      expect((await prisma.appointment.findUnique({ where: { id: r.body.appointment.id } })).businessId).toBe(d.business.id);
      expect(await prisma.serviceTransaction.count({ where: { businessId: d.business.id } })).toBe(0);
    });

    it('H53 [media]: el nombre del cliente se recorta y junta espacios; solo espacios o más de 80 caracteres da 400', async () => {
      const { d, crear } = await montar('nombre');
      for (const clientName of ['', '     ', '\t\n', 'A'.repeat(81)]) {
        const r = await crear({ clientName });
        expect(r.status, JSON.stringify(clientName).slice(0, 20)).toBe(400);
        expect(r.body.code).toBe('VALIDATION_ERROR');
        expect(r.body.error).not.toMatch(SIN_INGLES);
      }
      expect(await prisma.appointment.count({ where: { businessId: d.business.id } })).toBe(0);
      const ok = await crear({ clientName: '   Laura    Gómez  ', time: '15:00' });
      expect(ok.status).toBe(201);
      expect(ok.body.appointment.cliente).toBe('Laura Gómez');
    });

    it('H54: el teléfono, si viene, tiene formato de teléfono (7 a 20 caracteres) y se recorta; vacío o ausente se admite', async () => {
      const { crear } = await montar('tel');
      for (const clientPhone of ['llámame', '123', '1'.repeat(21), '<script>1</script>', 'abc 3105556666']) {
        const r = await crear({ clientPhone, time: '16:00' });
        expect(r.status, clientPhone).toBe(400);
        expect(r.body.error).not.toMatch(SIN_INGLES);
      }
      const ok = await crear({ clientPhone: '  310 555 6666  ', time: '08:00' });
      expect(ok.status).toBe(201);
      expect(ok.body.appointment.telefono).toBe('310 555 6666');
      expect((await crear({ clientPhone: '', time: '09:00' })).status).toBe(201);
      expect((await crear({ clientPhone: undefined, time: '12:00', clientName: 'Sin Teléfono' })).status).toBe(201);
    });

    it('rechaza campos faltantes o de otro tipo, fechas y horas inválidas, ids que no son uuid: 400 en español', async () => {
      const { d, barbero, servicio } = await montar('inv');
      const base = { clientName: 'Ana', serviceId: servicio.id, employeeId: barbero.id, appointmentDate: bizDay(3), startTime: '10:00' };
      const casos = [
        {}, { ...base, clientName: undefined }, { ...base, serviceId: undefined }, { ...base, employeeId: undefined }, { ...base, appointmentDate: undefined }, { ...base, startTime: undefined },
        { ...base, clientName: 5 }, { ...base, clientName: null }, { ...base, serviceId: 'no-uuid' }, { ...base, employeeId: 5 },
        { ...base, appointmentDate: '2030-02-31' }, { ...base, appointmentDate: '2030-13-01' }, { ...base, appointmentDate: '30-01-2030' }, { ...base, appointmentDate: 20300101 },
        ...['99:99', '24:00', '9:30', '10:60', 'abc', '10:00:00', ''].map((startTime) => ({ ...base, startTime })),
      ];
      for (const body of casos) {
        const r = await api().post('/api/v1/appointments').set(auth(d.token)).send(body);
        expect(r.status, JSON.stringify(body)).toBe(400);
        expect(r.body.error).not.toMatch(SIN_INGLES);
      }
      expect(await prisma.appointment.count({ where: { businessId: d.business.id } })).toBe(0);
    });

    it('un cuerpo que no es JSON válido da 400, no 500', async () => {
      const { d } = await montar('json');
      const r = await api().post('/api/v1/appointments').set(auth(d.token)).set('Content-Type', 'application/json').send('{"clientName":');
      expect(r.status).toBe(400);
    });

    it('rechaza fechas pasadas y horas ya pasadas de hoy (PAST_APPOINTMENT)', async () => {
      const { crear } = await montar('pasado');
      for (const date of [bizDay(-1), bizDay(-400)]) {
        const r = await crear({ date });
        expect(r.status).toBe(400);
        expect(r.body.code).toBe('PAST_APPOINTMENT');
      }
      if (nowInBusinessTz().time !== '00:00') {
        const r = await crear({ date: hoy, time: '00:00' });
        expect(r.body.code).toBe('PAST_APPOINTMENT');
      }
    });

    it('H55: no se agenda a más de un año vista (TOO_FAR); un año justo sí', async () => {
      const { crear } = await montar('lejos');
      for (const date of [addDays(hoy, 400), '2099-12-31', '9999-12-31']) {
        const r = await crear({ date });
        expect(r.status, date).toBe(400);
        expect(r.body.code).toBe('TOO_FAR');
        expect(r.body.error).not.toMatch(SIN_INGLES);
      }
      expect((await crear({ date: addDays(hoy, 365) })).status).toBe(201);
    });

    it('H56: una cita no puede terminar después de medianoche (PAST_MIDNIGHT); terminar justo a las 24:00 sí', async () => {
      const { crear, d } = await montar('noche');
      const r = await crear({ time: '23:30' }); // servicio de 60 min
      expect(r.status).toBe(400);
      expect(r.body.code).toBe('PAST_MIDNIGHT');
      expect((await crear({ time: '23:00' })).status).toBe(201); // 23:00–24:00
      expect(await prisma.appointment.count({ where: { businessId: d.business.id } })).toBe(1);
    });

    it('servicio o barbero inexistente, de otro negocio, eliminado o desactivado: 404', async () => {
      const { d, barbero, servicio, crear } = await montar('404');
      const otro = await registerOwner('ajeno');
      const servAjeno = await createService(otro.token, { nombre: 'Ajeno' });
      const barbAjeno = await createEmployee(otro.token, 'Barbero ajeno');
      const cero = '00000000-0000-4000-8000-000000000000';
      expect((await crear({ serviceId: cero })).status).toBe(404);
      expect((await crear({ employeeId: cero })).status).toBe(404);
      expect((await crear({ serviceId: servAjeno.id })).status).toBe(404);
      expect((await crear({ employeeId: barbAjeno.id })).status).toBe(404);
      expect((await crear({ employeeId: d.user?.id ?? (await prisma.user.findFirst({ where: { businessId: d.business.id, role: 'owner' } })).id })).status).toBe(404); // el dueño no es barbero
      await api().delete(`/api/v1/services/${servicio.id}`).set(auth(d.token));
      expect((await crear()).status).toBe(404);
      const otroServ = await createService(d.token, { nombre: 'Otro' });
      await api().patch(`/api/v1/auth/employees/${barbero.id}`).set(auth(d.token)).send({ active: false });
      expect((await crear({ serviceId: otroServ.id })).status).toBe(404);
    });

    it('Barbería Nueva (sin barberos ni servicios) no puede agendar: 404', async () => {
      const r = await createAppointment(s.nueva.owner, { serviceId: '00000000-0000-4000-8000-000000000000', employeeId: '00000000-0000-4000-8000-000000000000', date: bizDay(3), time: '10:00' });
      expect(r.status).toBe(404);
    });

    describe('cruces de horario', () => {
      it('bloquea cruces de todo tipo (empieza dentro, termina dentro, contiene, está contenida) y deja pasar las contiguas', async () => {
        const { crear, servicio, d } = await montar('cruces');
        const corto = await createService(d.token, { nombre: 'Barba', duracion: 30 });
        expect((await crear({ time: '10:00' })).status).toBe(201); // 10:00–11:00
        const choque = async (time, serviceId = servicio.id) => {
          const r = await crear({ time, serviceId });
          expect(r.status, `${time}`).toBe(409);
          expect(r.body.code).toBe('APPOINTMENT_CONFLICT');
        };
        await choque('10:30'); // empieza dentro
        await choque('09:30'); // termina dentro
        await choque('10:00'); // idéntica
        await choque('10:15', corto.id); // contenida
        await choque('09:45'); // 09:45–10:45
        expect((await crear({ time: '11:00' })).status).toBe(201); // contigua después
        expect((await crear({ time: '09:00' })).status).toBe(201); // contigua antes (09:00–10:00)
        const contiene = await crear({ time: '08:30', serviceId: servicio.id }); // 08:30–09:30 cruza con la de 09:00
        expect(contiene.status).toBe(409);
      });

      it('el mismo horario con otro barbero, y el mismo barbero en otro día, no chocan', async () => {
        const { crear, barbero2 } = await montar('otros');
        expect((await crear({ time: '10:00' })).status).toBe(201);
        expect((await crear({ time: '10:00', employeeId: barbero2.id })).status).toBe(201);
        expect((await crear({ time: '10:00', date: bizDay(4) })).status).toBe(201);
      });

      it('una cita cancelada libera el horario; una finalizada de hoy no se puede pisar', async () => {
        const { d, crear } = await montar('libera');
        const a = await crear({ time: '14:00' });
        expect((await crear({ time: '14:30' })).status).toBe(409);
        await cambiar(d.token, a.body.appointment.id, { status: 'cancelled' });
        expect((await crear({ time: '14:30' })).status).toBe(201);
      });

      it('H57 [alta]: 6 peticiones simultáneas al mismo barbero y horario crean UNA sola cita (nunca doble reserva)', async () => {
        const { d, barbero, servicio } = await montar('carrera');
        const rs = await Promise.all(Array.from({ length: 6 }, (_, i) => createAppointment(d.token, { serviceId: servicio.id, employeeId: barbero.id, date: bizDay(3), time: '10:00', clientName: `Cliente ${i}` })));
        expect(rs.filter((r) => r.status >= 500)).toHaveLength(0);
        expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
        expect(rs.filter((r) => r.status === 409)).toHaveLength(5);
        expect(await prisma.appointment.count({ where: { businessId: d.business.id, employeeId: barbero.id } })).toBe(1);
      });

      it('H57b: peticiones simultáneas que se cruzan solo en parte (10:00, 10:30, 11:00 de 60 min) dejan únicamente las compatibles', async () => {
        const { d, barbero, servicio } = await montar('parcial');
        const rs = await Promise.all(['10:00', '10:30', '11:00', '11:30', '12:00'].map((time) => createAppointment(d.token, { serviceId: servicio.id, employeeId: barbero.id, date: bizDay(3), time })));
        expect(rs.filter((r) => r.status >= 500)).toHaveLength(0);
        const filas = await prisma.appointment.findMany({ where: { businessId: d.business.id }, orderBy: { startTime: 'asc' } });
        const min = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
        for (let i = 0; i < filas.length - 1; i += 1) expect(min(filas[i + 1].startTime) - min(filas[i].startTime)).toBeGreaterThanOrEqual(60);
        expect(filas.length).toBe(rs.filter((r) => r.status === 201).length);
      });

      it('10 citas simultáneas en horarios distintos se guardan todas', async () => {
        const { d, barbero, servicio } = await montar('rafaga', { duracion: 30 });
        const horas = Array.from({ length: 10 }, (_, i) => `${String(8 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
        const rs = await Promise.all(horas.map((time, i) => createAppointment(d.token, { serviceId: servicio.id, employeeId: barbero.id, date: bizDay(3), time, clientName: `Cliente ${i}` })));
        expect(rs.map((r) => r.status)).toEqual(Array(10).fill(201));
      });
    });

    describe('como barbero', () => {
      it('al crear queda asignada a sí mismo aunque indique a otro, y no puede agendar con un barbero ajeno', async () => {
        const { barbero, barbero2, servicio } = await montar('self');
        const r = await createAppointment(barbero.token, { serviceId: servicio.id, employeeId: barbero2.id, date: bizDay(3), time: '10:00' });
        expect(r.status).toBe(201);
        expect(r.body.appointment.employeeId).toBe(barbero.id);
      });
    });
  });

  describe('cambiar de estado', () => {
    const montar = async (label) => {
      const d = await registerOwner(label);
      const barbero = await createEmployee(d.token, `Barbero ${label}`);
      const barbero2 = await createEmployee(d.token, `Segundo ${label}`);
      const servicio = await createService(d.token, { nombre: 'Corte', precio: 30000, duracion: 30 });
      let n = 0;
      const nueva = async (extra = {}) => {
        const time = `${String(8 + Math.floor(n / 2)).padStart(2, '0')}:${n % 2 ? '30' : '00'}`;
        n += 1;
        const r = await createAppointment(d.token, { serviceId: servicio.id, employeeId: barbero.id, date: bizDay(3), time, clientName: `Cliente ${n}`, ...extra });
        expect(r.status, JSON.stringify(r.body)).toBe(201);
        return r.body.appointment;
      };
      const en = async (estado) => {
        const a = await nueva();
        if (estado === 'confirmed') await cambiar(d.token, a.id, { status: 'confirmed' });
        if (estado === 'completed') await cambiar(d.token, a.id, { status: 'completed', paymentMethod: 'cash' });
        if (estado === 'cancelled') await cambiar(d.token, a.id, { status: 'cancelled' });
        return a;
      };
      const estadoDe = async (id) => (await prisma.appointment.findUnique({ where: { id } })).status;
      return { d, barbero, barbero2, servicio, nueva, en, estadoDe };
    };

    it('H58 [media]: matriz de transiciones — pendiente y confirmada pasan a cualquiera; finalizada y cancelada no se reabren (solo repetir el mismo estado)', async () => {
      const { d, en, estadoDe } = await montar('matriz');
      const ok = 200;
      const no = 400;
      const matriz = {
        pending: { pending: ok, confirmed: ok, completed: ok, cancelled: ok },
        confirmed: { pending: ok, confirmed: ok, completed: ok, cancelled: ok },
        completed: { pending: no, confirmed: no, completed: ok, cancelled: no },
        cancelled: { pending: no, confirmed: no, completed: no, cancelled: ok },
      };
      for (const [desde, destinos] of Object.entries(matriz)) {
        for (const [hacia, esperado] of Object.entries(destinos)) {
          const a = await en(desde);
          const r = await cambiar(d.token, a.id, { status: hacia });
          expect(r.status, `${desde} → ${hacia}`).toBe(esperado);
          if (esperado === no) {
            expect(r.body.code, `${desde} → ${hacia}`).toBe('INVALID_STATUS');
            expect(r.body.error).not.toMatch(SIN_INGLES);
            expect(await estadoDe(a.id), `${desde} → ${hacia} no debe cambiar`).toBe(desde);
          } else {
            expect(await estadoDe(a.id), `${desde} → ${hacia}`).toBe(hacia);
          }
        }
      }
    });

    it('acepta el estado en español y devuelve la cita con estado y status coherentes', async () => {
      const { d, nueva } = await montar('es');
      for (const [ui, st] of [['Confirmada', 'confirmed'], ['Pendiente', 'pending'], ['Cancelada', 'cancelled']]) {
        const a = await nueva();
        const r = await cambiar(d.token, a.id, { status: ui });
        expect(r.status, ui).toBe(200);
        expect(r.body.appointment).toMatchObject({ status: st, estado: ui });
      }
    });

    it('finalizar cobra el precio vigente con el método elegido, crea la transacción, el cliente y suma `veces`', async () => {
      const { d, nueva, servicio } = await montar('cobro');
      const a = await nueva({ clientName: 'Laura Gómez', clientPhone: '3105556666' });
      const r = await cambiar(d.token, a.id, { status: 'completed', paymentMethod: 'card' });
      expect(r.status).toBe(200);
      expect(r.body.appointment).toMatchObject({ estado: 'Finalizada', metodoPago: 'card', valor: 30000 });
      const tx = await prisma.serviceTransaction.findMany({ where: { appointmentId: a.id } });
      expect(tx).toHaveLength(1);
      expect(tx[0]).toMatchObject({ amountCents: 3000000, paymentMethod: 'card' });
      expect((await prisma.service.findUnique({ where: { id: servicio.id } })).timesPerformed).toBe(1);
      expect((await api().get('/api/v1/clients?search=laura').set(auth(d.token))).body.clients[0]).toMatchObject({ visitas: 1, gasto: 30000 });
    });

    it('sin método de pago se cobra en efectivo', async () => {
      const { d, nueva } = await montar('efectivo');
      const a = await nueva();
      expect((await cambiar(d.token, a.id, { status: 'completed' })).body.appointment.metodoPago).toBe('cash');
    });

    it('H59: el método de pago solo se indica al finalizar: sin finalizar da 400; en una finalizada corrige el método sin cambiar el monto ni contar otra vez', async () => {
      const { d, nueva, en, servicio } = await montar('pago');
      const pendiente = await nueva();
      for (const body of [{ paymentMethod: 'card' }, { status: 'confirmed', paymentMethod: 'card' }, { status: 'cancelled', paymentMethod: 'cash' }]) {
        const r = await cambiar(d.token, pendiente.id, body);
        expect(r.status, JSON.stringify(body)).toBe(400);
        expect(r.body.error).toMatch(/finalizar/i);
      }
      const hecha = await en('completed'); // cobrada en efectivo
      const r = await cambiar(d.token, hecha.id, { paymentMethod: 'transfer' });
      expect(r.status).toBe(200);
      expect(r.body.appointment).toMatchObject({ estado: 'Finalizada', metodoPago: 'transfer', valor: 30000 });
      const r2 = await cambiar(d.token, hecha.id, { status: 'completed', paymentMethod: 'card' });
      expect(r2.body.appointment.metodoPago).toBe('card');
      const tx = await prisma.serviceTransaction.findMany({ where: { appointmentId: hecha.id } });
      expect(tx).toHaveLength(1);
      expect(tx[0]).toMatchObject({ amountCents: 3000000, paymentMethod: 'card' });
      expect((await prisma.service.findUnique({ where: { id: servicio.id } })).timesPerformed).toBe(1);
      // repetir «finalizar» sin método no cambia el que ya tenía
      expect((await cambiar(d.token, hecha.id, { status: 'completed' })).body.appointment.metodoPago).toBe('card');
    });

    it('rechaza estados y métodos de pago desconocidos o de otro tipo con 400 en español', async () => {
      const { d, nueva } = await montar('inv');
      const a = await nueva();
      for (const body of [{ status: 'inventado' }, { status: 5 }, { status: null }, { paymentMethod: 'bitcoin' }, { status: 'completed', paymentMethod: 'CASH' }, { status: 'completed', paymentMethod: 5 }]) {
        const r = await cambiar(d.token, a.id, body);
        expect(r.status, JSON.stringify(body)).toBe(400);
        expect(r.body.code).toBe('VALIDATION_ERROR');
        expect(r.body.error).not.toMatch(SIN_INGLES);
      }
    });

    it('un cuerpo vacío no cambia nada y responde 200; ignora campos como fecha, hora, cliente o barbero', async () => {
      const { d, nueva, barbero2 } = await montar('vacio');
      const a = await nueva();
      expect((await cambiar(d.token, a.id, {})).body.appointment).toEqual(a);
      const r = await cambiar(d.token, a.id, { hora: '23:00', startTime: '23:00', cliente: 'Otro', clientName: 'Otro', employeeId: barbero2.id, appointmentDate: bizDay(9) });
      expect(r.status).toBe(200);
      expect(r.body.appointment).toEqual(a);
    });

    it('una cita inexistente, con id raro o de otro negocio da 404', async () => {
      const { d, nueva } = await montar('404');
      const otro = await registerOwner('ajeno');
      const a = await nueva();
      for (const id of ['00000000-0000-0000-0000-000000000000', 'no-es-uuid', '%00', 'x'.repeat(300)]) {
        expect((await cambiar(d.token, encodeURIComponent(id), { status: 'confirmed' })).status, id).toBe(404);
      }
      expect((await cambiar(otro.token, a.id, { status: 'cancelled' })).status).toBe(404);
      expect((await prisma.appointment.findUnique({ where: { id: a.id } })).status).toBe('pending');
    });

    it('H60: cancelar y finalizar a la vez la misma cita termina en un estado coherente (si se finalizó, hay cobro; si se canceló, no)', async () => {
      const { d, nueva, estadoDe } = await montar('duelo');
      for (let i = 0; i < 3; i += 1) {
        const a = await nueva();
        const rs = await Promise.all([cambiar(d.token, a.id, { status: 'completed' }), cambiar(d.token, a.id, { status: 'cancelled' })]);
        expect(rs.filter((r) => r.status >= 500)).toHaveLength(0);
        const estado = await estadoDe(a.id);
        const cobros = await prisma.serviceTransaction.count({ where: { appointmentId: a.id } });
        expect(['completed', 'cancelled']).toContain(estado);
        expect(cobros).toBe(estado === 'completed' ? 1 : 0);
      }
    });

    it('finalizar la misma cita 5 veces a la vez cobra una sola vez, sin errores', async () => {
      const { d, nueva } = await montar('multi');
      const a = await nueva();
      const rs = await Promise.all(Array.from({ length: 5 }, () => cambiar(d.token, a.id, { status: 'completed' })));
      expect(rs.map((r) => r.status)).toEqual(Array(5).fill(200));
      expect(await prisma.serviceTransaction.count({ where: { appointmentId: a.id } })).toBe(1);
    });
  });

  describe('permisos', () => {
    const montar = async (label) => {
      const d = await registerOwner(label);
      const b1 = await createEmployee(d.token, `Uno ${label}`);
      const b2 = await createEmployee(d.token, `Dos ${label}`);
      const servicio = await createService(d.token, { nombre: 'Corte', precio: 30000, duracion: 30 });
      const de = async (barbero, time) => (await createAppointment(d.token, { serviceId: servicio.id, employeeId: barbero.id, date: bizDay(3), time, clientName: `De ${barbero.name}` })).body.appointment;
      return { d, b1, b2, de };
    };

    it('un barbero confirma, finaliza y cancela SUS citas; no puede tocar las de otro (403) y no cambian', async () => {
      const { d, b1, b2, de } = await montar('roles');
      const mia = await de(b1, '09:00');
      const mia2 = await de(b1, '10:00');
      const ajena = await de(b2, '09:00');
      expect((await cambiar(b1.token, mia.id, { status: 'confirmed' })).status).toBe(200);
      expect((await cambiar(b1.token, mia.id, { status: 'completed', paymentMethod: 'cash' })).status).toBe(200);
      expect((await cambiar(b1.token, mia2.id, { status: 'cancelled' })).status).toBe(200);
      for (const body of [{ status: 'confirmed' }, { status: 'completed' }, { status: 'cancelled' }, { paymentMethod: 'card' }]) {
        expect((await cambiar(b1.token, ajena.id, body)).status, JSON.stringify(body)).toBe(403);
      }
      expect((await prisma.appointment.findUnique({ where: { id: ajena.id } })).status).toBe('pending');
      expect((await cambiar(d.token, ajena.id, { status: 'confirmed' })).status).toBe(200); // el dueño sí
    });

    it('el master 403, sin sesión 401, en las tres operaciones', async () => {
      const { de, b1 } = await montar('sinsesion');
      const a = await de(b1, '09:00');
      expect((await listar(s.master)).status).toBe(403);
      expect((await cambiar(s.master, a.id, { status: 'confirmed' })).status).toBe(403);
      expect((await createAppointment(s.master, { serviceId: a.serviceId, employeeId: b1.id, date: bizDay(3), time: '11:00' })).status).toBe(403);
      expect((await api().post('/api/v1/appointments').send({})).status).toBe(401);
      expect((await api().patch(`/api/v1/appointments/${a.id}`).send({ status: 'confirmed' })).status).toBe(401);
    });

    it('el token de La Navaja no puede tocar las citas de El Fade', async () => {
      const ajenas = (await listar(s.fade.owner)).body.appointments.slice(0, 3);
      expect(ajenas.length).toBeGreaterThan(0);
      for (const a of ajenas) expect((await cambiar(s.navaja.owner, a.id, { status: 'cancelled' })).status).toBe(404);
      expect((await listar(s.fade.owner)).body.appointments.filter((a) => a.status === 'cancelled').length)
        .toBe(biz('fade').appointments.filter((a) => a.status === 'cancelled').length);
    });
  });

  describe('fechas', () => {
    it('las citas se guardan y devuelven con la fecha del negocio (YYYY-MM-DD) tal cual se pidió', async () => {
      const d = await registerOwner('fecha');
      const b = await createEmployee(d.token, 'Barbero Fecha');
      const sv = await createService(d.token, { nombre: 'Corte', duracion: 30 });
      for (const dia of [1, 2, 30, 365]) {
        const fecha = bizDay(dia);
        const r = await createAppointment(d.token, { serviceId: sv.id, employeeId: b.id, date: fecha, time: '08:00' });
        expect(r.body.appointment.fecha).toBe(fecha);
        expect((await listar(d.token, `?date=${fecha}`)).body.appointments).toHaveLength(1);
      }
    });
  });
});
