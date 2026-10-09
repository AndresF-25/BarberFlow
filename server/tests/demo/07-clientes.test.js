/**
 * Módulo 7 — Clientes (GET /clients, GET /clients/:id, PATCH /clients/:id) y el alta automática de fichas.
 * Lee las tres barberías demo en solo lectura; lo que crea o modifica usa negocios @test.local nuevos.
 * Valores esperados calculados desde el dataset (no escritos a mano).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  api, auth, prisma, registerOwner, createEmployee, createService, createAppointment,
  requireSeed, demoSessions, bizDay, biz, hoy, summaries, uniqueEmail,
} from './helpers-demo.js';
import { enrichClients } from '../../src/services/clientService.js';
import { addDays } from '../../src/lib/utils.js';

const listar = (token, query = '') => api().get(`/api/v1/clients${query}`).set(auth(token));
const detalle = (token, id) => api().get(`/api/v1/clients/${id}`).set(auth(token));
const editar = (token, id, body) => api().patch(`/api/v1/clients/${id}`).set(auth(token)).send(body);
const CLAVES = ['etiqueta', 'favorito', 'frecuencia', 'gasto', 'id', 'nombre', 'notas', 'telefono', 'ultima', 'ultimoServicio', 'visitas'];
const SIN_INGLES = /Required|Expected|Invalid|must contain|String must|Number must/i;
const diasEntre = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

// --- valores esperados desde el dataset -------------------------------------------------------------
function esperados(key) {
  const b = biz(key);
  const nombreDe = Object.fromEntries(b.services.map((s) => [s.key, s.nombre]));
  const fin = b.appointments.filter((a) => a.status === 'completed');
  const precio = Object.fromEntries(b.services.map((s) => [s.key, s.precio]));
  return b.clients.map((c) => {
    const citas = fin.filter((a) => a.client === c.key);
    const ventas = b.sales.filter((v) => v.client === c.key);
    const eventos = [
      ...citas.map((a) => ({ date: a.date, time: a.time, servicio: nombreDe[a.service] })),
      ...ventas.map((v) => ({ date: v.date, time: '13:00', servicio: null })),
    ];
    const servicios = eventos.filter((e) => e.servicio).sort((x, y) => `${y.date} ${y.time}`.localeCompare(`${x.date} ${x.time}`));
    const cuenta = {};
    servicios.forEach((e) => { cuenta[e.servicio] = (cuenta[e.servicio] || 0) + 1; });
    const max = Math.max(0, ...Object.values(cuenta));
    const favorito = servicios.find((e) => cuenta[e.servicio] === max)?.servicio || '—'; // empate: el más reciente
    const dias = [...new Set(eventos.map((e) => e.date))].sort();
    let frecuencia = '—';
    if (dias.length >= 2) {
      const prom = diasEntre(dias[0], dias[dias.length - 1]) / (dias.length - 1);
      frecuencia = prom < 21 ? `Cada ${Math.max(1, Math.round(prom))} ${Math.max(1, Math.round(prom)) === 1 ? 'día' : 'días'}` : `Cada ${Math.round(prom / 7)} semanas`;
    }
    const ultima = dias.length ? dias[dias.length - 1] : '—';
    const visitas = eventos.length;
    const total = citas.reduce((n, a) => n + precio[a.service], 0) + ventas.reduce((n, v) => n + v.qty * b.products.find((p) => p.key === v.product).precioVenta, 0);
    let etiqueta = visitas >= 15 ? 'VIP' : visitas >= 2 ? 'Frecuente' : 'Nuevo';
    if (visitas >= 1 && diasEntre(ultima, hoy) > 35) etiqueta = 'Inactivo';
    return {
      key: c.key, nombre: c.name, telefono: c.phone || '—', visitas, ultima, etiqueta, favorito, frecuencia,
      ultimoServicio: servicios[0]?.servicio || '—', gasto: visitas ? Math.round(total / visitas) : 0, eventos, citas, ventas,
    };
  });
}

describe('Módulo 7 · clientes', () => {
  let s;
  let navaja;
  beforeAll(async () => { await requireSeed(); s = await demoSessions(); navaja = esperados('navaja'); });

  describe('lista de los datos demo (solo lectura)', () => {
    it('La Navaja: lista a todos sus clientes con la forma exacta', async () => {
      const r = await listar(s.navaja.owner);
      expect(r.status).toBe(200);
      expect(Object.keys(r.body)).toEqual(['clients']);
      expect(r.body.clients).toHaveLength(biz('navaja').clients.length);
      for (const c of r.body.clients) expect(Object.keys(c).sort()).toEqual(CLAVES);
      expect(JSON.stringify(r.body)).not.toMatch(/businessId|createdAt|updatedAt/);
    });

    it('cada cliente coincide con el dataset: visitas, gasto promedio, última visita, etiqueta y teléfono', async () => {
      const lista = (await listar(s.navaja.owner)).body.clients;
      for (const e of navaja) {
        const c = lista.find((x) => x.nombre === e.nombre);
        expect(c, e.nombre).toBeTruthy();
        expect(c, e.nombre).toMatchObject({ visitas: e.visitas, gasto: e.gasto, ultima: e.ultima, etiqueta: e.etiqueta, telefono: e.telefono });
      }
      expect(summaries.navaja.visitsByClient).toBeTruthy();
    });

    it('las etiquetas de diseño del dataset se cumplen (VIP, Frecuente, Nuevo, Inactivo y VIP inactivo)', async () => {
      const lista = (await listar(s.navaja.owner)).body.clients;
      for (const def of biz('navaja').clients.filter((c) => c.expect)) {
        const c = lista.find((x) => x.nombre === def.name);
        expect(c, def.name).toMatchObject({ etiqueta: def.expect.etiqueta, visitas: def.expect.visitas });
      }
      expect(new Set(lista.map((c) => c.etiqueta))).toEqual(new Set(['Nuevo', 'Frecuente', 'VIP', 'Inactivo']));
    });

    it('H42: «último servicio» es el más reciente y «favorito» el más frecuente (empate: el más reciente); los productos no cuentan como servicio', async () => {
      const lista = (await listar(s.navaja.owner)).body.clients;
      for (const e of navaja) {
        const c = lista.find((x) => x.nombre === e.nombre);
        expect(c.ultimoServicio, `último de ${e.nombre}`).toBe(e.ultimoServicio);
        expect(c.favorito, `favorito de ${e.nombre}`).toBe(e.favorito);
      }
      const dist = lista.filter((c) => c.ultimoServicio !== c.favorito);
      expect(dist.length).toBeGreaterThan(0); // el dataset tiene clientes donde son distintos
    });

    it('H43: «frecuencia» es cada cuánto vuelve (promedio entre visitas), no hace cuánto vino; con menos de 2 días de visita es «—»', async () => {
      const lista = (await listar(s.navaja.owner)).body.clients;
      for (const e of navaja) expect(lista.find((x) => x.nombre === e.nombre).frecuencia, e.nombre).toBe(e.frecuencia);
      expect(lista.find((x) => x.nombre === 'Sebastián Rojas').frecuencia).toBe('Cada 10 días');
      expect(lista.find((x) => x.nombre === 'Pablo Duarte').frecuencia).toBe('—');
    });

    it('un cliente sin visitas (Pablo) trae 0 visitas, gasto 0 y «—» donde no hay dato', async () => {
      const pablo = (await listar(s.navaja.owner)).body.clients.find((c) => c.nombre === 'Pablo Duarte');
      expect(pablo).toMatchObject({ visitas: 0, gasto: 0, etiqueta: 'Nuevo', ultima: '—', favorito: '—', ultimoServicio: '—', frecuencia: '—', notas: '' });
    });

    it('H44: ordenada por la visita más reciente (los sin visitas al final, empates por nombre)', async () => {
      const lista = (await listar(s.navaja.owner)).body.clients;
      const clave = (c) => (c.ultima === '—' ? '' : c.ultima);
      for (let i = 0; i < lista.length - 1; i += 1) {
        const [a, b] = [lista[i], lista[i + 1]];
        if (clave(a) !== clave(b)) expect(clave(a) > clave(b), `${a.nombre} antes de ${b.nombre}`).toBe(true);
        else expect(a.nombre.localeCompare(b.nombre, 'es') <= 0, `${a.nombre} / ${b.nombre}`).toBe(true);
      }
    });

    it('?tag filtra por etiqueta; Todos no filtra; una etiqueta que no existe da 400 en español', async () => {
      const todos = (await listar(s.navaja.owner)).body.clients;
      for (const tag of ['Nuevo', 'Frecuente', 'VIP', 'Inactivo']) {
        const r = await listar(s.navaja.owner, `?tag=${tag}`);
        expect(r.status).toBe(200);
        expect(r.body.clients.map((c) => c.id).sort()).toEqual(todos.filter((c) => c.etiqueta === tag).map((c) => c.id).sort());
      }
      expect((await listar(s.navaja.owner, '?tag=Todos')).body.clients).toHaveLength(todos.length);
      for (const tag of ['Inventado', 'vip', 'VIP%20']) {
        const r = await listar(s.navaja.owner, `?tag=${tag}`);
        expect(r.status, tag).toBe(400);
        expect(r.body.code).toBe('VALIDATION_ERROR');
        expect(r.body.error).not.toMatch(SIN_INGLES);
      }
    });

    it('H45: la búsqueda no distingue mayúsculas ni tildes (sebastian encuentra Sebastián)', async () => {
      for (const q of ['sebastián', 'sebastian', 'SEBASTIAN', 'Sebastián Rojas', 'rojas', 'seb']) {
        const r = await listar(s.navaja.owner, `?search=${encodeURIComponent(q)}`);
        expect(r.body.clients.map((c) => c.nombre), q).toContain('Sebastián Rojas');
      }
      expect((await listar(s.navaja.owner, `?search=${encodeURIComponent('nicolas')}`)).body.clients.map((c) => c.nombre)).toEqual(['Nicolás Vera']);
    });

    it('H45b: la búsqueda por teléfono ignora espacios, guiones, paréntesis y el +57', async () => {
      for (const q of ['3001110010', '300 111 0010', '300-111-0010', '(300) 111 0010', '+57 300 111 0010', '57 3001110010', '1110010']) {
        const r = await listar(s.navaja.owner, `?search=${encodeURIComponent(q)}`);
        expect(r.body.clients.map((c) => c.nombre), q).toContain('Sebastián Rojas');
      }
    });

    it('la búsqueda se combina con la etiqueta; sin resultados da lista vacía; solo espacios no filtra; % y _ son texto', async () => {
      const r = await listar(s.navaja.owner, '?search=a&tag=VIP');
      expect(r.body.clients.every((c) => c.etiqueta === 'VIP')).toBe(true);
      expect((await listar(s.navaja.owner, '?search=zzzzzz')).body).toEqual({ clients: [] });
      expect((await listar(s.navaja.owner, '?search=%20%20')).body.clients).toHaveLength(navaja.length);
      for (const q of ['%25', '_', '%25%25']) expect((await listar(s.navaja.owner, `?search=${q}`)).body.clients, q).toEqual([]);
      expect((await listar(s.navaja.owner, '?search=a&search=b')).status).toBe(200);
    });

    it('una búsqueda de más de 100 caracteres da 400 en español', async () => {
      const r = await listar(s.navaja.owner, `?search=${'a'.repeat(101)}`);
      expect(r.status).toBe(400);
      expect(r.body.error).not.toMatch(SIN_INGLES);
    });

    it('El Fade tiene sus propios clientes (un teléfono repetido con La Navaja sigue siendo otra ficha); Barbería Nueva, vacío', async () => {
      const [n, f] = await Promise.all([listar(s.navaja.owner), listar(s.fade.owner)]);
      const idsN = new Set(n.body.clients.map((c) => c.id));
      expect(f.body.clients).toHaveLength(biz('fade').clients.length);
      for (const c of f.body.clients) expect(idsN.has(c.id)).toBe(false);
      const tels = (r) => r.body.clients.map((c) => c.telefono).filter((t) => t !== '—');
      expect(tels(f).some((t) => tels(n).includes(t))).toBe(true);
      expect((await listar(s.nueva.owner)).body.clients).toEqual([]);
    });

    it('un barbero ve la misma lista que su dueño; el master 403 NO_BUSINESS; sin sesión 401', async () => {
      const [o, j] = await Promise.all([listar(s.navaja.owner), listar(s.navaja.julian)]);
      expect(j.status).toBe(200);
      expect(j.body).toEqual(o.body);
      const m = await listar(s.master);
      expect(m.status).toBe(403);
      expect(m.body.code).toBe('NO_BUSINESS');
      expect((await api().get('/api/v1/clients')).status).toBe(401);
    });
  });

  describe('detalle e historial (datos demo)', () => {
    const porNombre = async (nombre) => (await listar(s.navaja.owner)).body.clients.find((c) => c.nombre === nombre);

    it('la forma exacta: { client, historial }, y client es igual a la fila de la lista', async () => {
      const c = await porNombre('Carlos Gómez');
      const r = await detalle(s.navaja.owner, c.id);
      expect(r.status).toBe(200);
      expect(Object.keys(r.body).sort()).toEqual(['client', 'historial']);
      expect(r.body.client).toEqual(c);
      for (const h of r.body.historial) expect(Object.keys(h).sort()).toEqual(['barbero', 'fecha', 'servicio', 'tipo', 'valor']);
    });

    it('el historial tiene un renglón por cada servicio finalizado y cada compra, con los valores y fechas del dataset', async () => {
      for (const nombre of ['Carlos Gómez', 'Sebastián Rojas', 'Felipe Salas', 'Tomás León']) {
        const e = navaja.find((x) => x.nombre === nombre);
        const c = await porNombre(nombre);
        const h = (await detalle(s.navaja.owner, c.id)).body.historial;
        expect(h, nombre).toHaveLength(e.eventos.length);
        expect(h.filter((x) => x.tipo === 'servicio').map((x) => x.fecha).sort(), nombre).toEqual(e.citas.map((a) => a.date).sort());
        expect(h.reduce((n, x) => n + x.valor, 0), nombre).toBe(Math.round((e.gasto * e.visitas)));
      }
    });

    it('el historial va del más reciente al más antiguo y la primera fecha = «última visita»', async () => {
      const c = await porNombre('Sebastián Rojas');
      const h = (await detalle(s.navaja.owner, c.id)).body.historial;
      const fechas = h.map((x) => x.fecha);
      expect(fechas).toEqual([...fechas].sort().reverse());
      expect(fechas[0]).toBe(c.ultima);
    });

    it('un cliente con solo una compra de producto tiene un renglón de tipo «producto» y barbero «—»', async () => {
      const soloProducto = navaja.find((e) => e.citas.length === 0 && e.ventas.length > 0);
      expect(soloProducto, 'el dataset debe tener un cliente que solo compró un producto').toBeTruthy();
      const c = await porNombre(soloProducto.nombre);
      const h = (await detalle(s.navaja.owner, c.id)).body.historial;
      expect(h.every((x) => x.tipo === 'producto' && x.barbero === '—')).toBe(true);
    });

    it('un cliente sin visitas trae historial vacío', async () => {
      const pablo = await porNombre('Pablo Duarte');
      expect((await detalle(s.navaja.owner, pablo.id)).body.historial).toEqual([]);
    });

    it('un id inexistente, raro o de otro negocio da 404; el master 403; sin sesión 401', async () => {
      const ajeno = (await listar(s.fade.owner)).body.clients[0];
      for (const id of ['00000000-0000-0000-0000-000000000000', 'no-es-uuid', '%00', 'x'.repeat(300)]) {
        expect((await detalle(s.navaja.owner, encodeURIComponent(id))).status, id).toBe(404);
      }
      expect((await detalle(s.navaja.owner, ajeno.id)).status).toBe(404);
      expect((await detalle(s.master, ajeno.id)).status).toBe(403);
      expect((await api().get(`/api/v1/clients/${ajeno.id}`)).status).toBe(401);
    });

    it('un barbero puede abrir el detalle', async () => {
      const c = await porNombre('Carlos Gómez');
      expect((await detalle(s.navaja.julian, c.id)).status).toBe(200);
    });
  });

  describe('etiquetas y fechas con el día del negocio (zona horaria de Bogotá)', () => {
    const montar = async (label) => {
      const d = await registerOwner(label);
      const barbero = await createEmployee(d.token, `Barbero ${label}`);
      const servicio = await createService(d.token, { nombre: 'Corte', precio: 30000, duracion: 30 });
      const cliente = await prisma.client.create({ data: { businessId: d.business.id, name: `Cliente ${label}`, phone: '' } });
      const visita = async (fecha, hora = '10:00') => {
        const cita = await prisma.appointment.create({
          data: {
            businessId: d.business.id, clientId: cliente.id, serviceId: servicio.id, employeeId: barbero.id, appointmentDate: new Date(`${fecha}T00:00:00.000Z`),
            startTime: hora, status: 'completed', clientName: cliente.name, clientPhone: '',
          },
        });
        await prisma.serviceTransaction.create({
          data: { businessId: d.business.id, appointmentId: cita.id, serviceId: servicio.id, clientId: cliente.id, employeeId: barbero.id, amountCents: 3000000, paymentMethod: 'cash', completedAt: new Date(`${fecha}T17:00:00.000Z`) },
        });
      };
      const etiqueta = async (today) => (await enrichClients(d.business.id, [cliente], { today }))[0].etiqueta;
      return { d, cliente, visita, etiqueta };
    };

    it('H46: una sola visita de hace más de 35 días es «Inactivo», no «Nuevo» para siempre; hasta 35 días sigue «Nuevo»', async () => {
      const { visita, etiqueta } = await montar('una');
      await visita('2026-06-10');
      expect(await etiqueta('2026-07-15')).toBe('Nuevo'); // 35 días
      expect(await etiqueta('2026-07-16')).toBe('Inactivo'); // 36 días
      expect(await etiqueta('2026-10-08')).toBe('Inactivo');
    });

    it('con 2 o más visitas: 35 días exactos sigue «Frecuente» y 36 es «Inactivo»', async () => {
      const { visita, etiqueta } = await montar('dos');
      await visita('2026-05-01');
      await visita('2026-06-10');
      expect(await etiqueta('2026-07-15')).toBe('Frecuente');
      expect(await etiqueta('2026-07-16')).toBe('Inactivo');
    });

    it('un cliente sin visitas es «Nuevo» aunque la ficha sea vieja', async () => {
      const { etiqueta } = await montar('cero');
      expect(await etiqueta('2027-12-31')).toBe('Nuevo');
    });

    it('VIP: 14 visitas es «Frecuente» y 15 es «VIP»; un VIP que lleva más de 35 días sin venir es «Inactivo»', async () => {
      const { visita, etiqueta } = await montar('vip');
      for (let i = 0; i < 14; i += 1) await visita(addDays('2026-08-01', i));
      expect(await etiqueta('2026-08-20')).toBe('Frecuente');
      await visita('2026-08-15');
      expect(await etiqueta('2026-08-20')).toBe('VIP');
      expect(await etiqueta('2026-09-25')).toBe('Inactivo'); // 41 días después de la última (14 ago)...
    });

    it('H47: los días sin venir se cuentan por fecha del negocio, no por horas desde UTC (la visita de la noche no se adelanta un día)', async () => {
      const { d, cliente, etiqueta } = await montar('tz');
      // 9:30 p. m. en Bogotá del 10 de junio = 02:30 UTC del 11 de junio
      const user = await prisma.user.findFirst({ where: { businessId: d.business.id } });
      const venta = async (instante) => {
        const producto = await prisma.product.create({ data: { businessId: d.business.id, name: `Gel ${instante}`, category: 'Styling', stock: 5, stockMin: 1, unit: 'unidad', salePriceCents: 1000000 } });
        await prisma.productSale.create({ data: { businessId: d.business.id, productId: producto.id, clientId: cliente.id, clientName: cliente.name, quantity: 1, unitPriceCents: 1000000, totalCents: 1000000, soldAt: new Date(instante), soldById: user.id } });
      };
      await venta('2026-05-01T17:00:00.000Z');
      await venta('2026-06-11T02:30:00.000Z'); // el 10 de junio por la noche, hora de Bogotá
      const lista = (await enrichClients(d.business.id, [cliente], { today: '2026-07-15' }))[0];
      expect(lista.ultima).toBe('2026-06-10'); // no el 11
      expect(lista.etiqueta).toBe('Frecuente'); // 35 días exactos
      expect(await etiqueta('2026-07-16')).toBe('Inactivo');
    });

    it('H47b: el historial usa la fecha del negocio también para ventas y cobros de la noche', async () => {
      const { d, cliente } = await montar('tzh');
      const user = await prisma.user.findFirst({ where: { businessId: d.business.id } });
      const producto = await prisma.product.create({ data: { businessId: d.business.id, name: 'Cera', category: 'Styling', stock: 5, stockMin: 1, unit: 'unidad', salePriceCents: 1000000 } });
      await prisma.productSale.create({ data: { businessId: d.business.id, productId: producto.id, clientId: cliente.id, clientName: cliente.name, quantity: 1, unitPriceCents: 1000000, totalCents: 1000000, soldAt: new Date('2026-06-11T02:30:00.000Z'), soldById: user.id } });
      const r = await detalle(d.token, cliente.id);
      expect(r.body.historial[0]).toMatchObject({ tipo: 'producto', fecha: '2026-06-10' });
    });
  });

  describe('alta automática: no duplicar ni mezclar personas', () => {
    const montar = async (label) => {
      const d = await registerOwner(label);
      const barbero = await createEmployee(d.token, `Barbero ${label}`);
      const servicio = await createService(d.token, { nombre: 'Corte', precio: 30000, duracion: 30 });
      let n = 0;
      const agendar = async (clientName, clientPhone = '') => {
        const hora = `${String(8 + Math.floor(n / 2)).padStart(2, '0')}:${n % 2 ? '30' : '00'}`;
        n += 1;
        const r = await createAppointment(d.token, { serviceId: servicio.id, employeeId: barbero.id, date: bizDay(2), time: hora, clientName, clientPhone });
        expect(r.status, JSON.stringify(r.body)).toBe(201);
        return r;
      };
      const clientes = async () => (await listar(d.token)).body.clients;
      return { d, agendar, clientes };
    };

    it('agendar crea la ficha con 0 visitas y la reconoce por teléfono o por nombre (sin distinguir mayúsculas)', async () => {
      const { agendar, clientes } = await montar('alta');
      await agendar('Laura Gómez', '3105556666');
      await agendar('LAURA GÓMEZ');
      await agendar('Otro Nombre', '3105556666');
      const lista = await clientes();
      expect(lista).toHaveLength(1);
      expect(lista[0]).toMatchObject({ nombre: 'Laura Gómez', telefono: '3105556666', visitas: 0, etiqueta: 'Nuevo' });
    });

    it('H48 [media]: el mismo teléfono escrito de otra forma es la misma persona (espacios, guiones, paréntesis, +57)', async () => {
      const { agendar, clientes } = await montar('formato');
      for (const tel of ['3005556666', '300 555 6666', '300-555-6666', '(300) 555 6666', '+57 300 555 6666', '57 300 555 6666']) await agendar('Marta Ríos', tel);
      expect(await clientes()).toHaveLength(1);
    });

    it('H48b [media]: dos personas con el mismo nombre y teléfonos distintos son dos fichas (no se mezclan)', async () => {
      const { agendar, clientes } = await montar('homonimos');
      await agendar('Juan Pérez', '3009990001');
      await agendar('Juan Pérez', '3009990002');
      const lista = await clientes();
      expect(lista).toHaveLength(2);
      expect(lista.map((c) => c.telefono).sort()).toEqual(['3009990001', '3009990002']);
    });

    it('H48c: una ficha sin teléfono recibe el teléfono cuando llega la cita con el mismo nombre, y después se reconoce por él', async () => {
      const { agendar, clientes } = await montar('completa');
      await agendar('Pedro Ruiz');
      await agendar('Pedro Ruiz', '3207778888');
      let lista = await clientes();
      expect(lista).toHaveLength(1);
      expect(lista[0].telefono).toBe('3207778888');
      await agendar('P. Ruiz', '320 777 8888');
      lista = await clientes();
      expect(lista).toHaveLength(1);
    });

    it('H48d: espacios de más y mayúsculas distintas en el nombre no crean otra ficha', async () => {
      const { agendar, clientes } = await montar('espacios');
      await agendar('Juan Pérez');
      await agendar('  juan    pérez  ');
      const lista = await clientes();
      expect(lista).toHaveLength(1);
      expect(lista[0].nombre).toBe('Juan Pérez');
    });

    it('H49 [media]: 8 citas simultáneas del mismo cliente nuevo dejan una sola ficha', async () => {
      const d = await registerOwner('carrera');
      const servicio = await createService(d.token, { nombre: 'Corte', precio: 30000, duracion: 30 });
      const barberos = await Promise.all(Array.from({ length: 8 }, (_, i) => createEmployee(d.token, `Barbero ${i}`)));
      const rs = await Promise.all(barberos.map((b) => createAppointment(d.token, { serviceId: servicio.id, employeeId: b.id, date: bizDay(2), time: '10:00', clientName: 'Cliente Nuevo', clientPhone: '3001234567' })));
      expect(rs.filter((r) => r.status >= 500)).toHaveLength(0);
      expect(rs.map((r) => r.status)).toEqual(Array(8).fill(201));
      expect(await prisma.client.count({ where: { businessId: d.business.id } })).toBe(1);
    });
  });

  describe('editar una ficha (PATCH /clients/:id)', () => {
    const montar = async (label) => {
      const d = await registerOwner(label);
      const barbero = await createEmployee(d.token, `Barbero ${label}`);
      const servicio = await createService(d.token, { nombre: 'Corte', precio: 30000, duracion: 30 });
      await createAppointment(d.token, { serviceId: servicio.id, employeeId: barbero.id, date: bizDay(2), time: '10:00', clientName: 'Laura Gomez', clientPhone: '3105556666' });
      await createAppointment(d.token, { serviceId: servicio.id, employeeId: barbero.id, date: bizDay(2), time: '11:00', clientName: 'Pedro Ruiz', clientPhone: '3207778888' });
      const lista = (await listar(d.token)).body.clients;
      return { d, barbero, laura: lista.find((c) => c.nombre === 'Laura Gomez'), pedro: lista.find((c) => c.nombre === 'Pedro Ruiz') };
    };

    it('H50 [media]: el dueño corrige nombre, teléfono y notas; la lista y el detalle lo reflejan', async () => {
      const { d, laura } = await montar('edita');
      const r = await editar(d.token, laura.id, { name: 'Laura Gómez', phone: '310 555 7777', notes: 'Prefiere tijera. Alérgica al mentol.' });
      expect(r.status).toBe(200);
      expect(Object.keys(r.body)).toEqual(['client']);
      expect(r.body.client).toMatchObject({ id: laura.id, nombre: 'Laura Gómez', telefono: '310 555 7777', notas: 'Prefiere tijera. Alérgica al mentol.' });
      expect((await detalle(d.token, laura.id)).body.client).toEqual(r.body.client);
      expect((await listar(d.token, '?search=gómez')).body.clients.map((c) => c.id)).toEqual([laura.id]);
      expect((await listar(d.token, '?search=3105557777')).body.clients.map((c) => c.id)).toEqual([laura.id]);
    });

    it('cada campo se edita solo; un cuerpo vacío no cambia nada; borrar teléfono y notas con texto vacío', async () => {
      const { d, laura } = await montar('campos');
      expect((await editar(d.token, laura.id, { notes: 'Nota' })).body.client).toMatchObject({ nombre: 'Laura Gomez', telefono: '3105556666', notas: 'Nota' });
      expect((await editar(d.token, laura.id, { name: 'Laura G.' })).body.client).toMatchObject({ nombre: 'Laura G.', telefono: '3105556666', notas: 'Nota' });
      expect((await editar(d.token, laura.id, {})).body.client).toMatchObject({ nombre: 'Laura G.', telefono: '3105556666', notas: 'Nota' });
      expect((await editar(d.token, laura.id, { phone: '', notes: '' })).body.client).toMatchObject({ telefono: '—', notas: '' });
    });

    it('recorta espacios y junta los espacios repetidos del nombre', async () => {
      const { d, laura } = await montar('recorte');
      const r = await editar(d.token, laura.id, { name: '  Laura    Gómez  ', notes: '  nota  ', phone: ' 3105556666 ' });
      expect(r.body.client).toMatchObject({ nombre: 'Laura Gómez', notas: 'nota', telefono: '3105556666' });
    });

    it('rechaza nombre vacío o de solo espacios, de más de 80 caracteres, teléfono con letras, notas de más de 500 y tipos erróneos (400 en español)', async () => {
      const { d, laura } = await montar('inv');
      const casos = [{ name: '' }, { name: '   ' }, { name: 'A'.repeat(81) }, { name: 5 }, { name: null }, { phone: 'llámame' }, { phone: '123' }, { phone: '1'.repeat(21) }, { phone: 3105556666 },
        { notes: 'x'.repeat(501) }, { notes: 5 }];
      for (const body of casos) {
        const r = await editar(d.token, laura.id, body);
        expect(r.status, JSON.stringify(body)).toBe(400);
        expect(r.body.code).toBe('VALIDATION_ERROR');
        expect(r.body.error).not.toMatch(SIN_INGLES);
      }
      expect((await detalle(d.token, laura.id)).body.client).toMatchObject({ nombre: 'Laura Gomez', telefono: '3105556666' });
    });

    it('H51: no se puede dejar a dos clientes con el mismo teléfono (409 DUPLICATE_PHONE, también escrito distinto); el suyo propio sí', async () => {
      const { d, laura, pedro } = await montar('dupTel');
      for (const phone of ['3207778888', '320 777 8888', '+57 320 777 8888']) {
        const r = await editar(d.token, laura.id, { phone });
        expect(r.status, phone).toBe(409);
        expect(r.body.code).toBe('DUPLICATE_PHONE');
        expect(r.body.error).toMatch(/ya hay un cliente con ese teléfono/i);
      }
      expect((await editar(d.token, laura.id, { phone: '310 555 6666' })).status).toBe(200); // su propio número escrito distinto
      expect((await editar(d.token, pedro.id, { name: 'Pedro Ruiz Jr.' })).status).toBe(200);
    });

    it('dos clientes con el mismo nombre sí pueden existir (homónimos)', async () => {
      const { d, laura, pedro } = await montar('homonimos');
      expect((await editar(d.token, pedro.id, { name: laura.nombre })).status).toBe(200);
    });

    it('ignora campos que no se editan (visitas, etiqueta, id, businessId)', async () => {
      const { d, laura } = await montar('extra');
      const otro = await registerOwner('extraB');
      const r = await editar(d.token, laura.id, { visitas: 99, etiqueta: 'VIP', gasto: 1, id: 'x', businessId: otro.business.id, notes: 'ok' });
      expect(r.status).toBe(200);
      expect(r.body.client).toMatchObject({ id: laura.id, visitas: 0, etiqueta: 'Nuevo', gasto: 0, notas: 'ok' });
      expect((await prisma.client.findUnique({ where: { id: laura.id } })).businessId).toBe(d.business.id);
    });

    it('las citas ya agendadas conservan el nombre y teléfono con que se tomaron', async () => {
      const { d, laura } = await montar('historia');
      await editar(d.token, laura.id, { name: 'Laura Gómez Nueva', phone: '3109990000' });
      const citas = await api().get(`/api/v1/appointments?date=${bizDay(2)}`).set(auth(d.token));
      const cita = citas.body.appointments.find((c) => c.clientId === laura.id || c.cliente === 'Laura Gomez');
      expect(cita.cliente).toBe('Laura Gomez');
    });

    it('dos ediciones simultáneas de campos distintos se aplican las dos', async () => {
      const { d, laura } = await montar('simul');
      const [a, b] = await Promise.all([editar(d.token, laura.id, { notes: 'Nota A' }), editar(d.token, laura.id, { name: 'Laura Nueva' })]);
      expect([a.status, b.status]).toEqual([200, 200]);
      expect((await detalle(d.token, laura.id)).body.client).toMatchObject({ nombre: 'Laura Nueva', notas: 'Nota A' });
    });

    it('solo el dueño edita: barbero 403, master 403, sin sesión 401; un id inexistente, raro o de otro negocio da 404', async () => {
      const { d, barbero, laura } = await montar('roles');
      expect((await editar(barbero.token, laura.id, { notes: 'x' })).status).toBe(403);
      expect((await editar(s.master, laura.id, { notes: 'x' })).status).toBe(403);
      expect((await api().patch(`/api/v1/clients/${laura.id}`).send({ notes: 'x' })).status).toBe(401);
      for (const id of ['00000000-0000-0000-0000-000000000000', 'no-es-uuid', '%00']) expect((await editar(d.token, encodeURIComponent(id), { notes: 'x' })).status, id).toBe(404);
      const ajeno = (await listar(s.fade.owner)).body.clients[0];
      expect((await editar(d.token, ajeno.id, { notes: 'x' })).status).toBe(404);
      expect((await editar(s.navaja.owner, ajeno.id, { notes: 'x' })).status).toBe(404);
      expect((await detalle(d.token, laura.id)).body.client.notas).toBe('');
    });
  });

  describe('higiene', () => {
    it('los correos de prueba de este módulo terminan en @test.local', () => {
      expect(uniqueEmail('x')).toMatch(/@test\.local$/);
    });
  });
});
