/**
 * Módulo 4 — Negocio (GET /businesses/me y PATCH /businesses/me).
 * Lee las tres barberías demo en solo lectura; lo que modifica usa negocios @test.local nuevos.
 * Los hallazgos sin corregir se marcan con `it.fails('HALLAZGO …')`.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  api, auth, prisma, uniqueEmail, registerOwner, createEmployee, requireSeed, demoSessions, biz,
} from './helpers-demo.js';

const ver = (token) => api().get('/api/v1/businesses/me').set(auth(token));
const editar = (token, body) => api().patch('/api/v1/businesses/me').set(auth(token)).send(body);
const CLAVES = ['address', 'description', 'id', 'logo', 'name', 'phone'];

describe('Módulo 4 · negocio', () => {
  let s;
  beforeAll(async () => { await requireSeed(); s = await demoSessions(); });

  describe('ver el negocio (datos demo, solo lectura)', () => {
    it('La Navaja: devuelve su perfil completo con la forma exacta', async () => {
      const r = await ver(s.navaja.owner);
      expect(r.status).toBe(200);
      expect(Object.keys(r.body)).toEqual(['business']);
      expect(Object.keys(r.body.business).sort()).toEqual(CLAVES);
      expect(r.body.business).toMatchObject({
        name: 'Barbería La Navaja',
        phone: '3105550101',
        address: 'Cra 13 #63-20, Bogotá',
        description: expect.stringContaining('Chapinero'),
        logo: null,
      });
    });

    it('un barbero ve el mismo perfil que su dueño', async () => {
      const [o, j] = await Promise.all([ver(s.navaja.owner), ver(s.navaja.julian)]);
      expect(j.status).toBe(200);
      expect(j.body).toEqual(o.body);
    });

    it('cada negocio ve el suyo: El Fade y Barbería Nueva (esta con todo vacío)', async () => {
      expect((await ver(s.fade.owner)).body.business.name).toBe('Barbería El Fade');
      const nueva = (await ver(s.nueva.owner)).body.business;
      expect(nueva).toMatchObject({ name: 'Barbería Nueva', phone: '', address: '', logo: null });
    });

    it('los ids de los tres negocios son distintos', async () => {
      const ids = (await Promise.all([s.navaja.owner, s.fade.owner, s.nueva.owner].map(ver))).map((r) => r.body.business.id);
      expect(new Set(ids).size).toBe(3);
    });

    it('el master no tiene negocio (403 NO_BUSINESS) y sin sesión da 401', async () => {
      const m = await ver(s.master);
      expect(m.status).toBe(403);
      expect(m.body.code).toBe('NO_BUSINESS');
      expect((await api().get('/api/v1/businesses/me')).status).toBe(401);
    });

    it('lo que devuelve coincide con lo que dice /auth/me', async () => {
      const a = (await ver(s.navaja.owner)).body.business;
      const b = (await api().get('/api/v1/auth/me').set(auth(s.navaja.owner))).body.business;
      expect(a).toEqual(b);
    });
  });

  describe('editar el negocio', () => {
    it.each([
      { campo: 'name', valor: 'Barbería Central' },
      { campo: 'phone', valor: '3001112222' },
      { campo: 'address', valor: 'Calle 85 #15-30, Bogotá' },
      { campo: 'description', valor: 'La mejor barbería del barrio.' },
    ])('cambia solo $campo y deja lo demás igual', async ({ campo, valor }) => {
      const d = await registerOwner('edit');
      const antes = (await ver(d.token)).body.business;
      const r = await editar(d.token, { [campo]: valor });
      expect(r.status).toBe(200);
      expect(Object.keys(r.body.business).sort()).toEqual(CLAVES);
      expect(r.body.business[campo]).toBe(valor);
      for (const k of CLAVES.filter((x) => x !== campo)) expect(r.body.business[k], k).toEqual(antes[k]);
    });

    it('cambia varios campos a la vez y un GET posterior devuelve exactamente lo mismo', async () => {
      const d = await registerOwner('multi');
      const r = await editar(d.token, { name: 'Barbería Nueva Era', phone: '3105550199', address: 'Av. 68 #10-10', description: 'Cortes y barba.' });
      expect(r.status).toBe(200);
      expect((await ver(d.token)).body).toEqual(r.body);
    });

    it('queda guardado en la base de datos y avanza updatedAt', async () => {
      const d = await registerOwner('guarda');
      const antes = await prisma.business.findUnique({ where: { id: d.business.id } });
      await new Promise((r) => setTimeout(r, 20));
      await editar(d.token, { phone: '3001112222' });
      const despues = await prisma.business.findUnique({ where: { id: d.business.id } });
      expect(despues.phone).toBe('3001112222');
      expect(despues.updatedAt.getTime()).toBeGreaterThan(antes.updatedAt.getTime());
      expect(despues.createdAt.getTime()).toBe(antes.createdAt.getTime());
    });

    it('un cuerpo vacío no cambia nada y responde 200', async () => {
      const d = await registerOwner('vacio');
      const antes = (await ver(d.token)).body;
      const r = await editar(d.token, {});
      expect(r.status).toBe(200);
      expect(r.body).toEqual(antes);
    });

    it('el nombre admite tildes, ñ, emojis y texto con HTML (se guarda como texto)', async () => {
      const d = await registerOwner('texto');
      for (const name of ['Peluquería Ñandú ✂️', "O'Connor & Hijos", '<b>Negrita</b> Barbers']) {
        const r = await editar(d.token, { name });
        expect(r.status).toBe(200);
        expect(r.body.business.name).toBe(name);
      }
    });

    it('un cambio de nombre se refleja en el panel master (búsqueda por el nombre nuevo)', async () => {
      const d = await registerOwner('master');
      const nombre = `Barbería Renombrada ${Date.now()}`;
      await editar(d.token, { name: nombre });
      const r = await api().get(`/api/v1/master/businesses?search=${encodeURIComponent(nombre)}`).set(auth(s.master));
      expect(r.body.businesses.map((b) => b.id)).toContain(d.business.id);
    });

    it('dos ediciones simultáneas de campos distintos se aplican las dos (no se pisan)', async () => {
      const d = await registerOwner('conc');
      const [a, b] = await Promise.all([editar(d.token, { phone: '3001112222' }), editar(d.token, { address: 'Calle 1 #2-3' })]);
      expect([a.status, b.status]).toEqual([200, 200]);
      expect((await ver(d.token)).body.business).toMatchObject({ phone: '3001112222', address: 'Calle 1 #2-3' });
    });

    it('logoUrl: una dirección válida se guarda y null la quita', async () => {
      const d = await registerOwner('logo');
      const r = await editar(d.token, { logoUrl: 'https://cdn.ejemplo.com/logo.png' });
      expect(r.body.business.logo).toBe('https://cdn.ejemplo.com/logo.png');
      const quitado = await editar(d.token, { logoUrl: null });
      expect(quitado.body.business.logo).toBeNull();
    });
  });

  describe('validaciones', () => {
    const rechaza = async (body, patron) => {
      const d = await registerOwner('inv');
      const antes = (await ver(d.token)).body;
      const r = await editar(d.token, body);
      expect(r.status, JSON.stringify(body).slice(0, 80)).toBe(400);
      expect(r.body.code).toBe('VALIDATION_ERROR');
      expect(r.body.error).not.toMatch(/Required|Expected|Invalid|must contain|String must/i);
      if (patron) expect(r.body.error).toMatch(patron);
      expect((await ver(d.token)).body).toEqual(antes);
    };

    it('el nombre no puede ser vacío ni de otro tipo (null, número, lista)', async () => {
      for (const name of ['', null, 123, ['x']]) await rechaza({ name });
    });

    it('H18 corregido: el nombre se recorta y no puede ser solo espacios ni pasar de 80 caracteres', async () => {
      const d = await registerOwner('nombre');
      expect((await editar(d.token, { name: '    ' })).status).toBe(400);
      expect((await editar(d.token, { name: 'A'.repeat(81) })).status).toBe(400);
      const r = await editar(d.token, { name: '   Barbería Recortada   ' });
      expect(r.body.business.name).toBe('Barbería Recortada');
    });

    it('H19 corregido: el teléfono solo admite formato de teléfono (dígitos, espacios, +, -, paréntesis; 7 a 20) y recortarse', async () => {
      for (const phone of ['3001234567', '+57 300 123 4567', '(601) 555-0101', '  3001234567  ', '']) {
        const d = await registerOwner('tel');
        const r = await editar(d.token, { phone });
        expect(r.status, phone).toBe(200);
        expect(r.body.business.phone).toBe(phone.trim());
      }
      for (const phone of ['abc', 'llámame al 300', '123', '1'.repeat(21), '<script>1</script>']) await rechaza({ phone });
    });

    it('H20 corregido: la dirección admite hasta 200 caracteres y la descripción hasta 500', async () => {
      const d = await registerOwner('largos');
      expect((await editar(d.token, { address: 'x'.repeat(200) })).status).toBe(200);
      expect((await editar(d.token, { description: 'x'.repeat(500) })).status).toBe(200);
      await rechaza({ address: 'x'.repeat(201) });
      await rechaza({ description: 'x'.repeat(501) });
    });

    it('H21 corregido [seguridad]: logoUrl solo admite direcciones http(s) válidas y de máximo 2048 caracteres', async () => {
      // "javascript:" y "data:" son la vía clásica de XSS si algún día se muestra el logo con <img src> o <a href>.
      for (const logoUrl of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>alert(1)</script>', 'ftp://x.com/a.png', 'no es una dirección', `https://x.com/${'a'.repeat(2100)}`]) {
        await rechaza({ logoUrl });
      }
    });

    it('un texto que no es una cadena en teléfono, dirección o descripción da 400 en español', async () => {
      for (const campo of ['phone', 'address', 'description', 'logoUrl']) await rechaza({ [campo]: 12345 });
    });
  });

  describe('contrato: lo que se lee es lo que se escribe', () => {
    it('H22 corregido: PATCH acepta `logo` (el mismo nombre con que GET lo devuelve), no solo `logoUrl`', async () => {
      const d = await registerOwner('alias');
      const leido = (await ver(d.token)).body.business;
      const r = await editar(d.token, { ...leido, name: 'Con Alias', logo: 'https://cdn.ejemplo.com/a.png' });
      expect(r.body.business.logo).toBe('https://cdn.ejemplo.com/a.png');
    });

    it('enviar de vuelta tal cual lo leído no altera nada (ni siquiera el id)', async () => {
      const d = await registerOwner('ida');
      const leido = (await ver(d.token)).body.business;
      const r = await editar(d.token, leido);
      expect(r.status).toBe(200);
      expect(r.body.business).toEqual(leido);
    });

    it('los campos extra (id, businessId, createdAt, users) se ignoran', async () => {
      const a = await registerOwner('extraA');
      const b = await registerOwner('extraB');
      const r = await editar(a.token, { phone: '3001112222', id: b.business.id, businessId: b.business.id, createdAt: '2000-01-01', users: [] });
      expect(r.status).toBe(200);
      expect(r.body.business.id).toBe(a.business.id);
      expect((await ver(b.token)).body.business.phone).toBe('');
    });
  });

  describe('permisos y aislamiento', () => {
    it('matriz de roles para editar: dueño 200, barbero 403, master 403, sin sesión 401', async () => {
      const d = await registerOwner('matriz');
      const barbero = await createEmployee(d.token, 'Barbero Matriz');
      expect((await editar(d.token, { phone: '3001112222' })).status).toBe(200);
      const b = await editar(barbero.token, { phone: '3009999999' });
      expect(b.status).toBe(403);
      expect(b.body.error).toBe('No tienes permiso para esta acción.');
      expect((await editar(s.master, { phone: '3009999999' })).status).toBe(403);
      expect((await api().patch('/api/v1/businesses/me').send({ phone: '3009999999' })).status).toBe(401);
      expect((await ver(d.token)).body.business.phone).toBe('3001112222');
    });

    it('editar un negocio nunca toca a otro: ni con el id ajeno en el cuerpo', async () => {
      const a = await registerOwner('aisA');
      const b = await registerOwner('aisB');
      const antesB = (await ver(b.token)).body;
      await editar(a.token, { name: 'Solo A', businessId: b.business.id });
      expect((await ver(b.token)).body).toEqual(antesB);
    });

    it('no hay forma de leer ni editar un negocio por su id (no existe /businesses/:id)', async () => {
      const a = await registerOwner('idA');
      const b = await registerOwner('idB');
      expect((await api().get(`/api/v1/businesses/${b.business.id}`).set(auth(a.token))).status).toBe(404);
      expect((await api().patch(`/api/v1/businesses/${b.business.id}`).set(auth(a.token)).send({ name: 'x' })).status).toBe(404);
    });

    it('los datos demo no se tocaron: La Navaja sigue igual tras todas estas pruebas', async () => {
      const r = (await ver(s.navaja.owner)).body.business;
      expect(r).toMatchObject({ name: biz('navaja').name, phone: biz('navaja').phone, address: biz('navaja').address });
    });
  });

  describe('valores por defecto del negocio recién registrado', () => {
    it('se llama «Barbería de {nombre}» y empieza sin teléfono, dirección, descripción ni logo', async () => {
      const email = uniqueEmail('defecto');
      const r = await api().post('/api/v1/auth/register').send({ name: 'Marcos Prueba', email, password: 'Clave1234' });
      expect(r.body.business).toMatchObject({ name: 'Barbería de Marcos Prueba', phone: '', address: '', description: '', logo: null });
    });
  });
});
