/**
 * Módulo 0 — Carga de datos de demostración.
 * Comprueba que la BD tiene exactamente lo que dice demo-data.json, que los datos son
 * coherentes entre sí y que el limpiador de pruebas (@test.local) no los toca.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { prisma, api, auth, dataset, biz, summaries, DEMO_DOMAIN, requireSeed, loginDemo, demoSessions } from './helpers-demo.js';
import { cleanupTestData } from '../../scripts/cleanupTestData.js';

const SERVER_DIR = fileURLToPath(new URL('../..', import.meta.url));

async function businessIdOf(key) {
  const owner = await prisma.user.findUnique({ where: { email: biz(key).owner.email } });
  return owner.businessId;
}

async function conteos(businessId) {
  const w = { businessId };
  return {
    usuarios: await prisma.user.count({ where: w }),
    servicios: await prisma.service.count({ where: w }),
    productos: await prisma.product.count({ where: w }),
    clientes: await prisma.client.count({ where: w }),
    citas: await prisma.appointment.count({ where: w }),
    transacciones: await prisma.serviceTransaction.count({ where: w }),
    ventas: await prisma.productSale.count({ where: w }),
  };
}

describe('Módulo 0 · datos de demostración', () => {
  beforeAll(requireSeed);

  describe('conteos exactos', () => {
    for (const b of dataset.businesses) {
      it(`${b.name}: la BD coincide con demo-data.json`, async () => {
        const t = summaries[b.key].totals;
        const c = await conteos(await businessIdOf(b.key));
        expect(c).toEqual({
          usuarios: 1 + t.staff,
          servicios: t.services,
          productos: t.products,
          clientes: t.clients,
          citas: t.appointments,
          transacciones: t.completed,
          ventas: t.sales,
        });
      });
    }

    it('el master existe sin negocio', async () => {
      const m = await prisma.user.findUnique({ where: { email: dataset.master.email } });
      expect(m.role).toBe('master');
      expect(m.businessId).toBeNull();
    });

    it('todos los correos demo usan el dominio demo', async () => {
      const users = await prisma.user.findMany({ where: { email: { endsWith: DEMO_DOMAIN } } });
      expect(users).toHaveLength(1 + dataset.businesses.reduce((n, b) => n + 1 + b.staff.length, 0));
    });
  });

  describe('coherencia interna', () => {
    it('el stock actual de cada producto coincide con la suma de sus ajustes', async () => {
      const businessId = await businessIdOf('navaja');
      const products = await prisma.product.findMany({ where: { businessId }, include: { stockAdjustments: true } });
      for (const p of products) {
        const suma = p.stockAdjustments.reduce((n, a) => n + a.delta, 0);
        expect(suma, `stock de ${p.name}`).toBe(p.stock);
      }
    });

    it('cada transacción de servicio tiene su cita finalizada y el mismo importe que el servicio', async () => {
      const businessId = await businessIdOf('navaja');
      const tx = await prisma.serviceTransaction.findMany({ where: { businessId }, include: { appointment: true, service: true } });
      expect(tx.length).toBeGreaterThan(0);
      for (const t of tx) {
        expect(t.appointment.status).toBe('completed');
        expect(t.amountCents).toBe(t.service.priceCents);
      }
    });

    it('timesPerformed de cada servicio = citas finalizadas de ese servicio', async () => {
      const businessId = await businessIdOf('navaja');
      const services = await prisma.service.findMany({ where: { businessId } });
      for (const s of services) {
        const n = await prisma.appointment.count({ where: { businessId, serviceId: s.id, status: 'completed' } });
        expect(s.timesPerformed, s.name).toBe(n);
      }
    });

    it('hoy hay citas en los 4 estados y las de otros días no se mezclan', async () => {
      const businessId = await businessIdOf('navaja');
      const delDia = await prisma.appointment.groupBy({
        by: ['status'], where: { businessId, appointmentDate: new Date(`${dataset.hoy}T00:00:00.000Z`) }, _count: true,
      });
      const porEstado = Object.fromEntries(delDia.map((g) => [g.status, g._count]));
      const esperado = {};
      biz('navaja').appointments.filter((a) => a.date === dataset.hoy).forEach((a) => { esperado[a.status] = (esperado[a.status] || 0) + 1; });
      expect(porEstado).toEqual(esperado);
      expect(Object.keys(porEstado).sort()).toEqual(['cancelled', 'completed', 'confirmed', 'pending']);
    });

    it('el barbero desactivado conserva su historial', async () => {
      const sebas = await prisma.user.findUnique({ where: { email: biz('navaja').staff.find((s) => s.key === 'sebas').email } });
      expect(sebas.isActive).toBe(false);
      expect(await prisma.appointment.count({ where: { employeeId: sebas.id } })).toBeGreaterThan(0);
    });
  });

  describe('diseño para probar aislamiento', () => {
    it('El Fade repite los nombres de servicios de La Navaja pero con ids propios', async () => {
      const a = await prisma.service.findMany({ where: { businessId: await businessIdOf('navaja') } });
      const b = await prisma.service.findMany({ where: { businessId: await businessIdOf('fade') } });
      const comunes = b.filter((s) => a.some((x) => x.name === s.name));
      expect(comunes.length).toBe(b.length);
      expect(b.every((s) => !a.some((x) => x.id === s.id))).toBe(true);
    });

    it('un teléfono se repite entre negocios (Carlos Gómez), y son clientes distintos', async () => {
      const clientes = await prisma.client.findMany({ where: { phone: '3001110001' } });
      expect(clientes).toHaveLength(2);
      expect(new Set(clientes.map((c) => c.businessId)).size).toBe(2);
    });

    it('Barbería Nueva no tiene datos: ni barberos, ni servicios, ni citas', async () => {
      const c = await conteos(await businessIdOf('nueva'));
      expect(c).toEqual({ usuarios: 1, servicios: 0, productos: 0, clientes: 0, citas: 0, transacciones: 0, ventas: 0 });
    });
  });

  describe('cuentas', () => {
    it('todas las activas inician sesión con la contraseña demo', async () => {
      const s = await demoSessions();
      expect(Object.keys(s)).toEqual(['master', 'navaja', 'fade', 'nueva']);
    });

    it('el barbero desactivado no puede entrar (403)', async () => {
      const r = await loginDemo(biz('navaja').staff.find((x) => x.key === 'sebas').email);
      expect(r.status).toBe(403);
    });

    it('cada rol ve lo suyo en /me', async () => {
      const s = await demoSessions();
      const me = async (t) => (await api().get('/api/v1/auth/me').set(auth(t))).body;
      expect((await me(s.master)).business).toBeNull();
      expect((await me(s.navaja.owner)).business.name).toBe('Barbería La Navaja');
      expect((await me(s.navaja.julian)).user.role).toBe('employee');
      expect((await me(s.fade.owner)).business.name).toBe('Barbería El Fade');
      expect((await me(s.nueva.owner)).business.name).toBe('Barbería Nueva');
    });
  });

  describe('etiquetas de cliente diseñadas (vista por la API real)', () => {
    it('cada cliente con "expect" sale con su etiqueta y número de visitas', async () => {
      const s = await demoSessions();
      for (const key of ['navaja', 'fade']) {
        const res = await api().get('/api/v1/clients').set(auth(s[key].owner));
        expect(res.status).toBe(200);
        for (const c of biz(key).clients.filter((x) => x.expect)) {
          const fila = res.body.clients.find((x) => x.nombre === c.name && (x.telefono === (c.phone || '—')));
          expect(fila, `${key}/${c.name}`).toBeTruthy();
          expect({ etiqueta: fila.etiqueta, visitas: fila.visitas }, `${key}/${c.name}`).toEqual(c.expect);
        }
      }
    });
  });

  describe('separación entre limpieza de pruebas y datos demo', () => {
    it('cleanupTestData() por defecto (@test.local) no borra nada demo', async () => {
      const antes = await conteos(await businessIdOf('navaja'));
      const r = await cleanupTestData(prisma);
      expect(typeof r.users).toBe('number');
      expect(await conteos(await businessIdOf('navaja'))).toEqual(antes);
    });

    it('rechaza dominios peligrosos que borrarían usuarios reales', async () => {
      for (const malo of ['', '@', 'test.local', '@x', null, '@a b.com']) {
        await expect(cleanupTestData(prisma, malo)).rejects.toThrow(/Dominio de limpieza inválido/);
      }
    });
  });

  describe('higiene de la base de datos', () => {
    it('ninguna prueba deja usuarios con un dominio parecido a @test.local que el limpiador no borre', async () => {
      // Ejemplo real: "ana+tag@sub.test.local" no termina en "@test.local" y se acumulaba en cada ejecución.
      const huerfanos = await prisma.user.findMany({
        where: { email: { contains: 'test.local' }, NOT: { email: { endsWith: '@test.local' } } },
        select: { email: true },
      });
      expect(huerfanos).toEqual([]);
    });
  });

  describe('idempotencia de la carga', () => {
    it('cargar otra vez deja exactamente los mismos conteos y no toca usuarios reales', async () => {
      const reales = await prisma.user.count({ where: { NOT: { email: { endsWith: DEMO_DOMAIN } } } });
      const negociosReales = await prisma.business.count() - 3;
      const antes = await conteos(await businessIdOf('navaja'));

      execFileSync('node', ['scripts/seed-demo.js'], { cwd: SERVER_DIR, stdio: 'pipe', timeout: 120000 });

      expect(await conteos(await businessIdOf('navaja'))).toEqual(antes);
      expect(await prisma.user.count({ where: { NOT: { email: { endsWith: DEMO_DOMAIN } } } })).toBe(reales);
      expect(await prisma.business.count() - 3).toBe(negociosReales);
    }, 150000);
  });
});
