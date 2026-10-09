import { readdirSync } from 'fs';
import { join } from 'path';

const ignoredDirectories = new Set(['.git', 'node_modules']);

export function findPackageJsonPaths(rootDirectory) {
  const packagePaths = [];

  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = join(directory, entry.name);

      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) visit(entryPath);
        continue;
      }

      if (entry.isFile() && entry.name === 'package.json') packagePaths.push(entryPath);
    }
  }

  visit(rootDirectory);
  return packagePaths.sort();
}
