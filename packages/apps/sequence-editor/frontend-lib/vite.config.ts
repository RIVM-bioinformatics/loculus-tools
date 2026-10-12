/// <reference types="vitest" />

import {
  globSync,
  readFileSync,
} from 'fs';
import {
  dirname,
  join,
} from 'path';

import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import dts from 'vite-plugin-dts';
import { libInjectCss } from 'vite-plugin-lib-inject-css';
import { defineConfig } from 'vitest/config';
import type { Target } from 'vite-plugin-static-copy';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { esmExternalRequirePlugin } from 'vite';

type PackageManifest = {
  peerDependencies?: Record<string, string>;
};

const createPeerDependencyExternalPatterns = () => {
  const packageJson = JSON.parse(
    readFileSync(join(import.meta.dirname, 'package.json'), 'utf8'),
  ) as PackageManifest;

  return Object.keys(packageJson.peerDependencies ?? {}).map((dependency) => {
    const escapedDependency = dependency.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^${escapedDependency}(?:/.+)?$`);
  });
};

const peerDependencyExternalPatterns = createPeerDependencyExternalPatterns();

const discoverEntries = (): { entries: Record<string, string>; flatKeys: Set<string> } => {
  const entries: Record<string, string> = {};
  const flatKeys = new Set<string>();

  const srcDir = join(import.meta.dirname, 'src');

  // index.ts-based entries (classes, utils): key = component directory
  globSync([
    join(srcDir, 'classes', '**', 'index.ts'),
    join(srcDir, 'components', '**', 'index.ts'),
    join(srcDir, 'constants', '**', 'index.ts'),
    join(srcDir, 'dataHooks', '**', 'index.ts'),
    join(srcDir, 'hoc', '**', 'index.ts'),
    join(srcDir, 'hooks', '**', 'index.ts'),
    join(srcDir, 'hooks', '**', 'index.ts'),
    join(srcDir, 'locale', '**', 'index.ts'),
    join(srcDir, 'pages', '**', 'index.ts'),
    join(srcDir, 'routes', '**', 'index.ts'),
    join(srcDir, 'stores', '**', 'index.ts'),
    join(srcDir, 'theme', '**', 'index.ts'),
    join(srcDir, 'utils', '**', 'index.ts'),
    join(srcDir, 'utils', '**', 'index.ts'),
  ]).forEach((file) => {
    const relKey = dirname(file).replace(`${srcDir}/`, '');
    entries[relKey] = `./${file.replace(`${import.meta.dirname}/`, '')}`;
  });

  // flat .ts entries (models): key = file path without extension
  globSync([join(srcDir, 'models', '*.ts'), join(srcDir, 'constants', '*.ts'), join(srcDir, 'setup', '*.ts'), join(srcDir, 'types', '*.ts')])
    .filter((file) => !file.endsWith('/index.ts'))
    .forEach((file) => {
      const relKey = file.replace(`${srcDir}/`, '').replace(/\.ts$/, '');
      entries[relKey] = `./${file.replace(`${import.meta.dirname}/`, '')}`;
      flatKeys.add(relKey);
    });

  return { entries, flatKeys };
};

const { entries: libEntries, flatKeys } = discoverEntries();

// https://vitejs.dev/config/
// eslint-disable-next-line import-x/no-default-export
export default defineConfig({
  build: {
    copyPublicDir: false,
    lib: {
      entry: libEntries,
      fileName: (_, entryAlias) => {
        if (entryAlias === 'index') {
          return 'index.js';
        }
        // flat .ts entries output alongside their .d.ts; index.ts entries output in a subdirectory
        return flatKeys.has(entryAlias) ? `${entryAlias}.js` : `${entryAlias}/index.js`;
      },
      formats: ['es'],
    },
    rolldownOptions: {
      output: {
        chunkFileNames: '_chunks/[name].js',
      },
      plugins: [
        esmExternalRequirePlugin({
          external: peerDependencyExternalPatterns,
        }),
      ],
      treeshake: true,
    },
    sourcemap: true,
  },
  plugins: [
    react(),
    svgr(),
    libInjectCss(),
    dts({
      entryRoot: './src',
      insertTypesEntry: false,
      tsconfigPath: './tsconfig.build.json',
    }),
    viteStaticCopy({
      targets: ([
        {
          dest: '@types',
          rename: { stripBase: true },
          src: [
            './src/@types/**/*.d.ts',
          ],
        },
        {
          dest: './locale',
          rename: { stripBase: true },
          src: [
            './src/locale',
          ],
        },
      ] satisfies Target[]).filter((target) => {
        const sources = Array.isArray(target.src) ? target.src : [target.src];
        return sources.some((pattern) => globSync(pattern).length > 0);
      }),
    }),
  ],
  test: {
    coverage: {
      exclude: [
        'node_modules/',
        'dist/',
        '.next/',
        'build/',
        'src/api/**/*',
        '**/*.config.{js,ts}',
        '**/*.test.{js,ts,jsx,tsx}',
        '**/*.spec.{js,ts,jsx,tsx}',
        '**/test/**',
        '**/tests/**',
      ],
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
    },
    projects: [
      {
        test: {
          environment: 'jsdom',
          globals: true,
          include: [
            'src/**/*.test.ts',
          ],
          name: 'unit',
          server: {
            deps: {
              inline: ['@mui/material', 'react-transition-group'],
            },
          },
          setupFiles: ['./src/test/setup/setup-jsdom.ts'],
          testTimeout: 5000,
        },
      },
    ],
  },
});
