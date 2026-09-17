#!/usr/bin/env node
/* global console, process */
// Builds the Rust/WASM engine for every package that has one, outputting into ../wasm
// relative to the engine directory (e.g. packages/apps/<name>/engine -> packages/apps/<name>/wasm).
// Run with: node scripts/buildWasm.mjs

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

  console.log(`Building wasm engine for ${packageName}...`);
  const result = spawnSync('wasm-pack', ['build', '--target', 'web', '--out-dir', '../wasm'], {
    cwd: engineDir,
    stdio: 'inherit',
    env,
  });

  if (result.status !== 0) {
    console.error(`Failed to build wasm engine for ${packageName}`);
    process.exit(result.status ?? 1);
  }

  const wasmPackageJsonPath = join(packagesDir, packageName, 'wasm', 'package.json');
  const wasmPackageJson = JSON.parse(readFileSync(wasmPackageJsonPath, 'utf8'));
  wasmPackageJson.name = `@rivm-loculus-tools/${packageName}-wasm`;
  writeFileSync(wasmPackageJsonPath, JSON.stringify(wasmPackageJson, null, 2) + '\n');

  rmSync(join(engineDir, 'target'), { recursive: true, force: true });
}

console.log('Done building wasm engines');
