/// <reference types="vitest" />

import { execSync } from 'child_process';
import { resolve } from 'path';
import { readFileSync } from 'fs';

import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import { esmExternalRequirePlugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { findGitRootPath } from '@gen-epix/tools-lib';

// eslint-disable-next-line import-x/extensions
import packageJson from './package.json' with { type: 'json' };

const gitRootPath = findGitRootPath();

let commitHash = 'not-a-git-repo';
try {
  commitHash = execSync('git rev-parse --short HEAD').toString().trim();
} catch {
  // not a git repo or git is unavailable
}

// https://vitejs.dev/config/
// eslint-disable-next-line import-x/no-default-export
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        app: resolve(import.meta.dirname, 'index.html'),
      },
    },
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
    // All peer dependencies of @rivm-loculus-tools/phylogeny-viewer should be deduplicated to the local node_modules version
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
    https: process.env.NODE_ENV === 'development' ? {
      cert: readFileSync(resolve(gitRootPath, 'cert', 'cert.pem')),
      key: readFileSync(resolve(gitRootPath, 'cert', 'key.pem')),
    } : undefined,
    open: true,
    port: 5021,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    server: {
      deps: {
        inline: ['@mui/material', 'react-transition-group'],
      },
    },
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 5000,
  },
});
