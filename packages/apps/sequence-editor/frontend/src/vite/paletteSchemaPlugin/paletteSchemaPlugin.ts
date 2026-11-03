import type { Plugin } from 'vite';

import {
  AMINO_ACID_SYMBOLS,
  NUCLEOTIDE_SYMBOLS,
  PALETTE_SCHEMA_ASSET_PATH,
  PALETTE_SCHEMA_URL_PATH,
} from '../../constants/palette';

const paletteEntryFields = [
  'background',
  'backgroundSelected',
  'foreground',
  'foregroundSelected',
];

const createPaletteGroupSchema = (title: string, symbols: readonly string[]) => ({
  additionalProperties: false,
  properties: {
    $schema: {
      format: 'uri',
      type: 'string',
    },
    name: {
      minLength: 1,
      pattern: '\\S',
      type: 'string',
    },
    paletteColors: {
      additionalProperties: false,
      properties: Object.fromEntries(symbols.map((symbol) => [
        symbol,
        { $ref: '#/$defs/paletteEntry' },
      ])),
      required: symbols,
      type: 'object',
    },
  },
  required: ['name', 'paletteColors'],
  title,
  type: 'object',
});

const paletteJsonSchema = JSON.stringify({
  $defs: {
    paletteEntry: {
      additionalProperties: false,
      properties: Object.fromEntries(paletteEntryFields.map((field) => [
        field,
        {
          pattern: '^#[0-9a-fA-F]{6}$',
          type: 'string',
        },
      ])),
      required: paletteEntryFields,
      type: 'object',
    },
  },
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  oneOf: [
    createPaletteGroupSchema('Nucleotide palette', NUCLEOTIDE_SYMBOLS),
    createPaletteGroupSchema('Amino-acid palette', AMINO_ACID_SYMBOLS),
  ],
  title: 'Sequence editor palette',
}, null, 2);

export const createPaletteSchemaPlugin = (): Plugin => ({
  configureServer: (server): void => {
    server.middlewares.use(PALETTE_SCHEMA_URL_PATH, (_request, response) => {
      response.setHeader('Content-Type', 'application/schema+json; charset=utf-8');
      response.end(paletteJsonSchema);
    });
  },
  generateBundle() {
    this.emitFile({
      fileName: PALETTE_SCHEMA_ASSET_PATH,
      source: paletteJsonSchema,
      type: 'asset',
    });
  },
  name: 'sequence-editor-palette-schema',
});
