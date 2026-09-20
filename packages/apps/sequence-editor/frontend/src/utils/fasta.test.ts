import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  datasetFilename,
  preflightFasta,
} from './fasta';

describe('preflightFasta', () => {
  it('matches the engine header and sequence whitespace semantics', () => {
    const result = preflightFasta('>alpha description\nac gt\n>beta\nACGT');

    expect(result.records).toEqual([
      { name: 'alpha', sequence: 'ACGT' },
      { name: 'beta', sequence: 'ACGT' },
    ]);
    expect(result.isAligned).toBe(true);
    expect(result.expectedLength).toBe(4);
  });

  it('reports ragged records without discarding the parsed records', () => {
    const result = preflightFasta('>alpha\nACGT\n>beta\nACG');

    expect(result.isAligned).toBe(false);
    expect(result.invalidRecords).toEqual([{ length: 3, name: 'beta' }]);
  });

  it('rejects empty input and sequence data without a header', () => {
    expect(() => preflightFasta('')).toThrow('FASTA input is empty');
    expect(() => preflightFasta('ACGT')).toThrow('before its first header');
  });
});

describe('datasetFilename', () => {
  it('creates a bounded safe FASTA filename', () => {
    expect(datasetFilename(' SARS-CoV-2 / demo.fasta ')).toBe('SARS-CoV-2_demo.fasta');
    expect(datasetFilename('...')).toBe('alignment.fasta');
  });
});
