import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
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
  build: {
    target: 'es2022',
  },
});
