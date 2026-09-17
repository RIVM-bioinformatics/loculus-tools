#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."
GEN_EPIX_UI_PATH="${GEN_EPIX_UI_PATH:-../gen-epix-ui}"

echo "Updating phylogeny-viewer with linked dependencies from ${GEN_EPIX_UI_PATH}..."
GEN_EPIX_UI_PATH="$GEN_EPIX_UI_PATH" node << 'EOF'
const fs = require('fs');
const path = require('path');

const packagePath = 'packages/phylogeny-viewer/frontend/package.json';
const packageDirectory = path.dirname(path.resolve(packagePath));
const uiRoot = path.resolve(process.env.GEN_EPIX_UI_PATH);
const packageNames = ['ui-core', 'ui-core-form', 'ui-core-components', 'ui-phylogenetic-tree'];
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

for (const packageName of packageNames) {
  const linkedPath = path.relative(packageDirectory, path.join(uiRoot, 'packages', packageName)).split(path.sep).join('/');
  packageJson.dependencies[`@gen-epix/${packageName}`] = `link:${linkedPath}`;
}

fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
EOF

echo "Running pnpm install..."
pnpm install

echo "Done installing linked phylogeny-viewer dependencies"
