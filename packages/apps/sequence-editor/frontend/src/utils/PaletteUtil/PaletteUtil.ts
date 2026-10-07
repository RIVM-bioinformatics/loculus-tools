import {
  AMINO_ACID_SYMBOLS,
  NUCLEOTIDE_SYMBOLS,
} from '../../constants';
import type {
  PaletteEntry,
  PaletteModel,
} from '../../models/palette';

export const PALETTE_STORAGE_KEY = 'sequence-editor.palette.v1';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export class PaletteUtil {
  public static loadPalette(): PaletteModel {
    if (typeof window === 'undefined') {
      return PaletteUtil.makeAliViewDefaultPalette();
    }
    try {
      const stored = window.localStorage.getItem(PALETTE_STORAGE_KEY);
      return stored ? PaletteUtil.sanitizePalette(JSON.parse(stored) as unknown) : PaletteUtil.makeAliViewDefaultPalette();
    } catch {
      return PaletteUtil.makeAliViewDefaultPalette();
    }
  }

  public static makeAliViewDefaultPalette(): PaletteModel {
    const aliViewAmbiguityColor = PaletteUtil.entry('#FF00FF', '#FFFFFF');
    const aliViewNucleotideColors: Record<string, PaletteEntry> = {
      '-': PaletteUtil.entry('#808080', '#FAFAFA'),
      A: PaletteUtil.entry('#018001', '#5ADC5A'),
      C: PaletteUtil.entry('#0101FF', '#6464FA'),
      G: PaletteUtil.entry('#000000', '#5A5A5A'),
      T: PaletteUtil.entry('#FF0101', '#F58282'),
      U: PaletteUtil.entry('#FF0101', '#F58282'),
      X: PaletteUtil.entry('#00FFFF', '#FFFFFF'),
    };
    const aliViewAminoAcidColors: Record<string, PaletteEntry> = {
      '-': PaletteUtil.entry('#808080', '#FAFAFA'),
      '*': PaletteUtil.entry('#FF00FF', '#FFFFFF'),
      B: PaletteUtil.entry('#FF00FF', '#FFFFFF'),
      J: PaletteUtil.entry('#FF00FF', '#FFFFFF'),
      X: PaletteUtil.entry('#00FFFF', '#FFFFFF'),
      Z: PaletteUtil.entry('#FF00FF', '#FFFFFF'),
    };

    return {
      aminoAcid: PaletteUtil.makeEntries(
        AMINO_ACID_SYMBOLS,
        aliViewAminoAcidColors,
        PaletteUtil.entry('#000000', '#FFFFFF'),
      ),
      name: 'AliView Default',
      nucleotide: PaletteUtil.makeEntries(
        NUCLEOTIDE_SYMBOLS,
        { ...aliViewNucleotideColors, B: aliViewAmbiguityColor, D: aliViewAmbiguityColor, H: aliViewAmbiguityColor, K: aliViewAmbiguityColor, M: aliViewAmbiguityColor, N: aliViewAmbiguityColor, R: aliViewAmbiguityColor, S: aliViewAmbiguityColor, V: aliViewAmbiguityColor, W: aliViewAmbiguityColor, Y: aliViewAmbiguityColor },
        aliViewAmbiguityColor,
      ),
      version: 1,
    };
  }

  public static paletteEntryFor(palette: PaletteModel, character: string): PaletteEntry {
    return palette.nucleotide[character as keyof PaletteModel['nucleotide']] ?? palette.nucleotide.X;
  }

  public static sanitizePalette(value: unknown): PaletteModel {
    const fallback = PaletteUtil.makeAliViewDefaultPalette();
    if (!PaletteUtil.isRecord(value) || value.version !== 1) {
      return fallback;
    }
    return {
      aminoAcid: PaletteUtil.mergeEntries(value.aminoAcid, fallback.aminoAcid),
      name: typeof value.name === 'string' && value.name.trim() ? value.name : fallback.name,
      nucleotide: PaletteUtil.mergeEntries(value.nucleotide, fallback.nucleotide),
      version: 1,
    };
  }

  public static savePalette(palette: PaletteModel): void {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(PALETTE_STORAGE_KEY, JSON.stringify(palette));
    } catch {
      // Storage can be unavailable in private browsing or restricted embeds.
    }
  }

  private static entry(foreground: string, background: string): PaletteEntry {
    return { background, foreground };
  }

  private static isPaletteEntry(value: unknown): value is PaletteEntry {
    return PaletteUtil.isRecord(value)
      && typeof value.foreground === 'string'
      && typeof value.background === 'string'
      && HEX_COLOR.test(value.foreground)
      && HEX_COLOR.test(value.background);
  }

  private static isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private static makeEntries<T extends readonly string[]>(
    symbols: T,
    colors: Record<string, PaletteEntry>,
    fallback: PaletteEntry,
  ): Record<T[number], PaletteEntry> {
    return Object.fromEntries(
      symbols.map((symbol) => [symbol, colors[symbol] ?? fallback]),
    ) as Record<T[number], PaletteEntry>;
  }

  private static mergeEntries(
    source: unknown,
    fallback: Record<string, PaletteEntry>,
  ): Record<string, PaletteEntry> {
    const sourceEntries = PaletteUtil.isRecord(source) ? source : {};
    return Object.fromEntries(
      Object.entries(fallback).map(([symbol, defaultEntry]) => [
        symbol,
        PaletteUtil.isPaletteEntry(sourceEntries[symbol]) ? sourceEntries[symbol] : { ...defaultEntry },
      ]),
    );
  }
}
