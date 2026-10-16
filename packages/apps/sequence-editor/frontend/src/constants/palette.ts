import {
  AminoAcidSymbol,
  NucleotideSymbol,
} from '../models/palette.models';
import type {
  AminoAcidPalette,
  AminoAcidPaletteColors,
  NucleotidePalette,
  NucleotidePaletteColors,
} from '../models/palette.models';
import { PaletteUtil } from '../utils/PaletteUtil';

export const NUCLEOTIDE_SYMBOLS: readonly NucleotideSymbol[] = [
  NucleotideSymbol.A,
  NucleotideSymbol.C,
  NucleotideSymbol.G,
  NucleotideSymbol.T,
  NucleotideSymbol.U,
  NucleotideSymbol.R,
  NucleotideSymbol.Y,
  NucleotideSymbol.S,
  NucleotideSymbol.W,
  NucleotideSymbol.K,
  NucleotideSymbol.M,
  NucleotideSymbol.B,
  NucleotideSymbol.D,
  NucleotideSymbol.H,
  NucleotideSymbol.V,
  NucleotideSymbol.N,
  NucleotideSymbol.GAP,
  NucleotideSymbol.UNKNOWN,
] as const;

export const AMINO_ACID_SYMBOLS: readonly AminoAcidSymbol[] = [
  AminoAcidSymbol.A,
  AminoAcidSymbol.C,
  AminoAcidSymbol.D,
  AminoAcidSymbol.E,
  AminoAcidSymbol.F,
  AminoAcidSymbol.G,
  AminoAcidSymbol.H,
  AminoAcidSymbol.I,
  AminoAcidSymbol.K,
  AminoAcidSymbol.L,
  AminoAcidSymbol.M,
  AminoAcidSymbol.N,
  AminoAcidSymbol.P,
  AminoAcidSymbol.Q,
  AminoAcidSymbol.R,
  AminoAcidSymbol.S,
  AminoAcidSymbol.T,
  AminoAcidSymbol.V,
  AminoAcidSymbol.W,
  AminoAcidSymbol.Y,
  AminoAcidSymbol.X,
  AminoAcidSymbol.STOP,
  AminoAcidSymbol.GAP,
] as const;

export const ALI_VIEW_DEFAULT_AMINO_ACID_PALETTE_COLORS: AminoAcidPaletteColors = {
  [AminoAcidSymbol.A]: PaletteUtil.createEntry('#276EB7', '#000000', '#3769FF', '#808080'),
  [AminoAcidSymbol.C]: PaletteUtil.createEntry('#E68080', '#000000', '#FFB6B6', '#808080'),
  [AminoAcidSymbol.D]: PaletteUtil.createEntry('#CC4DCC', '#000000', '#FF6EFF', '#808080'),
  [AminoAcidSymbol.E]: PaletteUtil.createEntry('#984097', '#000000', '#D95BD7', '#808080'),
  [AminoAcidSymbol.F]: PaletteUtil.createEntry('#1980E6', '#000000', '#23B6FF', '#808080'),
  [AminoAcidSymbol.G]: PaletteUtil.createEntry('#E6994D', '#000000', '#FFDA6E', '#808080'),
  [AminoAcidSymbol.GAP]: PaletteUtil.createEntry('#E6E6E6', '#404040', '#FFFFFF', '#808080'),
  [AminoAcidSymbol.H]: PaletteUtil.createEntry('#19B3B3', '#000000', '#23FFFF', '#808080'),
  [AminoAcidSymbol.I]: PaletteUtil.createEntry('#4EA0F3', '#000000', '#6FE4FF', '#808080'),
  [AminoAcidSymbol.K]: PaletteUtil.createEntry('#E63319', '#000000', '#FF4823', '#808080'),
  [AminoAcidSymbol.L]: PaletteUtil.createEntry('#78A6D5', '#000000', '#ABEDFF', '#808080'),
  [AminoAcidSymbol.M]: PaletteUtil.createEntry('#0F549B', '#000000', '#1578DD', '#808080'),
  [AminoAcidSymbol.N]: PaletteUtil.createEntry('#19CC19', '#000000', '#23FF23', '#808080'),
  [AminoAcidSymbol.P]: PaletteUtil.createEntry('#CCCC00', '#000000', '#FFFF00', '#808080'),
  [AminoAcidSymbol.Q]: PaletteUtil.createEntry('#5CED5C', '#000000', '#83FF83', '#808080'),
  [AminoAcidSymbol.R]: PaletteUtil.createEntry('#F6442C', '#000000', '#FF613E', '#808080'),
  [AminoAcidSymbol.S]: PaletteUtil.createEntry('#029602', '#000000', '#03D603', '#808080'),
  [AminoAcidSymbol.STOP]: PaletteUtil.createEntry('#404040', '#00FFFF', '#5B5B5B', '#808080'),
  [AminoAcidSymbol.T]: PaletteUtil.createEntry('#45C945', '#000000', '#62FF62', '#808080'),
  [AminoAcidSymbol.V]: PaletteUtil.createEntry('#047DF9', '#000000', '#05B2FF', '#808080'),
  [AminoAcidSymbol.W]: PaletteUtil.createEntry('#0355A9', '#000000', '#0479F1', '#808080'),
  [AminoAcidSymbol.X]: PaletteUtil.createEntry('#FFFFFF', '#00FFFF', '#FFFFFF', '#808080'),
  [AminoAcidSymbol.Y]: PaletteUtil.createEntry('#14C6C8', '#000000', '#1CFFFF', '#808080'),
};

export const ALI_VIEW_DEFAULT_NUCLEOTIDE_PALETTE_COLORS: NucleotidePaletteColors = {
  [NucleotideSymbol.A]: PaletteUtil.createEntry('#5ADC5A', '#018001', '#058705', '#97FF97'),
  [NucleotideSymbol.B]: PaletteUtil.createEntry('#FFFFFF', '#FF00FF', '#AAAAAA', '#FF96FF'),
  [NucleotideSymbol.C]: PaletteUtil.createEntry('#6464FA', '#0101FF', '#0F0FA5', '#9797FF'),
  [NucleotideSymbol.D]: PaletteUtil.createEntry('#FFFFFF', '#FF00FF', '#AAAAAA', '#FF96FF'),
  [NucleotideSymbol.G]: PaletteUtil.createEntry('#5A5A5A', '#000000', '#050505', '#969696'),
  [NucleotideSymbol.GAP]: PaletteUtil.createEntry('#FAFAFA', '#868686', '#A5A5A5', '#FFFFFF'),
  [NucleotideSymbol.H]: PaletteUtil.createEntry('#FFFFFF', '#FF00FF', '#AAAAAA', '#FF96FF'),
  [NucleotideSymbol.K]: PaletteUtil.createEntry('#FFFFFF', '#FF00FF', '#AAAAAA', '#FF96FF'),
  [NucleotideSymbol.M]: PaletteUtil.createEntry('#FFFFFF', '#FF00FF', '#AAAAAA', '#FF96FF'),
  [NucleotideSymbol.N]: PaletteUtil.createEntry('#FFFFFF', '#FF00FF', '#AAAAAA', '#FF96FF'),
  [NucleotideSymbol.R]: PaletteUtil.createEntry('#FFFFFF', '#FF00FF', '#AAAAAA', '#FF96FF'),
  [NucleotideSymbol.S]: PaletteUtil.createEntry('#FFFFFF', '#FF00FF', '#AAAAAA', '#FF96FF'),
  [NucleotideSymbol.T]: PaletteUtil.createEntry('#F58282', '#FF0101', '#A02D2D', '#FF9797'),
  [NucleotideSymbol.U]: PaletteUtil.createEntry('#F58282', '#FF0101', '#A02D2D', '#FF9797'),
  [NucleotideSymbol.UNKNOWN]: PaletteUtil.createEntry('#FFFFFF', '#00FFFF', '#AAAAAA', '#96FFFF'),
  [NucleotideSymbol.V]: PaletteUtil.createEntry('#FFFFFF', '#FF00FF', '#AAAAAA', '#FF96FF'),
  [NucleotideSymbol.W]: PaletteUtil.createEntry('#FFFFFF', '#FF00FF', '#AAAAAA', '#FF96FF'),
  [NucleotideSymbol.Y]: PaletteUtil.createEntry('#FFFFFF', '#FF00FF', '#AAAAAA', '#FF96FF'),
};

export const ALI_VIEW_FAST_NUCLEOTIDE_PALETTE_COLORS: NucleotidePaletteColors = {
  ...ALI_VIEW_DEFAULT_NUCLEOTIDE_PALETTE_COLORS,
  [NucleotideSymbol.A]: PaletteUtil.createEntry('#5ADC5A', '#2C2C2C', '#058705', '#1E1E1E'),
  [NucleotideSymbol.B]: PaletteUtil.createEntry('#FFFFFF', '#2C2C2C', '#AAAAAA', '#1E1E1E'),
  [NucleotideSymbol.C]: PaletteUtil.createEntry('#6464FA', '#2C2C2C', '#0F0FA5', '#1E1E1E'),
  [NucleotideSymbol.D]: PaletteUtil.createEntry('#FFFFFF', '#2C2C2C', '#AAAAAA', '#1E1E1E'),
  [NucleotideSymbol.G]: PaletteUtil.createEntry('#5A5A5A', '#2C2C2C', '#050505', '#1E1E1E'),
  [NucleotideSymbol.GAP]: PaletteUtil.createEntry('#FAFAFA', '#2C2C2C', '#A5A5A5', '#1E1E1E'),
  [NucleotideSymbol.H]: PaletteUtil.createEntry('#FFFFFF', '#2C2C2C', '#AAAAAA', '#1E1E1E'),
  [NucleotideSymbol.K]: PaletteUtil.createEntry('#FFFFFF', '#2C2C2C', '#AAAAAA', '#1E1E1E'),
  [NucleotideSymbol.M]: PaletteUtil.createEntry('#FFFFFF', '#2C2C2C', '#AAAAAA', '#1E1E1E'),
  [NucleotideSymbol.N]: PaletteUtil.createEntry('#FFFFFF', '#2C2C2C', '#AAAAAA', '#1E1E1E'),
  [NucleotideSymbol.R]: PaletteUtil.createEntry('#FFFFFF', '#2C2C2C', '#AAAAAA', '#1E1E1E'),
  [NucleotideSymbol.S]: PaletteUtil.createEntry('#FFFFFF', '#2C2C2C', '#AAAAAA', '#1E1E1E'),
  [NucleotideSymbol.T]: PaletteUtil.createEntry('#F58282', '#2C2C2C', '#A02D2D', '#1E1E1E'),
  [NucleotideSymbol.U]: PaletteUtil.createEntry('#F58282', '#2C2C2C', '#A02D2D', '#1E1E1E'),
  [NucleotideSymbol.UNKNOWN]: PaletteUtil.createEntry('#FFFFFF', '#2C2C2C', '#AAAAAA', '#1E1E1E'),
  [NucleotideSymbol.V]: PaletteUtil.createEntry('#FFFFFF', '#2C2C2C', '#AAAAAA', '#1E1E1E'),
  [NucleotideSymbol.W]: PaletteUtil.createEntry('#FFFFFF', '#2C2C2C', '#AAAAAA', '#1E1E1E'),
  [NucleotideSymbol.Y]: PaletteUtil.createEntry('#FFFFFF', '#2C2C2C', '#AAAAAA', '#1E1E1E'),
};

export const ALI_VIEW_SEA_VIEW_NUCLEOTIDE_PALETTE_COLORS: NucleotidePaletteColors = {
  [NucleotideSymbol.A]: PaletteUtil.createEntry('#FF0000', '#000000', '#870000', '#040404'),
  [NucleotideSymbol.B]: PaletteUtil.createEntry('#9D9D9D', '#000000', '#6D6D6D', '#040404'),
  [NucleotideSymbol.C]: PaletteUtil.createEntry('#00FF00', '#000000', '#008700', '#040404'),
  [NucleotideSymbol.D]: PaletteUtil.createEntry('#9D9D9D', '#000000', '#6D6D6D', '#040404'),
  [NucleotideSymbol.G]: PaletteUtil.createEntry('#FFFF00', '#000000', '#878700', '#040404'),
  [NucleotideSymbol.GAP]: PaletteUtil.createEntry('#E0E0E0', '#000000', '#9B9B9B', '#040404'),
  [NucleotideSymbol.H]: PaletteUtil.createEntry('#9D9D9D', '#000000', '#6D6D6D', '#040404'),
  [NucleotideSymbol.K]: PaletteUtil.createEntry('#9D9D9D', '#000000', '#6D6D6D', '#040404'),
  [NucleotideSymbol.M]: PaletteUtil.createEntry('#9D9D9D', '#000000', '#6D6D6D', '#040404'),
  [NucleotideSymbol.N]: PaletteUtil.createEntry('#9D9D9D', '#000000', '#6D6D6D', '#040404'),
  [NucleotideSymbol.R]: PaletteUtil.createEntry('#9D9D9D', '#000000', '#6D6D6D', '#040404'),
  [NucleotideSymbol.S]: PaletteUtil.createEntry('#9D9D9D', '#000000', '#6D6D6D', '#040404'),
  [NucleotideSymbol.T]: PaletteUtil.createEntry('#0000FF', '#000000', '#000087', '#040404'),
  [NucleotideSymbol.U]: PaletteUtil.createEntry('#0000FF', '#000000', '#000087', '#040404'),
  [NucleotideSymbol.UNKNOWN]: PaletteUtil.createEntry('#E0E0E0', '#00FFFF', '#9B9B9B', '#040404'),
  [NucleotideSymbol.V]: PaletteUtil.createEntry('#9D9D9D', '#000000', '#6D6D6D', '#040404'),
  [NucleotideSymbol.W]: PaletteUtil.createEntry('#9D9D9D', '#000000', '#6D6D6D', '#040404'),
  [NucleotideSymbol.Y]: PaletteUtil.createEntry('#9D9D9D', '#000000', '#6D6D6D', '#040404'),
};

export const ALI_VIEW_SEA_VIEW_AMINO_ACID_PALETTE_COLORS: AminoAcidPaletteColors = {
  ...ALI_VIEW_DEFAULT_AMINO_ACID_PALETTE_COLORS,
};

const ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS: Record<string, string> = {
  A: '#80B3E6',
  C: '#80B3E6',
  D: '#CC4DCC',
  E: '#CC4DCC',
  F: '#80B3E6',
  G: '#E6994D',
  H: '#1AB3B3',
  I: '#80B3E6',
  K: '#E6331A',
  L: '#80B3E6',
  M: '#80B3E6',
  N: '#1ACC1A',
  P: '#CCCC00',
  Q: '#1ACC1A',
  R: '#E6331A',
  S: '#1ACC1A',
  T: '#1ACC1A',
  V: '#80B3E6',
  W: '#80B3E6',
  Y: '#1AB3B3',
};

export const ALI_VIEW_CLUSTAL_X_AMINO_ACID_PALETTE_COLORS: AminoAcidPaletteColors = {
  [AminoAcidSymbol.A]: PaletteUtil.createEntry(ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.A, '#000000', ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.A, '#FFFFFF'),
  [AminoAcidSymbol.C]: PaletteUtil.createEntry(ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.C, '#000000', ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.C, '#FFFFFF'),
  [AminoAcidSymbol.D]: PaletteUtil.createEntry(ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.D, '#000000', ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.D, '#FFFFFF'),
  [AminoAcidSymbol.E]: PaletteUtil.createEntry(ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.E, '#000000', ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.E, '#FFFFFF'),
  [AminoAcidSymbol.F]: PaletteUtil.createEntry(ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.F, '#000000', ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.F, '#FFFFFF'),
  [AminoAcidSymbol.G]: PaletteUtil.createEntry(ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.G, '#000000', ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.G, '#FFFFFF'),
  [AminoAcidSymbol.GAP]: PaletteUtil.createEntry('#FFFFFF', '#000000', '#868686', '#FFFFFF'),
  [AminoAcidSymbol.H]: PaletteUtil.createEntry(ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.H, '#000000', ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.H, '#FFFFFF'),
  [AminoAcidSymbol.I]: PaletteUtil.createEntry(ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.I, '#000000', ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.I, '#FFFFFF'),
  [AminoAcidSymbol.K]: PaletteUtil.createEntry(ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.K, '#000000', ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.K, '#FFFFFF'),
  [AminoAcidSymbol.L]: PaletteUtil.createEntry(ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.L, '#000000', ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.L, '#FFFFFF'),
  [AminoAcidSymbol.M]: PaletteUtil.createEntry(ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.M, '#000000', ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.M, '#FFFFFF'),
  [AminoAcidSymbol.N]: PaletteUtil.createEntry(ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.N, '#000000', ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.N, '#FFFFFF'),
  [AminoAcidSymbol.P]: PaletteUtil.createEntry(ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.P, '#000000', ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.P, '#FFFFFF'),
  [AminoAcidSymbol.Q]: PaletteUtil.createEntry(ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.Q, '#000000', ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.Q, '#FFFFFF'),
  [AminoAcidSymbol.R]: PaletteUtil.createEntry(ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.R, '#000000', ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.R, '#FFFFFF'),
  [AminoAcidSymbol.S]: PaletteUtil.createEntry(ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.S, '#000000', ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.S, '#FFFFFF'),
  [AminoAcidSymbol.STOP]: PaletteUtil.createEntry('#FFFFFF', '#000000', '#868686', '#FFFFFF'),
  [AminoAcidSymbol.T]: PaletteUtil.createEntry(ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.T, '#000000', ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.T, '#FFFFFF'),
  [AminoAcidSymbol.V]: PaletteUtil.createEntry(ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.V, '#000000', ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.V, '#FFFFFF'),
  [AminoAcidSymbol.W]: PaletteUtil.createEntry(ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.W, '#000000', ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.W, '#FFFFFF'),
  [AminoAcidSymbol.X]: PaletteUtil.createEntry('#FFFFFF', '#000000', '#868686', '#FFFFFF'),
  [AminoAcidSymbol.Y]: PaletteUtil.createEntry(ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.Y, '#000000', ALI_VIEW_CLUSTAL_X_AMINO_ACID_COLORS.Y, '#FFFFFF'),
};

export const ALI_VIEW_DEFAULT_NUCLEOTIDE_PALETTE: NucleotidePalette = {
  name: 'Default',
  paletteColors: ALI_VIEW_DEFAULT_NUCLEOTIDE_PALETTE_COLORS,
};
export const ALI_VIEW_FAST_NUCLEOTIDE_PALETTE: NucleotidePalette = {
  name: 'Fast',
  paletteColors: ALI_VIEW_FAST_NUCLEOTIDE_PALETTE_COLORS,
};
export const ALI_VIEW_SEA_VIEW_NUCLEOTIDE_PALETTE: NucleotidePalette = {
  name: 'SeaView',
  paletteColors: ALI_VIEW_SEA_VIEW_NUCLEOTIDE_PALETTE_COLORS,
};

export const ALI_VIEW_DEFAULT_AMINO_ACID_PALETTE: AminoAcidPalette = {
  name: 'Default',
  paletteColors: ALI_VIEW_DEFAULT_AMINO_ACID_PALETTE_COLORS,
};
export const ALI_VIEW_SEA_VIEW_AMINO_ACID_PALETTE: AminoAcidPalette = {
  name: 'SeaView',
  paletteColors: ALI_VIEW_SEA_VIEW_AMINO_ACID_PALETTE_COLORS,
};
export const ALI_VIEW_CLUSTAL_X_AMINO_ACID_PALETTE: AminoAcidPalette = {
  name: 'Clustal X',
  paletteColors: ALI_VIEW_CLUSTAL_X_AMINO_ACID_PALETTE_COLORS,
};
