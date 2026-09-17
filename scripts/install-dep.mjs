#!/usr/bin/env node

import { execFileSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const appsDirectory = join(repoRoot, 'packages', 'apps');
const dependencyVersions = new Map();

function getLatestVersion(dependencyName) {
  if (!dependencyVersions.has(dependencyName)) {
    const version = execFileSync('npm', ['view', dependencyName, 'version'], { encoding: 'utf8' }).trim();
    dependencyVersions.set(dependencyName, version);
  }
  return dependencyVersions.get(dependencyName);
}

for (const appName of readdirSync(appsDirectory)) {
  const packagePath = join(appsDirectory, appName, 'frontend', 'package.json');
  if (!existsSync(packagePath)) continue;

  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  const dependencies = packageJson.dependencies ?? {};
  const updates = Object.fromEntries(
    Object.keys(dependencies)
      .filter((dependencyName) => dependencyName.startsWith('@gen-epix/'))
      .map((dependencyName) => [dependencyName, getLatestVersion(dependencyName)]),
  );

  if (Object.keys(updates).length === 0) continue;
  Object.assign(dependencies, updates);
  packageJson.dependencies = dependencies;
  console.log(`Updating ${packagePath.slice(repoRoot.length + 1)}...`);
  writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
}

console.log('Running pnpm install...');
execFileSync('pnpm', ['install'], { cwd: repoRoot, stdio: 'inherit' });
console.log('Done installing package dependencies');
