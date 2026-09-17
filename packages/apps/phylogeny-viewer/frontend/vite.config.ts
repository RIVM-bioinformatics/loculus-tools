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
      '@biowasm/aioli',
      'neighbor-joining',
      'lodash',
    ],
  },
  plugins: [react()],
  resolve: {
    dedupe: [
      '@emotion/cache',
      '@emotion/react',
      '@emotion/styled',
      '@mui/icons-material',
      '@mui/material',
      '@mui/styled-engine',
      '@mui/system',
      '@mui/utils',
      '@mui/x-date-pickers',
      'i18next',
      'react-dom',
      'react-i18next',
      'react',
    ],
  },
  server: {
    host: false,
    open: true,
    port: 5173,
  },
});
