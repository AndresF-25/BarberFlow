/**
 * Carga los datos de demostración y prueba (server/prisma/demo/demo-data.json).
 *
 *   npm run db:seed:demo          carga (reemplaza lo demo existente)
 *   npm run db:seed:demo:reset    borra solo lo demo
 *
 * Solo toca filas del dominio @demo.barberflow.com; nunca datos reales ni @test.local.
 * Escribe con Prisma (no con la API) porque necesita fechas pasadas, que la API rechaza.
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/lib/password.js';
import { nowInBusinessTz, amountToCents, pickStaffColor, addDays } from '../src/lib/utils.js';
import { cleanupTestData } from './cleanupTestData.js';
import { buildDataset, summarize } from '../prisma/demo/dataset.js';

if (process.env.NODE_ENV === 'production') {
  console.error('seed-demo se niega a correr con NODE_ENV=production.');
  process.exit(1);
}

const reset = process.argv.includes('--reset');

async function main() {
  const today = nowInBusinessTz().date;
  const data = buildDataset(today);
  const domain = `@${data.meta.domain}`;
  const at = (date, time) => new Date(`${date}T${time}:00${data.meta.utcOffset}`);
  const plus = (time, minutes) => {
    const t = Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) + minutes;
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  };

  const removed = await cleanupTestData(prisma, domain);
  console.log(`Demo anterior eliminado: ${removed.users} usuarios, ${removed.businesses} negocios.`);
  if (reset) return;

  const passwordHash = await hashPassword(data.meta.password);
  const born = at(addDays(today, -176), '09:00');

  const rows = {
    business: [], user: [], staffProfile: [], service: [], product: [], client: [],
    appointment: [], serviceTransaction: [], productSale: [], stockAdjustment: [],
  };

  rows.user.push({ id: randomUUID(), email: data.master.email, passwordHash, name: data.master.name, role: 'master', businessId: null, createdAt: born });

  for (const biz of data.businesses) {
    const businessId = randomUUID();
    rows.business.push({ id: businessId, name: biz.name, description: biz.description, phone: biz.phone, address: biz.address, createdAt: born });

    const ownerId = randomUUID();
    rows.user.push({ id: ownerId, email: biz.owner.email, passwordHash, name: biz.owner.name, role: 'owner', businessId, createdAt: born });

    const staffId = {};
    biz.staff.forEach((s, i) => {
      staffId[s.key] = randomUUID();
      rows.user.push({ id: staffId[s.key], email: s.email, passwordHash, name: s.name, role: 'employee', businessId, isActive: s.active, createdAt: born });
      rows.staffProfile.push({ userId: staffId[s.key], specialty: s.specialty, color: pickStaffColor(i), displayOrder: i });
    });

    const completed = biz.appointments.filter((a) => a.status === 'completed');
    const serviceId = {};
    biz.services.forEach((s) => {
      serviceId[s.key] = randomUUID();
      rows.service.push({
        id: serviceId[s.key], businessId, name: s.nombre, category: s.categoria, priceCents: amountToCents(s.precio),
        durationMinutes: s.duracion, isActive: s.active, timesPerformed: completed.filter((a) => a.service === s.key).length, createdAt: born,
      });
    });

    const productId = {};
    biz.products.forEach((p) => {
      productId[p.key] = randomUUID();
      rows.product.push({
        id: productId[p.key], businessId, name: p.nombre, category: p.categoria, stock: p.stock, stockMin: p.stockMin, unit: p.unidad,
        salePriceCents: amountToCents(p.precioVenta), costPriceCents: amountToCents(p.precioCosto), isActive: p.active, createdAt: born,
      });
    });

    const clientId = {};
    const clientByKey = Object.fromEntries(biz.clients.map((c) => [c.key, c]));
    biz.clients.forEach((c) => {
      clientId[c.key] = randomUUID();
      rows.client.push({
        id: clientId[c.key], businessId, name: c.name, phone: c.phone,
        createdAt: at(c.createdDate, '09:00'), updatedAt: at(c.lastDate, '12:00'),
      });
    });

    const serviceByKey = Object.fromEntries(biz.services.map((s) => [s.key, s]));
    for (const a of biz.appointments) {
      const id = randomUUID();
      const client = clientByKey[a.client];
      // Citas del día en adelante: no pueden haberse creado en el futuro.
      const createdOn = addDays(a.date, -1) > today ? today : addDays(a.date, -1);
      rows.appointment.push({
        id, businessId, clientId: clientId[a.client], serviceId: serviceId[a.service], employeeId: staffId[a.staff],
        appointmentDate: new Date(`${a.date}T00:00:00.000Z`), startTime: a.time, status: a.status,
        clientName: client.name, clientPhone: client.phone, createdById: ownerId, createdAt: at(createdOn, '09:00'),
      });
      if (a.status === 'completed') {
        const svc = serviceByKey[a.service];
        rows.serviceTransaction.push({
          id: randomUUID(), businessId, appointmentId: id, serviceId: serviceId[a.service], clientId: clientId[a.client],
          employeeId: staffId[a.staff], amountCents: amountToCents(svc.precio), paymentMethod: a.pay,
          completedAt: at(a.date, plus(a.time, svc.duracion)),
        });
      }
    }

    const productByKey = Object.fromEntries(biz.products.map((p) => [p.key, p]));
    for (const s of biz.sales) {
      const id = randomUUID();
      const product = productByKey[s.product];
      const soldAt = at(s.date, '13:00');
      rows.productSale.push({
        id, businessId, productId: productId[s.product], clientId: s.client ? clientId[s.client] : null,
        clientName: s.client ? clientByKey[s.client].name : null, quantity: s.qty,
        unitPriceCents: amountToCents(product.precioVenta), totalCents: amountToCents(product.precioVenta) * s.qty,
        soldAt, soldById: s.seller === 'owner' ? ownerId : staffId[s.seller],
      });
      rows.stockAdjustment.push({ id: randomUUID(), productId: productId[s.product], delta: -s.qty, reason: 'sale', referenceId: id, createdAt: soldAt });
    }

    for (const [key, initial] of Object.entries(biz.initialStock)) {
      if (initial > 0) rows.stockAdjustment.push({ id: randomUUID(), productId: productId[key], delta: initial, reason: 'manual', createdAt: born });
    }
    for (const a of biz.adjustments) {
      rows.stockAdjustment.push({ id: randomUUID(), productId: productId[a.product], delta: a.delta, reason: a.reason, createdAt: at(a.date, '09:30') });
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const model of ['business', 'user', 'staffProfile', 'service', 'product', 'client', 'appointment', 'serviceTransaction', 'productSale', 'stockAdjustment']) {
      if (rows[model].length) await tx[model].createMany({ data: rows[model] });
    }
  }, { timeout: 120000, maxWait: 20000 });

  console.log('\nDatos de demostración cargados (hoy =', today + '):');
  console.table(data.businesses.map((b) => {
    const t = summarize(b).totals;
    return { negocio: b.name, barberos: t.staff, servicios: t.services, productos: t.products, clientes: t.clients, citas: t.appointments, ventas: t.sales };
  }));
  console.log(`Usuarios: ${rows.user.length}  |  Contraseña de todos: ${data.meta.password}`);
  console.log('Cuentas:');
  console.log(`  master   ${data.master.email}`);
  for (const b of data.businesses) {
    console.log(`  dueño    ${b.owner.email}   (${b.name})`);
    b.staff.forEach((s) => console.log(`  barbero  ${s.email}${s.active ? '' : '   [desactivado]'}`));
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
