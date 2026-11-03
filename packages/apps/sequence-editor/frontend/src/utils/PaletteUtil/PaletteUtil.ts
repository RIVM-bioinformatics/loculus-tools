import {
  AminoAcidSymbol,
  CUSTOM_PALETTE_NAME,
  NucleotideSymbol,
} from '../../models/palette.models';
import type {
  AminoAcidPalette,
  NucleotidePalette,
  PaletteEntry,
} from '../../models/palette.models';

export const HEX_COLOR_REGEX = /^#[0-9a-f]{6}$/i;

const PALETTE_ENTRY_FIELDS: readonly (keyof PaletteEntry)[] = [
  'background',
  'backgroundSelected',
  'foreground',
  'foregroundSelected',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasExactKeys = (record: Record<string, unknown>, expectedKeys: readonly string[]): boolean =>
  Object.keys(record).length === expectedKeys.length
  && expectedKeys.every((key) => Object.prototype.hasOwnProperty.call(record, key));

const isPaletteEntry = (value: unknown): value is PaletteEntry => {
  if (!isRecord(value) || !hasExactKeys(value, PALETTE_ENTRY_FIELDS)) {
    return false;
  }

  return PALETTE_ENTRY_FIELDS.every((field) => {
    const color = value[field];
    return typeof color === 'string' && HEX_COLOR_REGEX.test(color);
  });
};

const isPaletteForSymbols = (value: unknown, symbols: readonly string[]): boolean => {
  if (
    !isRecord(value)
    || typeof value.name !== 'string'
    || value.name.trim().length === 0
    || (Object.prototype.hasOwnProperty.call(value, '$schema') && typeof value.$schema !== 'string')
    || !isRecord(value.paletteColors)
    || !hasExactKeys(value.paletteColors, symbols)
  ) {
    return false;
  }

  const { paletteColors } = value;
  return symbols.every((symbol) => isPaletteEntry(paletteColors[symbol]));
};

export class PaletteUtil {
  public static createEntry(
    background: string,
    foreground: string,
    backgroundSelected: string = background,
    foregroundSelected: string = foreground,
  ): PaletteEntry {
    return {
      background,
      backgroundSelected,
      foreground,
      foregroundSelected,
    };
  }

  public static isAminoAcidPalette(value: unknown): value is AminoAcidPalette {
    return isPaletteForSymbols(value, Object.values(AminoAcidSymbol));
  }

  public static isNucleotidePalette(value: unknown): value is NucleotidePalette {
    return isPaletteForSymbols(value, Object.values(NucleotideSymbol));
  }

  public static paletteEntryFor(
    palette: AminoAcidPalette | NucleotidePalette,
    cellValue: string,
  ): PaletteEntry {
    const paletteColors = palette.paletteColors as Record<string, PaletteEntry>;
    return paletteColors[cellValue] ?? paletteColors.X;
  }

  public static parseAminoAcidPalette(value: unknown): AminoAcidPalette {
    if (!PaletteUtil.isAminoAcidPalette(value)) {
      throw new Error('Invalid amino-acid palette. Check that every symbol has four valid #RRGGBB colors.');
    }

    return {
      ...value,
      name: CUSTOM_PALETTE_NAME,
    };
  }

  public static parseNucleotidePalette(value: unknown): NucleotidePalette {
    if (!PaletteUtil.isNucleotidePalette(value)) {
      throw new Error('Invalid nucleotide palette. Check that every symbol has four valid #RRGGBB colors.');
    }

    return {
      ...value,
      name: CUSTOM_PALETTE_NAME,
    };
  }
}
