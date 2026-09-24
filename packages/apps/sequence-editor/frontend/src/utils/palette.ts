import { makeAliViewDefaultPalette } from '../models/palette';
import type {
  PaletteEntry,
  PaletteModel,
} from '../models/palette';

export const PALETTE_STORAGE_KEY = 'sequence-editor.palette.v1';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const isPaletteEntry = (value: unknown): value is PaletteEntry => (
  isRecord(value)
  && typeof value.foreground === 'string'
  && typeof value.background === 'string'
  && HEX_COLOR.test(value.foreground)
  && HEX_COLOR.test(value.background)
);

const mergeEntries = (
  source: unknown,
  fallback: Record<string, PaletteEntry>,
): Record<string, PaletteEntry> => {
  const sourceEntries = isRecord(source) ? source : {};
  return Object.fromEntries(
    Object.entries(fallback).map(([symbol, defaultEntry]) => [
      symbol,
      isPaletteEntry(sourceEntries[symbol]) ? sourceEntries[symbol] : { ...defaultEntry },
    ]),
  );
};

export const sanitizePalette = (value: unknown): PaletteModel => {
  const fallback = makeAliViewDefaultPalette();
  if (!isRecord(value) || value.version !== 1) {
    return fallback;
  }
  return {
    aminoAcid: mergeEntries(value.aminoAcid, fallback.aminoAcid),
    name: typeof value.name === 'string' && value.name.trim() ? value.name : fallback.name,
    nucleotide: mergeEntries(value.nucleotide, fallback.nucleotide),
    version: 1,
  };
};

export const loadPalette = (): PaletteModel => {
  if (typeof window === 'undefined') {
    return makeAliViewDefaultPalette();
  }
  try {
    const stored = window.localStorage.getItem(PALETTE_STORAGE_KEY);
    return stored ? sanitizePalette(JSON.parse(stored) as unknown) : makeAliViewDefaultPalette();
  } catch {
    return makeAliViewDefaultPalette();
  }
};

export const savePalette = (palette: PaletteModel): void => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(PALETTE_STORAGE_KEY, JSON.stringify(palette));
  } catch {
    // Storage can be unavailable in private browsing or restricted embeds.
  }
};

export const paletteEntryFor = (palette: PaletteModel, character: string): PaletteEntry => (
  palette.nucleotide[character as keyof PaletteModel['nucleotide']] ?? palette.nucleotide.X
);
