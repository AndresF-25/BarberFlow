/**
 * Elimina los datos creados por las pruebas automáticas (usuarios @test.local
 * y todo lo que cuelga de sus negocios).
 *
 * Uso: npm run test:cleanup
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { cleanupTestData } from './cleanupTestData.js';

cleanupTestData(prisma)
  .then(({ users, businesses }) => console.log(`Eliminados: ${users} usuarios y ${businesses} negocios de prueba.`))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
