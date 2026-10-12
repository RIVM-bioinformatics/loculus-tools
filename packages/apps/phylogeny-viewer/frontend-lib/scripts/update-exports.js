#!/usr/bin/env node
import { fileURLToPath } from 'url';
import {
  dirname,
  join,
} from 'path';

// eslint-disable-next-line import-x/dynamic-import-chunkname
await import(join(dirname(fileURLToPath(import.meta.url)), '../../../../../scripts/update-exports.mjs'));
