import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    reporters: ['verbose'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // `server-only` resuelve a su entrada de cliente fuera de Next y lanza
      // al importarse. En los tests se anula: el guardián sigue vigente en
      // la aplicación, que es donde importa.
      'server-only': path.resolve(__dirname, 'tests/stubs/server-only.ts'),
    },
  },
});
