export const NUCLEOTIDE_SYMBOLS = [
  'A',
  'C',
  'G',
  'T',
  'U',
  'R',
  'Y',
  'S',
  'W',
  'K',
  'M',
  'B',
  'D',
  'H',
  'V',
  'N',
  '-',
  'X',
] as const;

export type NucleotideSymbol = typeof NUCLEOTIDE_SYMBOLS[number];

export const AMINO_ACID_SYMBOLS = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
  '*',
  '-',
] as const;

export type AminoAcidSymbol = typeof AMINO_ACID_SYMBOLS[number];

export interface PaletteEntry {
  background: string;
  foreground: string;
}

export interface PaletteModel {
  aminoAcid: Record<AminoAcidSymbol, PaletteEntry>;
  name: string;
  nucleotide: Record<NucleotideSymbol, PaletteEntry>;
  version: 1;
}

const entry = (foreground: string, background: string): PaletteEntry => ({
  background,
  foreground,
});

const makeEntries = <T extends readonly string[]>(
  symbols: T,
  colors: Record<string, PaletteEntry>,
  fallback: PaletteEntry,
): Record<T[number], PaletteEntry> => Object.fromEntries(
  symbols.map((symbol) => [symbol, colors[symbol] ?? fallback]),
) as Record<T[number], PaletteEntry>;

const aliViewNucleotideColors: Record<string, PaletteEntry> = {
  '-': entry('#808080', '#FAFAFA'),
  A: entry('#018001', '#5ADC5A'),
  C: entry('#0101FF', '#6464FA'),
  G: entry('#000000', '#5A5A5A'),
  T: entry('#FF0101', '#F58282'),
  U: entry('#FF0101', '#F58282'),
  X: entry('#00FFFF', '#FFFFFF'),
};

const aliViewAmbiguityColor = entry('#FF00FF', '#FFFFFF');

const aliViewAminoAcidColors: Record<string, PaletteEntry> = {
  '-': entry('#808080', '#FAFAFA'),
  '*': entry('#FF00FF', '#FFFFFF'),
  B: entry('#FF00FF', '#FFFFFF'),
  J: entry('#FF00FF', '#FFFFFF'),
  X: entry('#00FFFF', '#FFFFFF'),
  Z: entry('#FF00FF', '#FFFFFF'),
};

export const makeAliViewDefaultPalette = (): PaletteModel => ({
  aminoAcid: makeEntries(
    AMINO_ACID_SYMBOLS,
    aliViewAminoAcidColors,
    entry('#000000', '#FFFFFF'),
  ),
  name: 'AliView Default',
  nucleotide: makeEntries(
    NUCLEOTIDE_SYMBOLS,
    { ...aliViewNucleotideColors, B: aliViewAmbiguityColor, D: aliViewAmbiguityColor, H: aliViewAmbiguityColor, K: aliViewAmbiguityColor, M: aliViewAmbiguityColor, N: aliViewAmbiguityColor, R: aliViewAmbiguityColor, S: aliViewAmbiguityColor, V: aliViewAmbiguityColor, W: aliViewAmbiguityColor, Y: aliViewAmbiguityColor },
    aliViewAmbiguityColor,
  ),
  version: 1,
});
