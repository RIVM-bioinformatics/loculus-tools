#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Fetching latest @gen-epix versions from npm..."
UI_CORE_VERSION=$(npm view @gen-epix/ui-core version)
UI_CORE_FORM_VERSION=$(npm view @gen-epix/ui-core-form version)
UI_CORE_COMPONENTS_VERSION=$(npm view @gen-epix/ui-core-components version)
UI_PHYLOGENETIC_TREE_VERSION=$(npm view @gen-epix/ui-phylogenetic-tree version)

echo "Updating packages/phylogeny-viewer/frontend/package.json..."
node -e "const fs=require('fs');const p='packages/phylogeny-viewer/frontend/package.json';const x=JSON.parse(fs.readFileSync(p,'utf8'));Object.assign(x.dependencies,{'@gen-epix/ui-core':'${UI_CORE_VERSION}','@gen-epix/ui-core-form':'${UI_CORE_FORM_VERSION}','@gen-epix/ui-core-components':'${UI_CORE_COMPONENTS_VERSION}','@gen-epix/ui-phylogenetic-tree':'${UI_PHYLOGENETIC_TREE_VERSION}'});fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n');"

echo "Running pnpm install..."
pnpm install

echo "Done installing phylogeny-viewer dependencies"
