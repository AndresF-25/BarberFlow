import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../lib/password.js';

export async function bootstrapMasterUser() {
  const email = process.env.MASTER_EMAIL;
  const password = process.env.MASTER_PASSWORD;
  const name = process.env.MASTER_NAME || 'Administrador BarberFlow';

  if (!email || !password) {
    console.warn('[bootstrap] MASTER_EMAIL y MASTER_PASSWORD no configurados; se omite creación de master.');
    return;
  }

  const existing = await prisma.user.findFirst({ where: { role: 'master' } });
  if (existing) return;

  await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash: await hashPassword(password),
      name,
      role: 'master',
      businessId: null,
    },
  });

  console.log(`[bootstrap] Usuario master creado: ${email}`);
}
