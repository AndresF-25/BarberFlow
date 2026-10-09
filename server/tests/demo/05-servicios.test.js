/**
 * Módulo 5 — Servicios (GET/POST/PATCH/DELETE /services).
 * Lee las tres barberías demo en solo lectura; lo que crea o modifica usa negocios @test.local nuevos.
 * Los hallazgos sin corregir se marcan con `it.fails('HALLAZGO …')`.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  api, auth, prisma, registerOwner, createEmployee, createService, createAppointment,
  requireSeed, demoSessions, bizDay, biz, summaries,
} from './helpers-demo.js';

const listar = (token) => api().get('/api/v1/services').set(auth(token));
const crear = (token, body) => api().post('/api/v1/services').set(auth(token)).send(body);
const editar = (token, id, body) => api().patch(`/api/v1/services/${id}`).set(auth(token)).send(body);
const borrar = (token, id) => api().delete(`/api/v1/services/${id}`).set(auth(token));
const valido = (over = {}) => ({ nombre: 'Corte de prueba', categoria: 'Cortes', precio: 30000, duracion: 45, ...over });
const CLAVES = ['categoria', 'duracion', 'id', 'nombre', 'precio', 'veces'];
const SIN_INGLES = /Required|Expected|Invalid|must contain|String must|Number must/i;

describe('Módulo 5 · servicios', () => {
  let s;
  beforeAll(async () => { await requireSeed(); s = await demoSessions(); });

  describe('catálogo de los datos demo (solo lectura)', () => {
    it('La Navaja: lista sus 7 servicios activos con la forma exacta, ordenados por nombre', async () => {
      const r = await listar(s.navaja.owner);
      expect(r.status).toBe(200);
      expect(Object.keys(r.body)).toEqual(['services']);
      expect(r.body.services).toHaveLength(7);
      for (const sv of r.body.services) expect(Object.keys(sv).sort()).toEqual(CLAVES);
      const nombres = r.body.services.map((x) => x.nombre);
      expect(nombres).toEqual([...nombres].sort((a, b) => a.localeCompare(b, 'es')));
    });

    it('no muestra el servicio desactivado ni datos internos (isActive, businessId, priceCents)', async () => {
      const r = await listar(s.navaja.owner);
      expect(r.body.services.map((x) => x.nombre)).not.toContain('Paquete mensual (descontinuado)');
      expect(JSON.stringify(r.body)).not.toMatch(/isActive|businessId|priceCents|durationMinutes|timesPerformed/);
    });

    it('nombre, categoría, precio y duración coinciden con el dataset', async () => {
      const r = await listar(s.navaja.owner);
      const activos = biz('navaja').services.filter((x) => x.active);
      expect(r.body.services.map((x) => [x.nombre, x.categoria, x.precio, x.duracion]).sort())
        .toEqual(activos.map((x) => [x.nombre, x.categoria, x.precio, x.duracion]).sort());
    });

    it('`veces` de cada servicio = citas finalizadas de ese servicio según el dataset', async () => {
      const r = await listar(s.navaja.owner);
      const fin = biz('navaja').appointments.filter((a) => a.status === 'completed');
      for (const def of biz('navaja').services.filter((x) => x.active)) {
        const esperado = fin.filter((a) => a.service === def.key).length;
        expect(r.body.services.find((x) => x.nombre === def.nombre).veces, def.nombre).toBe(esperado);
      }
      expect(r.body.services.reduce((a, x) => a + x.veces, 0)).toBeLessThanOrEqual(summaries.navaja.totals.completed);
    });

    it('El Fade tiene los mismos nombres que La Navaja pero con sus propios ids y precios (sin fugas)', async () => {
      const [n, f] = await Promise.all([listar(s.navaja.owner), listar(s.fade.owner)]);
      const idsN = new Set(n.body.services.map((x) => x.id));
      expect(f.body.services.length).toBe(biz('fade').services.filter((x) => x.active).length);
      for (const sv of f.body.services) expect(idsN.has(sv.id)).toBe(false);
      const comunes = f.body.services.filter((x) => n.body.services.some((y) => y.nombre === x.nombre));
      expect(comunes.length).toBeGreaterThan(0);
    });

    it('Barbería Nueva empieza con el catálogo vacío', async () => {
      const r = await listar(s.nueva.owner);
      expect(r.status).toBe(200);
      expect(r.body.services).toEqual([]);
    });

    it('un barbero ve el mismo catálogo que su dueño', async () => {
      const [o, j] = await Promise.all([listar(s.navaja.owner), listar(s.navaja.julian)]);
      expect(j.status).toBe(200);
      expect(j.body).toEqual(o.body);
    });

    it('el master no tiene negocio (403 NO_BUSINESS) y sin sesión da 401', async () => {
      const m = await listar(s.master);
      expect(m.status).toBe(403);
      expect(m.body.code).toBe('NO_BUSINESS');
      expect((await api().get('/api/v1/services')).status).toBe(401);
    });
  });

  describe('crear', () => {
    it('201 con la forma exacta, `veces` en 0; aparece en el listado y queda guardado en centavos', async () => {
      const d = await registerOwner('crear');
      const r = await crear(d.token, valido({ nombre: 'Fade premium', categoria: 'Cortes', precio: 45000, duracion: 50 }));
      expect(r.status).toBe(201);
      expect(Object.keys(r.body)).toEqual(['service']);
      expect(Object.keys(r.body.service).sort()).toEqual(CLAVES);
      expect(r.body.service).toMatchObject({ nombre: 'Fade premium', categoria: 'Cortes', precio: 45000, duracion: 50, veces: 0 });
      expect((await listar(d.token)).body.services).toEqual([r.body.service]);
      const fila = await prisma.service.findUnique({ where: { id: r.body.service.id } });
      expect(fila).toMatchObject({ businessId: d.business.id, priceCents: 4500000, durationMinutes: 50, isActive: true, timesPerformed: 0 });
    });

    it('acepta tildes, ñ, emojis y texto con HTML (se guarda como texto)', async () => {
      const d = await registerOwner('texto');
      for (const nombre of ['Corte niño ñandú ✂️', '<b>Corte</b> & "barba"', "Rasurado d'Artagnan"]) {
        const r = await crear(d.token, valido({ nombre }));
        expect(r.status, nombre).toBe(201);
        expect(r.body.service.nombre).toBe(nombre);
      }
    });

    it('ignora campos que el cliente no puede fijar (id, veces, isActive, businessId)', async () => {
      const a = await registerOwner('extraA');
      const b = await registerOwner('extraB');
      const r = await crear(a.token, valido({ id: 'x', veces: 99, isActive: false, businessId: b.business.id, timesPerformed: 50 }));
      expect(r.status).toBe(201);
      expect(r.body.service.veces).toBe(0);
      expect(r.body.service.id).not.toBe('x');
      const fila = await prisma.service.findUnique({ where: { id: r.body.service.id } });
      expect(fila).toMatchObject({ businessId: a.business.id, isActive: true, timesPerformed: 0 });
      expect((await listar(b.token)).body.services).toEqual([]);
    });

    it('precio 0 se admite (cortesía) pero no negativo', async () => {
      const d = await registerOwner('cero');
      expect((await crear(d.token, valido({ precio: 0 }))).status).toBe(201);
      expect((await crear(d.token, valido({ nombre: 'Otro', precio: -1 }))).status).toBe(400);
    });

    it('rechaza campos faltantes o de otro tipo con 400 VALIDATION_ERROR en español', async () => {
      const d = await registerOwner('inv');
      const casos = [
        {}, { ...valido(), nombre: undefined }, { ...valido(), categoria: undefined }, { ...valido(), precio: undefined }, { ...valido(), duracion: undefined },
        valido({ nombre: 123 }), valido({ nombre: null }), valido({ nombre: ['x'] }), valido({ categoria: 5 }),
        valido({ precio: '30000' }), valido({ precio: null }), valido({ duracion: '45' }), valido({ duracion: 0 }), valido({ duracion: -5 }), valido({ duracion: 12.5 }),
        valido({ nombre: '' }), valido({ categoria: '' }),
      ];
      for (const body of casos) {
        const r = await crear(d.token, body);
        expect(r.status, JSON.stringify(body)).toBe(400);
        expect(r.body.code).toBe('VALIDATION_ERROR');
        expect(r.body.error).not.toMatch(SIN_INGLES);
      }
      expect((await listar(d.token)).body.services).toEqual([]);
    });

    it('un cuerpo que no es JSON válido da 400, no 500', async () => {
      const d = await registerOwner('json');
      const r = await api().post('/api/v1/services').set(auth(d.token)).set('Content-Type', 'application/json').send('{"nombre":');
      expect(r.status).toBe(400);
    });

    it('10 altas simultáneas se guardan las 10', async () => {
      const d = await registerOwner('rafaga');
      const rs = await Promise.all(Array.from({ length: 10 }, (_, i) => crear(d.token, valido({ nombre: `Servicio ${i}` }))));
      expect(rs.map((r) => r.status)).toEqual(Array(10).fill(201));
      expect((await listar(d.token)).body.services).toHaveLength(10);
    });
  });

  describe('límites y reglas del catálogo', () => {
    const rechaza = async (body, patron) => {
      const d = await registerOwner('lim');
      const r = await crear(d.token, valido(body));
      expect(r.status, JSON.stringify(body).slice(0, 90)).toBe(400);
      expect(r.body.code).toBe('VALIDATION_ERROR');
      expect(r.body.error).not.toMatch(SIN_INGLES);
      if (patron) expect(r.body.error).toMatch(patron);
      expect((await listar(d.token)).body.services).toEqual([]);
    };

    it('H23: el nombre se recorta, no puede ser solo espacios ni pasar de 80 caracteres', async () => {
      await rechaza({ nombre: '     ' });
      await rechaza({ nombre: 'A'.repeat(81) });
      const d = await registerOwner('recorte');
      const r = await crear(d.token, valido({ nombre: '   Corte Recortado   ' }));
      expect(r.status).toBe(201);
      expect(r.body.service.nombre).toBe('Corte Recortado');
      expect((await crear(d.token, valido({ nombre: 'B'.repeat(80) }))).status).toBe(201);
    });

    it('H24: la categoría se recorta, no puede ser solo espacios ni pasar de 40 caracteres', async () => {
      await rechaza({ categoria: '     ' });
      await rechaza({ categoria: 'C'.repeat(41) });
      const d = await registerOwner('cat');
      const r = await crear(d.token, valido({ categoria: '  Barba  ' }));
      expect(r.body.service.categoria).toBe('Barba');
    });

    it('H25 [media]: el precio es un número entero de pesos y tiene un máximo (10.000.000); nada de 500', async () => {
      for (const precio of [30000.5, 0.4, 10000001, 1e12, 3e9, 1e21]) await rechaza({ precio });
      const d = await registerOwner('tope');
      expect((await crear(d.token, valido({ precio: 10000000 }))).status).toBe(201);
    });

    it('H25b [media]: un precio infinito (1e400 en el JSON) da 400, no 500', async () => {
      const d = await registerOwner('inf');
      const r = await api().post('/api/v1/services').set(auth(d.token)).set('Content-Type', 'application/json')
        .send('{"nombre":"X","categoria":"Cortes","precio":1e400,"duracion":30}');
      expect(r.status).toBe(400);
    });

    it('H26 [media]: la duración tiene un máximo de 600 minutos (la jornada de 10 h); nada de 500', async () => {
      for (const duracion of [601, 100000, 3e9]) await rechaza({ duracion });
      const d = await registerOwner('dur');
      expect((await crear(d.token, valido({ duracion: 600 }))).status).toBe(201);
    });

    it('H27: editar aplica los mismos límites y recortes que crear', async () => {
      const d = await registerOwner('editLim');
      const sv = await createService(d.token, valido());
      for (const body of [{ nombre: '   ' }, { nombre: 'A'.repeat(81) }, { categoria: ' ' }, { precio: 1.5 }, { precio: 1e12 }, { duracion: 601 }, { duracion: 3e9 }]) {
        const r = await editar(d.token, sv.id, body);
        expect(r.status, JSON.stringify(body)).toBe(400);
      }
      const r = await editar(d.token, sv.id, { nombre: '  Con espacios  ', categoria: ' Barba ' });
      expect(r.body.service).toMatchObject({ nombre: 'Con espacios', categoria: 'Barba' });
    });

    it('H28: dos servicios activos no pueden llamarse igual (sin distinguir mayúsculas ni espacios); uno eliminado libera el nombre', async () => {
      const d = await registerOwner('dup');
      const a = await crear(d.token, valido({ nombre: 'Corte clásico' }));
      expect(a.status).toBe(201);
      for (const nombre of ['Corte clásico', 'corte clásico', '  Corte clásico  ']) {
        const r = await crear(d.token, valido({ nombre }));
        expect(r.status, nombre).toBe(409);
        expect(r.body.code).toBe('DUPLICATE_NAME');
        expect(r.body.error).toMatch(/ya existe/i);
      }
      const otro = await crear(d.token, valido({ nombre: 'Otro corte' }));
      const choque = await editar(d.token, otro.body.service.id, { nombre: 'corte clásico' });
      expect(choque.status).toBe(409);
      expect((await editar(d.token, a.body.service.id, { nombre: 'Corte clásico', precio: 31000 })).status).toBe(200); // su propio nombre no choca
      await borrar(d.token, a.body.service.id);
      expect((await crear(d.token, valido({ nombre: 'Corte clásico' }))).status).toBe(201);
      expect((await listar(d.token)).body.services).toHaveLength(2);
    });

    it('H28b: negocios distintos sí pueden tener servicios con el mismo nombre', async () => {
      const a = await registerOwner('mismoA');
      const b = await registerOwner('mismoB');
      expect((await crear(a.token, valido({ nombre: 'Barba' }))).status).toBe(201);
      expect((await crear(b.token, valido({ nombre: 'Barba' }))).status).toBe(201);
    });

    it('H28c: 6 altas simultáneas con el mismo nombre dejan una sola', async () => {
      const d = await registerOwner('dupRace');
      const rs = await Promise.all(Array.from({ length: 6 }, () => crear(d.token, valido({ nombre: 'Gemelo' }))));
      expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
      expect(rs.filter((r) => r.status >= 500)).toHaveLength(0);
      expect((await listar(d.token)).body.services).toHaveLength(1);
    });
  });

  describe('editar', () => {
    it('cambia solo un campo y deja los demás igual', async () => {
      const d = await registerOwner('parcial');
      const sv = await createService(d.token, valido());
      for (const cambio of [{ nombre: 'Nuevo nombre' }, { categoria: 'Barba' }, { precio: 41000 }, { duracion: 20 }]) {
        const r = await editar(d.token, sv.id, cambio);
        expect(r.status).toBe(200);
        Object.assign(sv, cambio);
        expect(r.body.service).toEqual(sv);
      }
      expect((await listar(d.token)).body.services).toEqual([sv]);
    });

    it('un cuerpo vacío no cambia nada y responde 200', async () => {
      const d = await registerOwner('vacio');
      const sv = await createService(d.token, valido());
      const r = await editar(d.token, sv.id, {});
      expect(r.status).toBe(200);
      expect(r.body.service).toEqual(sv);
    });

    it('ignora id, veces, isActive y businessId', async () => {
      const a = await registerOwner('editA');
      const b = await registerOwner('editB');
      const sv = await createService(a.token, valido());
      const r = await editar(a.token, sv.id, { veces: 77, isActive: false, businessId: b.business.id, id: 'otro', precio: 31000 });
      expect(r.status).toBe(200);
      expect(r.body.service).toMatchObject({ id: sv.id, veces: 0, precio: 31000 });
      expect((await listar(a.token)).body.services).toHaveLength(1);
      expect((await prisma.service.findUnique({ where: { id: sv.id } })).businessId).toBe(a.business.id);
    });

    it('aplica las mismas validaciones que al crear', async () => {
      const d = await registerOwner('editInv');
      const sv = await createService(d.token, valido());
      for (const body of [{ nombre: '' }, { categoria: '' }, { precio: -1 }, { precio: '5' }, { duracion: 0 }, { duracion: 1.5 }, { nombre: 5 }]) {
        const r = await editar(d.token, sv.id, body);
        expect(r.status, JSON.stringify(body)).toBe(400);
        expect(r.body.error).not.toMatch(SIN_INGLES);
      }
      expect((await listar(d.token)).body.services).toEqual([sv]);
    });

    it('un servicio inexistente, con id raro o de otro negocio da 404 y no se modifica', async () => {
      const a = await registerOwner('ajenoA');
      const b = await registerOwner('ajenoB');
      const sv = await createService(a.token, valido());
      for (const id of ['00000000-0000-0000-0000-000000000000', 'no-es-uuid', '%00', 'x'.repeat(300)]) {
        expect((await editar(a.token, encodeURIComponent(id), { precio: 1 })).status, id).toBe(404);
      }
      expect((await editar(b.token, sv.id, { precio: 1 })).status).toBe(404);
      expect((await listar(a.token)).body.services[0].precio).toBe(30000);
    });

    it('dos ediciones simultáneas de campos distintos se aplican las dos', async () => {
      const d = await registerOwner('simul');
      const sv = await createService(d.token, valido());
      const [x, y] = await Promise.all([editar(d.token, sv.id, { precio: 50000 }), editar(d.token, sv.id, { duracion: 25 })]);
      expect([x.status, y.status]).toEqual([200, 200]);
      expect((await listar(d.token)).body.services[0]).toMatchObject({ precio: 50000, duracion: 25 });
    });

    it('el precio nuevo no reescribe el historial: lo ya cobrado conserva su monto y lo pendiente se cobra al precio vigente', async () => {
      const d = await registerOwner('precio');
      const barbero = await createEmployee(d.token, 'Barbero Precio');
      const sv = await createService(d.token, valido({ precio: 30000, duracion: 30 }));
      const hecha = (await createAppointment(d.token, { serviceId: sv.id, employeeId: barbero.id, date: bizDay(1), time: '09:00', clientName: 'Ana' })).body.appointment;
      const pendiente = (await createAppointment(d.token, { serviceId: sv.id, employeeId: barbero.id, date: bizDay(1), time: '11:00', clientName: 'Luis' })).body.appointment;
      await api().patch(`/api/v1/appointments/${hecha.id}`).set(auth(d.token)).send({ status: 'completed' });
      await editar(d.token, sv.id, { precio: 40000 });
      await api().patch(`/api/v1/appointments/${pendiente.id}`).set(auth(d.token)).send({ status: 'completed' });
      const montos = (await prisma.serviceTransaction.findMany({ where: { serviceId: sv.id }, orderBy: { completedAt: 'asc' } })).map((t) => t.amountCents);
      expect(montos).toEqual([3000000, 4000000]);
    });
  });

  describe('eliminar (baja lógica)', () => {
    it('200 { ok: true }, deja de aparecer, pero la fila y su historial se conservan', async () => {
      const d = await registerOwner('baja');
      const barbero = await createEmployee(d.token, 'Barbero Baja');
      const sv = await createService(d.token, valido());
      const cita = (await createAppointment(d.token, { serviceId: sv.id, employeeId: barbero.id, date: bizDay(1), time: '10:00' })).body.appointment;
      await api().patch(`/api/v1/appointments/${cita.id}`).set(auth(d.token)).send({ status: 'completed' });
      const r = await borrar(d.token, sv.id);
      expect(r.status).toBe(200);
      expect(r.body.ok).toBe(true);
      expect((await listar(d.token)).body.services).toEqual([]);
      const fila = await prisma.service.findUnique({ where: { id: sv.id } });
      expect(fila).toMatchObject({ isActive: false, timesPerformed: 1 });
      expect(await prisma.serviceTransaction.count({ where: { serviceId: sv.id } })).toBe(1);
      const citas = await api().get(`/api/v1/appointments?date=${bizDay(1)}`).set(auth(d.token));
      expect(citas.body.appointments[0].servicio).toBe('Corte de prueba');
    });

    it('no se puede agendar una cita nueva con un servicio eliminado (404), pero las ya agendadas se pueden finalizar', async () => {
      const d = await registerOwner('agenda');
      const barbero = await createEmployee(d.token, 'Barbero Agenda');
      const sv = await createService(d.token, valido({ duracion: 30 }));
      const previa = (await createAppointment(d.token, { serviceId: sv.id, employeeId: barbero.id, date: bizDay(1), time: '10:00' })).body.appointment;
      await borrar(d.token, sv.id);
      const nueva = await createAppointment(d.token, { serviceId: sv.id, employeeId: barbero.id, date: bizDay(1), time: '12:00' });
      expect(nueva.status).toBe(404);
      const fin = await api().patch(`/api/v1/appointments/${previa.id}`).set(auth(d.token)).send({ status: 'completed' });
      expect(fin.status).toBe(200);
    });

    it('otro negocio, un id inexistente o uno raro dan 404', async () => {
      const a = await registerOwner('delA');
      const b = await registerOwner('delB');
      const sv = await createService(a.token, valido());
      expect((await borrar(b.token, sv.id)).status).toBe(404);
      expect((await borrar(a.token, '00000000-0000-0000-0000-000000000000')).status).toBe(404);
      expect((await borrar(a.token, 'no-es-uuid')).status).toBe(404);
      expect((await listar(a.token)).body.services).toHaveLength(1);
    });
  });

  describe('servicio eliminado y citas pendientes', () => {
    it('H29: editar o volver a eliminar un servicio ya eliminado da 404 (no existe en el catálogo)', async () => {
      const d = await registerOwner('fantasma');
      const sv = await createService(d.token, valido());
      await borrar(d.token, sv.id);
      expect((await editar(d.token, sv.id, { precio: 99999 })).status).toBe(404);
      expect((await borrar(d.token, sv.id)).status).toBe(404);
      expect((await prisma.service.findUnique({ where: { id: sv.id } })).priceCents).toBe(3000000);
    });

    it('H30: al eliminar, la respuesta indica cuántas citas futuras sin finalizar le quedan (pendingAppointments)', async () => {
      const d = await registerOwner('aviso');
      const barbero = await createEmployee(d.token, 'Barbero Aviso');
      const sv = await createService(d.token, valido({ duracion: 30 }));
      const sinCitas = await createService(d.token, valido({ nombre: 'Sin citas' }));
      const ids = [];
      for (const [dia, hora] of [[1, '09:00'], [1, '10:00'], [2, '09:00'], [2, '10:00']]) {
        ids.push((await createAppointment(d.token, { serviceId: sv.id, employeeId: barbero.id, date: bizDay(dia), time: hora })).body.appointment.id);
      }
      await api().patch(`/api/v1/appointments/${ids[0]}`).set(auth(d.token)).send({ status: 'completed' });
      await api().patch(`/api/v1/appointments/${ids[1]}`).set(auth(d.token)).send({ status: 'cancelled' });
      await api().patch(`/api/v1/appointments/${ids[2]}`).set(auth(d.token)).send({ status: 'confirmed' });
      const r = await borrar(d.token, sv.id);
      expect(r.body).toEqual({ ok: true, pendingAppointments: 2 }); // la confirmada y la pendiente; no la finalizada ni la cancelada
      expect((await borrar(d.token, sinCitas.id)).body).toEqual({ ok: true, pendingAppointments: 0 });
    });

    it('H31: cambiar la duración avisa de los cruces de horario que provoca en citas futuras (scheduleConflicts)', async () => {
      const d = await registerOwner('solape');
      const barbero = await createEmployee(d.token, 'Barbero Solape');
      const sv = await createService(d.token, valido({ duracion: 30 }));
      await createAppointment(d.token, { serviceId: sv.id, employeeId: barbero.id, date: bizDay(1), time: '10:00' });
      await createAppointment(d.token, { serviceId: sv.id, employeeId: barbero.id, date: bizDay(1), time: '10:30' });
      await createAppointment(d.token, { serviceId: sv.id, employeeId: barbero.id, date: bizDay(1), time: '14:00' });
      const sinProblema = await editar(d.token, sv.id, { duracion: 30, precio: 31000 });
      expect(sinProblema.body.scheduleConflicts).toBe(0);
      const r = await editar(d.token, sv.id, { duracion: 60 });
      expect(r.status).toBe(200);
      expect(r.body.service.duracion).toBe(60);
      expect(r.body.scheduleConflicts).toBe(1); // la de 10:00 ahora termina a las 11:00 y pisa la de 10:30
    });
  });

  describe('`veces` (servicios realizados)', () => {
    const montar = async (label) => {
      const d = await registerOwner(label);
      const barbero = await createEmployee(d.token, `Barbero ${label}`);
      const sv = await createService(d.token, valido({ duracion: 30 }));
      const cita = async (time) => (await createAppointment(d.token, { serviceId: sv.id, employeeId: barbero.id, date: bizDay(1), time })).body.appointment;
      const estado = (id, body) => api().patch(`/api/v1/appointments/${id}`).set(auth(d.token)).send(body);
      const veces = async () => (await listar(d.token)).body.services[0].veces;
      return { d, sv, cita, estado, veces };
    };

    it('sube 1 al finalizar una cita y no cambia al crearla, confirmarla ni cancelarla', async () => {
      const { sv, cita, estado, veces } = await montar('veces');
      const a = await cita('09:00');
      const b = await cita('10:00');
      expect(await veces()).toBe(0);
      await estado(a.id, { status: 'confirmed' });
      await estado(b.id, { status: 'cancelled' });
      expect(await veces()).toBe(0);
      expect((await estado(a.id, { status: 'completed', paymentMethod: 'card' })).status).toBe(200);
      expect(await veces()).toBe(1);
      expect(sv.veces).toBe(0);
    });

    it('finalizar dos veces la misma cita cuenta una sola vez', async () => {
      const { cita, estado, veces } = await montar('doble');
      const a = await cita('09:00');
      await estado(a.id, { status: 'completed' });
      await estado(a.id, { status: 'completed' });
      expect(await veces()).toBe(1);
    });

    it('finalizar varias citas del mismo servicio las suma', async () => {
      const { cita, estado, veces } = await montar('suma');
      for (const hora of ['09:00', '10:00', '11:00']) await estado((await cita(hora)).id, { status: 'completed' });
      expect(await veces()).toBe(3);
    });

    it('si dos personas finalizan la misma cita a la vez, ninguna recibe 500 y se cuenta una sola vez', async () => {
      const { d, sv, cita, estado, veces } = await montar('carrera');
      const a = await cita('09:00');
      const rs = await Promise.all([estado(a.id, { status: 'completed' }), estado(a.id, { status: 'completed' }), estado(a.id, { status: 'completed' })]);
      expect(rs.map((r) => r.status).filter((x) => x >= 500), JSON.stringify(rs.map((r) => r.body))).toEqual([]);
      expect(await veces()).toBe(1);
      expect(await prisma.serviceTransaction.count({ where: { serviceId: sv.id, businessId: d.business.id } })).toBe(1);
    });
  });

  describe('permisos y aislamiento', () => {
    it('matriz de roles: dueño escribe; barbero solo lee (403); master 403; sin sesión 401', async () => {
      const d = await registerOwner('matriz');
      const barbero = await createEmployee(d.token, 'Barbero Matriz');
      const sv = await createService(d.token, valido());
      const m = s.master;
      expect((await listar(barbero.token)).status).toBe(200);
      expect((await crear(barbero.token, valido())).status).toBe(403);
      expect((await editar(barbero.token, sv.id, { precio: 1 })).status).toBe(403);
      expect((await borrar(barbero.token, sv.id)).status).toBe(403);
      for (const f of [() => crear(m, valido()), () => editar(m, sv.id, { precio: 1 }), () => borrar(m, sv.id)]) {
        const r = await f();
        expect(r.status).toBe(403);
      }
      expect((await api().post('/api/v1/services').send(valido())).status).toBe(401);
      expect((await api().patch(`/api/v1/services/${sv.id}`).send({ precio: 1 })).status).toBe(401);
      expect((await api().delete(`/api/v1/services/${sv.id}`)).status).toBe(401);
      expect((await listar(d.token)).body.services).toEqual([sv]);
    });

    it('el token de La Navaja no puede tocar los servicios de El Fade', async () => {
      const ajenos = (await listar(s.fade.owner)).body.services;
      expect(ajenos.length).toBeGreaterThan(0);
      for (const sv of ajenos) {
        expect((await editar(s.navaja.owner, sv.id, { precio: 1 })).status).toBe(404);
        expect((await borrar(s.navaja.owner, sv.id)).status).toBe(404);
      }
      expect((await listar(s.fade.owner)).body.services).toEqual(ajenos);
    });
  });
});
