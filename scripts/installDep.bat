@echo off
setlocal

cd /d "%~dp0.."

echo Fetching latest @gen-epix versions from npm...
for /f %%i in ('npm view @gen-epix/ui-core version') do set UI_CORE_VERSION=%%i
for /f %%i in ('npm view @gen-epix/ui-core-components version') do set UI_CORE_COMPONENTS_VERSION=%%i
for /f %%i in ('npm view @gen-epix/ui-phylogenetic-tree version') do set UI_PHYLOGENETIC_TREE_VERSION=%%i

echo Updating packages/phylogeny-viewer/frontend/package.json...
node -e "const fs=require('fs'),e=process.env,p='packages/phylogeny-viewer/frontend/package.json',x=JSON.parse(fs.readFileSync(p,'utf8'));Object.assign(x.dependencies,{'@gen-epix/ui-core':e.UI_CORE_VERSION,'@gen-epix/ui-core-components':e.UI_CORE_COMPONENTS_VERSION,'@gen-epix/ui-phylogenetic-tree':e.UI_PHYLOGENETIC_TREE_VERSION});fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n');"

echo Running pnpm install...
pnpm install

echo Done installing phylogeny-viewer dependencies
endlocal
