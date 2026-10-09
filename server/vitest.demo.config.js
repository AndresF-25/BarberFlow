import { defineConfig } from 'vitest/config';

/* Pruebas contra los datos de demostración (npm run db:seed:demo antes). Ver tests/demo/. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/demo/**/*.test.js'],
    // Solo limpia @test.local; los datos @demo.barberflow.com se conservan.
    globalSetup: ['./tests/globalSetup.js'],
    setupFiles: ['./tests/setup.js'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
