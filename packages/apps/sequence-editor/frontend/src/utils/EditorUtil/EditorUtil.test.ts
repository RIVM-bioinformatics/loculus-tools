import {
  describe,
  expect,
  it,
} from 'vitest';

import { EditorUtil } from './EditorUtil';

describe('EditorUtil.getStatusBarSelectionStats', () => {
  it('calculates stats for a cell selection', () => {
    expect(EditorUtil.getStatusBarSelectionStats({
      cells: {
        endCol: 4,
        endRow: 3,
        startCol: 2,
        startRow: 1,
      },
    })).toEqual({
      cols: 3,
      pos: 3,
      selectedSeqs: 3,
      totalSelectedChars: 9,
    });
  });

  it('calculates stats for full row and column selections', () => {
    const meta = {
      alignmentWidth: 12,
      redoDepth: 0,
      sequenceCount: 8,
      undoDepth: 0,
    };

    expect(EditorUtil.getStatusBarSelectionStats({ rows: [1, 3] }, meta)).toEqual({
      cols: 12,
      pos: 0,
      selectedSeqs: 2,
      totalSelectedChars: 24,
    });
    expect(EditorUtil.getStatusBarSelectionStats({ cols: [2, 4] }, meta)).toEqual({
      cols: 2,
      pos: 3,
      selectedSeqs: 8,
      totalSelectedChars: 16,
    });
  });

  it('returns zero stats when there is no selection', () => {
    expect(EditorUtil.getStatusBarSelectionStats(null)).toEqual({
      cols: 0,
      pos: 0,
      selectedSeqs: 0,
      totalSelectedChars: 0,
    });
  });
});
