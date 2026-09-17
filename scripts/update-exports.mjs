#!/usr/bin/env node
/* global console, process */
// Regenerates exports and publishConfig.exports in package.json from src/ structure.
// Run with: node scripts/update-exports.js  (or via pnpm run update-exports)
// Must be invoked from the package root directory (process.cwd() is used as the package root).

import {
  existsSync,
  globSync,
  readFileSync,
  writeFileSync,
} from 'fs';
import {
  basename,
  dirname,
  join,
  relative,
} from 'path';

const pkgDir = process.cwd();
const srcDir = join(pkgDir, 'src');
const pkgPath = join(pkgDir, 'package.json');

const raw = readFileSync(pkgPath, 'utf8');
const pkg = JSON.parse(raw);

// index.ts-based entries: all known subdirectory families across packages
const indexBasedKeys = globSync([
  join(srcDir, 'classes', '**', 'index.ts'),
  join(srcDir, 'components', '**', 'index.ts'),
  join(srcDir, 'constants', '**', 'index.ts'),
  join(srcDir, 'dataHooks', '**', 'index.ts'),
  join(srcDir, 'hoc', '**', 'index.ts'),
  join(srcDir, 'hooks', '**', 'index.ts'),
  join(srcDir, 'locale', '**', 'index.ts'),
  join(srcDir, 'pages', '**', 'index.ts'),
  join(srcDir, 'routes', '**', 'index.ts'),
  join(srcDir, 'stores', '**', 'index.ts'),
  join(srcDir, 'theme', '**', 'index.ts'),
  join(srcDir, 'utils', '**', 'index.ts'),
]).map((file) => relative(srcDir, dirname(file)));

// flat .ts entries: key = file path without extension
const flatKeys = globSync([join(srcDir, 'models', '*.ts'), join(srcDir, 'constants', '*.ts'), join(srcDir, 'setup', '*.ts')])
  .filter((file) => !file.endsWith('/index.ts'))
  .map((file) => relative(srcDir, file).replace(/\.ts$/, ''));

const flatKeySet = new Set(flatKeys);
const componentKeys = [...indexBasedKeys, ...flatKeys].sort();

// Check for a types declaration file matching the package name (e.g., src/@types/ui.d.ts for @gen-epix/ui)
const pkgBaseName = basename(pkg.name.replace(/^@[^/]+\//, ''));
const typesDeclarationFile = join(srcDir, '@types', `${pkgBaseName}.d.ts`);
const hasTypesEntry = existsSync(typesDeclarationFile);

// exports: points to source files (used in workspace / dev)
pkg.exports = {
  ...(hasTypesEntry ? { './types': { types: `./src/@types/${pkgBaseName}.d.ts`, import: `./src/@types/${pkgBaseName}.d.ts` } } : {}),
  ...Object.fromEntries(
    componentKeys.map((key) => [
      `./${key}`,
      flatKeySet.has(key)
        ? { types: `./src/${key}.ts`, import: `./src/${key}.ts` }
        : { types: `./src/${key}/index.ts`, import: `./src/${key}/index.ts` },
    ]),
  ),
};

// publishConfig.exports: points to dist files (used after publish)
pkg.publishConfig.exports = {
  ...(hasTypesEntry ? { './types': { types: `./dist/@types/${pkgBaseName}.d.ts`, import: `./dist/@types/${pkgBaseName}.d.ts` } } : {}),
  ...Object.fromEntries(
    componentKeys.map((key) => [
      `./${key}`,
      flatKeySet.has(key)
        ? { types: `./dist/${key}.d.ts`, import: `./dist/${key}.js` }
        : { types: `./dist/${key}/index.d.ts`,import: `./dist/${key}/index.js` },
    ]),
  ),
};

const indentMatch = raw.match(/^(\s+)"/m);
const indent = indentMatch ? indentMatch[1] : '  ';
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, indent)}\n`, 'utf8');

console.log(`Updated exports for ${componentKeys.length} components:`);
for (const key of componentKeys) {
  console.log(`  ./${key}`);
}
