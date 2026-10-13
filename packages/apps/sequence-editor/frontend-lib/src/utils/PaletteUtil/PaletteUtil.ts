import type {
  AminoAcidPalette,
  NucleotidePalette,
  PaletteEntry,
} from '../../models/palette';

export const HEX_COLOR_REGEX = /^#[0-9a-f]{6}$/i;

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

  public static paletteEntryFor(
    palette: AminoAcidPalette | NucleotidePalette,
    cellValue: string,
  ): PaletteEntry {
    const paletteColors = palette.paletteColors as Record<string, PaletteEntry>;
    return paletteColors[cellValue] ?? paletteColors.X;
  }
}
