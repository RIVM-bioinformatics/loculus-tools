import {
  describe,
  expect,
  it,
} from 'vitest';

import { MatrixType } from '../engine/protocol';
import type { SearchResult } from '../engine/protocol';

import {
  filterSearchResults,
  searchHitContainsCell,
  wrapSearchIndex,
} from './search';

const result: SearchResult = {
  num_matches: 3,
  positions: [
    { col: 2, matrix_type: MatrixType.Nucleotide, row: 1 },
    { col: 0, matrix_type: MatrixType.RecordName, row: 2 },
    { col: 5, matrix_type: MatrixType.AminoAcid, row: 0 },
  ],
  query: 'AC',
  truncated: false,
};

describe('search helpers', () => {
  it('filters to nucleotide and optionally record-name hits', () => {
    expect(filterSearchResults(result, false).positions).toEqual([result.positions[0]]);
    expect(filterSearchResults(result, true).positions).toEqual(result.positions.slice(0, 2));
  });

  it('wraps previous and next navigation', () => {
    expect(wrapSearchIndex(0, -1, 3)).toBe(2);
    expect(wrapSearchIndex(2, 1, 3)).toBe(0);
    expect(wrapSearchIndex(0, 1, 0)).toBe(0);
  });

  it('recognizes cells inside a nucleotide hit span', () => {
    expect(searchHitContainsCell(result.positions[0], 'AC', 1, 3)).toBe(true);
    expect(searchHitContainsCell(result.positions[0], 'AC', 1, 4)).toBe(false);
  });
});
