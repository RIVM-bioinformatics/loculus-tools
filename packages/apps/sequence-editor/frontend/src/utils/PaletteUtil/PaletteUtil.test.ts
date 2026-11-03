// @vitest-environment node
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  ALI_VIEW_DEFAULT_AMINO_ACID_PALETTE,
  ALI_VIEW_DEFAULT_NUCLEOTIDE_PALETTE,
} from '../../constants/palette';

import { PaletteUtil } from './PaletteUtil';

describe('PaletteUtil', () => {
  it('accepts and normalizes a complete nucleotide palette', () => {
    expect(PaletteUtil.parseNucleotidePalette(ALI_VIEW_DEFAULT_NUCLEOTIDE_PALETTE)).toEqual({
      ...ALI_VIEW_DEFAULT_NUCLEOTIDE_PALETTE,
      name: 'Custom',
    });
  });

  it('accepts and normalizes a complete amino-acid palette', () => {
    expect(PaletteUtil.parseAminoAcidPalette(ALI_VIEW_DEFAULT_AMINO_ACID_PALETTE)).toEqual({
      ...ALI_VIEW_DEFAULT_AMINO_ACID_PALETTE,
      name: 'Custom',
    });
  });

  it('accepts an optional schema URL on imported palettes', () => {
    const schemaUrl = 'https://example.test/assets/palette.schema.json';

    expect(PaletteUtil.parseNucleotidePalette({
      ...ALI_VIEW_DEFAULT_NUCLEOTIDE_PALETTE,
      $schema: schemaUrl,
    })).toMatchObject({
      $schema: schemaUrl,
      name: 'Custom',
    });
  });

  it('rejects a non-string schema URL on imported palettes', () => {
    expect(() => PaletteUtil.parseNucleotidePalette({
      ...ALI_VIEW_DEFAULT_NUCLEOTIDE_PALETTE,
      $schema: 1,
    })).toThrow('Invalid nucleotide palette');
  });

  it('rejects palettes with missing symbols', () => {
    expect(() => PaletteUtil.parseNucleotidePalette({
      name: 'Incomplete',
      paletteColors: {},
    })).toThrow('Invalid nucleotide palette');
  });

  it('rejects palette entries with invalid colors', () => {
    expect(() => PaletteUtil.parseNucleotidePalette({
      ...ALI_VIEW_DEFAULT_NUCLEOTIDE_PALETTE,
      paletteColors: {
        ...ALI_VIEW_DEFAULT_NUCLEOTIDE_PALETTE.paletteColors,
        A: {
          ...ALI_VIEW_DEFAULT_NUCLEOTIDE_PALETTE.paletteColors.A,
          background: 'not-a-color',
        },
      },
    })).toThrow('Invalid nucleotide palette');
  });

  it('rejects a palette from the wrong symbol group', () => {
    expect(() => PaletteUtil.parseAminoAcidPalette(ALI_VIEW_DEFAULT_NUCLEOTIDE_PALETTE)).toThrow('Invalid amino-acid palette');
  });
});
