// @vitest-environment node
import 'reflect-metadata';
import { StringUtil } from '@gen-epix/ui-core/utils/StringUtil';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { EditorSelection } from '../../models/editor.models';

import { EditorUtil } from './EditorUtil';

describe('EditorUtil.getSelectedFasta', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('copies the selected cell rectangle with a generated UUID header for each row', () => {
    vi.spyOn(StringUtil, 'createUuid')
      .mockReturnValueOnce('first-uuid')
      .mockReturnValueOnce('second-uuid');

    expect(EditorUtil.getSelectedFasta('>first\nACGT\n>second\nTGCA', {
      cells: {
        endCol: 2,
        endRow: 1,
        startCol: 1,
        startRow: 0,
      },
    })).toBe('>first-uuid\nCG\n>second-uuid\nGC\n');
  });

  it('copies full sequences when rows are selected', () => {
    vi.spyOn(StringUtil, 'createUuid').mockReturnValue('selected-uuid');

    expect(EditorUtil.getSelectedFasta('>first\nACGT\n>second\nTGCA', {
      rows: [1],
    })).toBe('>selected-uuid\nTGCA\n');
  });

  it('copies selected columns from every sequence in column order', () => {
    vi.spyOn(StringUtil, 'createUuid')
      .mockReturnValueOnce('first-uuid')
      .mockReturnValueOnce('second-uuid');

    expect(EditorUtil.getSelectedFasta('>first\nACGT\n>second\nTGCA', {
      cols: [3, 1],
    })).toBe('>first-uuid\nCT\n>second-uuid\nGA\n');
  });

  it.each<EditorSelection | null>([null, { rows: [] }, { cols: [] }])('returns an empty string when nothing is selected', (selection) => {
    expect(EditorUtil.getSelectedFasta('>first\nACGT', selection)).toBe('');
  });

  it('throws when the engine FASTA cannot be parsed', () => {
    expect(() => EditorUtil.getSelectedFasta('ACGT', { rows: [0] })).toThrow(
      'FASTA sequence data appeared before its first header.',
    );
  });
});

describe('EditorUtil.getPostDeleteRowsSelection', () => {
  it('selects the rows that move into the deleted selection block', () => {
    expect(EditorUtil.getPostDeleteRowsSelection({ rows: [1, 3] }, 5)).toEqual({ rows: [1, 2] });
  });

  it('keeps the selection within the remaining rows when deleting at the end', () => {
    expect(EditorUtil.getPostDeleteRowsSelection({ rows: [3, 4] }, 5)).toEqual({ rows: [2] });
  });

  it('clears the selection when all rows are deleted', () => {
    expect(EditorUtil.getPostDeleteRowsSelection({ rows: [0, 1] }, 2)).toBeNull();
  });
});
