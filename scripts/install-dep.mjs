#!/usr/bin/env node

import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { findPackageJsonPaths } from './find-package-json.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const dependencyVersions = new Map();

function getLatestVersion(dependencyName) {
  if (!dependencyVersions.has(dependencyName)) {
    const version = execFileSync('npm', ['view', dependencyName, 'version'], { encoding: 'utf8' }).trim();
    dependencyVersions.set(dependencyName, version);
  }
  return dependencyVersions.get(dependencyName);
}

for (const packagePath of findPackageJsonPaths(repoRoot)) {
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  let changed = false;

  for (const field of ['dependencies', 'devDependencies']) {
    const dependencies = packageJson[field] ?? {};
    const updates = Object.fromEntries(
      Object.keys(dependencies)
        .filter((dependencyName) => dependencyName.startsWith('@gen-epix/'))
        .map((dependencyName) => [dependencyName, getLatestVersion(dependencyName)]),
    );

    if (Object.keys(updates).length === 0) continue;
    Object.assign(dependencies, updates);
    packageJson[field] = dependencies;
    changed = true;
  }

  if (!changed) continue;
  console.log(`Updating ${packagePath.slice(repoRoot.length + 1)}...`);
  writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
}

console.log('Running pnpm install...');
execFileSync('pnpm', ['install'], { cwd: repoRoot, stdio: 'inherit' });
console.log('Done installing package dependencies');
