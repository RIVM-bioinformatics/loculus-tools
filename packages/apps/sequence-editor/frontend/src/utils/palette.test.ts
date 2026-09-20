import {
  describe,
  expect,
  it,
} from 'vitest';

import { makeAliViewDefaultPalette } from '../models/palette';

import {
  loadPalette,
  PALETTE_STORAGE_KEY,
  sanitizePalette,
} from './palette';

describe('palette persistence', () => {
  it('migrates invalid versions and preserves valid partial entries', () => {
    const fallback = makeAliViewDefaultPalette();
    const migrated = sanitizePalette({
      name: 'Custom',
      nucleotide: { A: { background: '#123456', foreground: '#654321' } },
      version: 0,
    });
    const partial = sanitizePalette({
      name: 'Custom',
      nucleotide: { A: { background: '#123456', foreground: '#654321' } },
      version: 1,
    });

    expect(migrated).toEqual(fallback);
    expect(partial.name).toBe('Custom');
    expect(partial.nucleotide.A).toEqual({ background: '#123456', foreground: '#654321' });
    expect(partial.nucleotide.C).toEqual(fallback.nucleotide.C);
  });

  it('loads and resets through the versioned storage key', () => {
    const custom = sanitizePalette({ name: 'Saved', nucleotide: {}, version: 1 });
    window.localStorage.setItem(PALETTE_STORAGE_KEY, JSON.stringify(custom));

    expect(loadPalette().name).toBe('Saved');
    window.localStorage.clear();
    expect(loadPalette().name).toBe('AliView Default');
  });
});
