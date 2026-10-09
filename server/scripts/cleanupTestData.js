/* Elimina los datos de prueba: usuarios con correo @test.local y todo lo que cuelga de sus negocios.
   Con `domain` se limpia otro conjunto de datos (p. ej. @demo.barberflow.com, ver seed-demo.js). */
export const TEST_DOMAIN = '@test.local';

export async function cleanupTestData(prisma, domain = TEST_DOMAIN) {
  // Guarda: un dominio vacío o sin "@" borraría usuarios reales.
  if (typeof domain !== 'string' || !/^@[^@\s]+\.[^@\s]+$/.test(domain)) {
    throw new Error(`Dominio de limpieza inválido: "${domain}".`);
  }
  const users = await prisma.user.findMany({
    where: { email: { endsWith: domain } },
    select: { id: true, businessId: true },
  });
  const userIds = users.map((u) => u.id);
  const businessIds = [...new Set(users.map((u) => u.businessId).filter(Boolean))];

  const products = await prisma.product.findMany({ where: { businessId: { in: businessIds } }, select: { id: true } });
  const productIds = products.map((p) => p.id);

  await prisma.$transaction([
    prisma.stockAdjustment.deleteMany({ where: { productId: { in: productIds } } }),
    prisma.productSale.deleteMany({ where: { businessId: { in: businessIds } } }),
    prisma.product.deleteMany({ where: { businessId: { in: businessIds } } }),
    prisma.serviceTransaction.deleteMany({ where: { businessId: { in: businessIds } } }),
    prisma.appointment.deleteMany({ where: { businessId: { in: businessIds } } }),
    prisma.service.deleteMany({ where: { businessId: { in: businessIds } } }),
    prisma.client.deleteMany({ where: { businessId: { in: businessIds } } }),
    prisma.staffProfile.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
    prisma.business.deleteMany({ where: { id: { in: businessIds } } }),
  ]);

  return { users: users.length, businesses: businessIds.length };
}
