@echo off
setlocal

cd /d "%~dp0.."
if "%GEN_EPIX_UI_PATH%"=="" set "GEN_EPIX_UI_PATH=..\gen-epix-ui"

echo Updating phylogeny-viewer with linked dependencies from %GEN_EPIX_UI_PATH%...
set "GEN_EPIX_UI_PATH=%GEN_EPIX_UI_PATH:\=/%"
node -e "const fs=require('fs'),path=require('path'),p='packages/phylogeny-viewer/frontend/package.json',x=JSON.parse(fs.readFileSync(p,'utf8')),d=path.dirname(path.resolve(p)),r=path.resolve(process.env.GEN_EPIX_UI_PATH);for(const n of ['ui-core','ui-core-components','ui-phylogenetic-tree'])x.dependencies['@gen-epix/'+n]='link:'+path.relative(d,path.join(r,'packages',n)).replace(/\\/g,'/');fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n');"

echo Running pnpm install...
pnpm install

echo Done installing linked phylogeny-viewer dependencies
endlocal
