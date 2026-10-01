#!/usr/bin/env node

import { execFileSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, relative, resolve, sep } from 'path';
import { fileURLToPath } from 'url';
import { findPackageJsonPaths } from './find-package-json.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const uiPath = process.env.GEN_EPIX_UI_PATH ?? '../gen-epix-ui';
const uiRoot = resolve(repoRoot, uiPath);

console.log(`Updating package manifests with linked dependencies from ${process.env.GEN_EPIX_UI_PATH ?? '../gen-epix-ui'}...`);

for (const packagePath of findPackageJsonPaths(repoRoot)) {
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
