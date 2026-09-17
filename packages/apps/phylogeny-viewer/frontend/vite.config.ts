import { execSync } from 'child_process';
import { resolve } from 'path';

import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import {
  defineConfig,
  esmExternalRequirePlugin,
} from 'vite';

// eslint-disable-next-line import-x/extensions
import packageJson from './package.json';

const commitHash = execSync('git rev-parse --short HEAD').toString();

// https://vitejs.dev/config/
// eslint-disable-next-line import-x/no-default-export
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        app: resolve(__dirname, 'index.html'),
      },
    },
    sourcemap: true,
  },
  define: {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    __COMMIT_HASH__: JSON.stringify(commitHash.trim()),
    // eslint-disable-next-line @typescript-eslint/naming-convention
    __PACKAGE_JSON_VERSION__: JSON.stringify((packageJson.version).trim()),
  },
  html: {
    cspNonce: '**CSP_NONCE**',
  },
  optimizeDeps: {
    rolldownOptions: {
      plugins: [esmExternalRequirePlugin()],
    },
  },
  plugins: [
    react(),
    svgr(),
  ],
  resolve: {
    // All peer dependencies of @gen-epix/ui should be deduplicated to the local node_modules version
    // This is to prevent issues with multiple versions of the same package (replaces explicit path aliases
    // which caused rolldown CJS `require` errors in Vite 8)
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
    host: true,
    open: true,
    port: 5173,
  },
});
