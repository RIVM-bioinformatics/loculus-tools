#!/usr/bin/env node

import {
  existsSync,
  globSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import {
  dirname,
  extname,
  join,
  normalize,
  relative,
  resolve,
} from 'node:path';

const rootDir = process.cwd();
const sourceFiles = globSync('**/*.{ts,tsx}', {
  cwd: rootDir,
  ignore: ['**/node_modules/**', '**/dist/**', '**/target/**', '**/.git/**'],
  absolute: true,
});

const moduleSpecifierPattern = /(\bimport\b(?!\s*\()[\s\S]*?\bfrom\s*|\bimport\s*\(\s*)(['"])([^'"]+)\2/g;
const sourceExtensions = ['.ts', '.tsx'];

const formatLocation = (filePath, source, offset) => {
  const line = source.slice(0, offset).split('\n').length;
  return `${relative(rootDir, filePath)}:${line}`;
};

const resolveSourceFile = (filePath) => {
  if (existsSync(filePath) && sourceExtensions.includes(extname(filePath))) {
    return filePath;
  }
  for (const extension of sourceExtensions) {
    if (existsSync(`${filePath}${extension}`)) {
      return `${filePath}${extension}`;
    }
  }
  return null;
};

const resolvesToSameFile = (indexDir, specifier, targetFile) => {
  const resolved = resolveSourceFile(resolve(indexDir, specifier));
  return resolved !== null && normalize(resolved) === normalize(targetFile);
};

const indexExportsFile = (indexFile, targetFile) => {
  const indexSource = readFileSync(indexFile, 'utf8');
  return [...indexSource.matchAll(/\bexport\b[\s\S]*?\bfrom\s*(['"])([^'"]+)\1/g)].some((match) => (
    resolvesToSameFile(dirname(indexFile), match[2], targetFile)
  ));
};

const getShortenedSpecifier = (sourceFile, specifier) => {
  if (!specifier.startsWith('.')) {
    return null;
  }

  const importedPath = resolve(dirname(sourceFile), specifier);
  const importedName = importedPath.split('/').pop();
  if (!importedName || importedName === 'index') {
    return null;
  }

  const importedDirectory = dirname(importedPath);
  if (importedName !== importedDirectory.split('/').pop()) {
    return null;
  }

  const indexFile = join(importedDirectory, 'index.ts');
  if (!existsSync(indexFile)) {
    return { warning: `No index.ts for '${specifier}'.` };
  }

  const targetFile = resolveSourceFile(importedPath);
  if (!targetFile || !indexExportsFile(indexFile, targetFile)) {
    return { warning: `index.ts does not export '${specifier}'.` };
  }

  const shortenedSpecifier = specifier.slice(0, -importedName.length - 1);
  return { replacement: shortenedSpecifier || '.' };
};

let updatedFiles = 0;
let updatedImports = 0;
let warningCount = 0;

for (const sourceFile of sourceFiles) {
  const source = readFileSync(sourceFile, 'utf8');
  let updatedSource = source;
  const replacements = [];

  for (const match of source.matchAll(moduleSpecifierPattern)) {
    const result = getShortenedSpecifier(sourceFile, match[3]);
    if (!result) {
      continue;
    }
    if (result.warning) {
      console.warn(`Warning: ${formatLocation(sourceFile, source, match.index)}: ${result.warning}`);
      warningCount += 1;
      continue;
    }
    replacements.push({
      end: match.index + match[0].length,
      start: match.index,
      value: match[0].replace(match[3], result.replacement),
    });
  }

  for (const replacement of replacements.reverse()) {
    updatedSource = `${updatedSource.slice(0, replacement.start)}${replacement.value}${updatedSource.slice(replacement.end)}`;
    updatedImports += 1;
  }

  if (updatedSource !== source) {
    writeFileSync(sourceFile, updatedSource, 'utf8');
    updatedFiles += 1;
  }
}

console.log(`Shortened ${updatedImports} imports in ${updatedFiles} files.`);
if (warningCount > 0) {
  console.warn(`Found ${warningCount} import paths that need attention.`);
}
