export type AminoAcidSymbol = '-' | '*' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z';
export type NucleotideSymbol = '-' | 'A' | 'B' | 'C' | 'D' | 'G' | 'H' | 'K' | 'M' | 'N' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y';

export interface PaletteEntry {
  background: string;
  foreground: string;
}

export interface PaletteModel {
  aminoAcid: Record<AminoAcidSymbol, PaletteEntry>;
  name: string;
  nucleotide: Record<NucleotideSymbol, PaletteEntry>;
  version: number;
}
