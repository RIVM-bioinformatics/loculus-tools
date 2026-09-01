import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
// eslint-disable-next-line import-x/no-default-export
export default defineConfig({
  build: {
    target: 'es2022',
  },
  optimizeDeps: {
    include: [
      '@gen-epix/ui',
      '@gen-epix/ui-casedb',
      '@biowasm/aioli',
      'neighbor-joining',
      'decimal.js',
      'lodash',
    ],
  },
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
});
