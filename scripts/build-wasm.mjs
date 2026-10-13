#!/usr/bin/env node
/* global console, process */
// Builds the Rust/WASM engine for every package that has one, outputting into wasm
// within the engine directory (e.g. packages/apps/<name>/engine/wasm).
// Run with: node scripts/build-wasm.mjs

import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { homedir } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const packagesDir = join(repoRoot, 'packages', 'apps');

// Prefer rustup's shims over a conflicting Homebrew rustc so the wasm32-unknown-unknown target is found.
const cargoBinDir = join(homedir(), '.cargo', 'bin');
const env = { ...process.env, PATH: `${cargoBinDir}:${process.env.PATH}` };

const wasmPackCheck = spawnSync('wasm-pack', ['--version'], { stdio: 'ignore', env });
if (wasmPackCheck.error || wasmPackCheck.status !== 0) {
  console.error('Error: wasm-pack is not installed. Install it with: cargo install wasm-pack');
  process.exit(1);
}

const packageNames = readdirSync(packagesDir).filter((name) => statSync(join(packagesDir, name)).isDirectory());

for (const packageName of packageNames) {
  const engineDir = join(packagesDir, packageName, 'engine');
  if (!existsSync(join(engineDir, 'Cargo.toml'))) {
    continue;
  }

  const wasmDir = join(engineDir, 'wasm');
  const wasmPackageJsonPath = join(wasmDir, 'package.json');
  const existingWasmPackageJson = existsSync(wasmPackageJsonPath)
    ? JSON.parse(readFileSync(wasmPackageJsonPath, 'utf8'))
    : null;

  console.log(`Building wasm engine for ${packageName}...`);
  const result = spawnSync('wasm-pack', ['build', '--target', 'web', '--out-dir', 'wasm'], {
    cwd: engineDir,
    stdio: 'inherit',
    env,
  });

  if (result.status !== 0) {
    console.error(`Failed to build wasm engine for ${packageName}`);
    process.exit(result.status ?? 1);
  }

  writeFileSync(join(wasmDir, '.gitignore'), '*\n!.gitignore\n!package.json\n');

  const wasmPackageJson = JSON.parse(readFileSync(wasmPackageJsonPath, 'utf8'));
  wasmPackageJson.name = `@rivm-loculus-tools/${packageName}-wasm`;
  if (existingWasmPackageJson?.version) {
    wasmPackageJson.version = existingWasmPackageJson.version;
  }
  wasmPackageJson.license = 'EUPL-1.2';
  writeFileSync(wasmPackageJsonPath, JSON.stringify(wasmPackageJson, null, 2) + '\n');

  rmSync(join(engineDir, 'target'), { recursive: true, force: true });
}

console.log('Done building wasm engines');
