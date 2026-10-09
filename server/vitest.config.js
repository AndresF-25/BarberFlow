import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // tests/demo necesita datos cargados (npm run db:seed:demo): se corre aparte con npm run test:demo.
    exclude: [...configDefaults.exclude, 'tests/demo/**'],
    globalSetup: ['./tests/globalSetup.js'],
    setupFiles: ['./tests/setup.js'],
    // Los tests de integración comparten la base de datos: se ejecutan de a uno.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
