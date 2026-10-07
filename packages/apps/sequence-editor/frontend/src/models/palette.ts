// eslint-disable-next-line @typescript-eslint/naming-convention
export enum AminoAcidSymbol {
  A = 'A',
  C = 'C',
  D = 'D',
  E = 'E',
  F = 'F',
  G = 'G',
  GAP = '-',
  H = 'H',
  I = 'I',
  K = 'K',
  L = 'L',
  M = 'M',
  N = 'N',
  P = 'P',
  Q = 'Q',
  R = 'R',
  S = 'S',
  STOP = '*',
  T = 'T',
  V = 'V',
  W = 'W',
  X = 'X',
  Y = 'Y',
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export enum NucleotideSymbol {
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
  G = 'G',
  GAP = '-',
  H = 'H',
  K = 'K',
  M = 'M',
  N = 'N',
  R = 'R',
  S = 'S',
  T = 'T',
  U = 'U',
  UNKNOWN = 'X',
  V = 'V',
  W = 'W',
  Y = 'Y',
}

export type AminoAcidPalette = {
  name: string;
  paletteColors: AminoAcidPaletteColors;
};
export type AminoAcidPaletteColors = Record<AminoAcidSymbol, PaletteEntry>;

export type NucleotidePalette = {
  name: string;
  paletteColors: NucleotidePaletteColors;
};

export type NucleotidePaletteColors = Record<NucleotideSymbol, PaletteEntry>;

export type PaletteEntry = {
  background: string;
  backgroundSelected: string;
  foreground: string;
  foregroundSelected: string;
};
