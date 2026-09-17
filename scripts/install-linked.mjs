#!/usr/bin/env node

import { execFileSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { dirname, join, relative, resolve, sep } from 'path';
import { fileURLToPath } from 'url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const uiPath = process.env.GEN_EPIX_UI_PATH ?? '../gen-epix-ui';
const uiRoot = resolve(repoRoot, uiPath);
const appsDirectory = join(repoRoot, 'packages', 'apps');

console.log(`Updating apps with linked dependencies from ${process.env.GEN_EPIX_UI_PATH ?? '../gen-epix-ui'}...`);

for (const appName of readdirSync(appsDirectory)) {
  const packagePath = join(appsDirectory, appName, 'frontend', 'package.json');
  if (!existsSync(packagePath)) continue;

  const packageDirectory = dirname(packagePath);
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  const dependencies = packageJson.dependencies ?? {};
  let changed = false;

  for (const dependencyName of Object.keys(dependencies).filter((name) => name.startsWith('@gen-epix/'))) {
    const packageName = dependencyName.slice('@gen-epix/'.length);
    const linkedPackage = join(uiRoot, 'packages', packageName);
    if (!existsSync(linkedPackage)) continue;

    const linkedPath = relative(packageDirectory, linkedPackage).split(sep).join('/');
    dependencies[dependencyName] = `link:${linkedPath}`;
    changed = true;
  }

  if (!changed) continue;
  packageJson.dependencies = dependencies;
  console.log(`Updating ${packagePath.slice(repoRoot.length + 1)}...`);
  writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
}

console.log('Running pnpm install...');
execFileSync('pnpm', ['install'], { cwd: repoRoot, stdio: 'inherit' });
console.log('Done installing linked dependencies');
