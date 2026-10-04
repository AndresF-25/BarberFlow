import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { configure } from '@testing-library/dom';

// La API real tarda más que el timeout por defecto (1 s) en responder bajo carga.
configure({ asyncUtilTimeout: 6000 });

// Limita el volcado del DOM en los errores de testing-library.
process.env.DEBUG_PRINT_LIMIT = '1500';

// Sin `globals: true`, testing-library no limpia solo el DOM entre pruebas.
afterEach(() => {
  cleanup();
  localStorage.clear();
});

// recharts (ResponsiveContainer) necesita ResizeObserver, que jsdom no trae.
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// El navegador no existe en jsdom: window.confirm siempre acepta.
window.confirm = () => true;
