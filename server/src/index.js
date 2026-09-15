import 'dotenv/config';
import { createApp } from './app.js';
import { bootstrapMasterUser } from './lib/bootstrapMaster.js';
import { prisma } from './lib/prisma.js';

const PORT = Number(process.env.PORT || 3001);

async function main() {
  await bootstrapMasterUser();

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`BarberFlow API listening on http://localhost:${PORT}`);
  });
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
