import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { cleanupTestData } from '../scripts/cleanupTestData.js';

// Limpia datos de pruebas anteriores al empezar y los de esta corrida al terminar.
// Si la base de datos no está disponible, los tests de integración se omiten solos.
async function cleanIfPossible() {
  const prisma = new PrismaClient();
  try {
    await cleanupTestData(prisma);
  } catch {
    // sin base de datos: nada que limpiar
  } finally {
    await prisma.$disconnect();
  }
}

export async function setup() {
  await cleanIfPossible();
}

export async function teardown() {
  await cleanIfPossible();
}
