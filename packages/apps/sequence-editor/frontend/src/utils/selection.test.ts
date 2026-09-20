import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  moveRowSelection,
  rowSelectionForClick,
  rowsForBlock,
  selectionBlockForMove,
} from './selection';

describe('row selection helpers', () => {
  it('supports range and toggle selection', () => {
    expect(rowSelectionForClick({
      anchorRow: 1,
      currentRows: [1],
      row: 3,
      rowCount: 5,
      shiftKey: true,
      toggle: false,
    })).toEqual({ anchorRow: 1, rows: [1, 2, 3] });

    expect(rowSelectionForClick({
      anchorRow: 1,
      currentRows: [1, 2],
      row: 3,
      rowCount: 5,
      shiftKey: false,
      toggle: true,
    })).toEqual({ anchorRow: 3, rows: [1, 2, 3] });
  });

  it('keeps the active-row block contiguous while moving', () => {
    expect(selectionBlockForMove(4, 2, null)).toEqual({ endCol: 4, startCol: 2 });
    expect(rowsForBlock(2, { endCol: 4, endRow: 3, startCol: 1, startRow: 1 }, 5)).toEqual([1, 2, 3]);
  });

  it('remaps row selections when rows move', () => {
    expect(moveRowSelection({
      activeRow: 2,
      anchorRow: 2,
      block: null,
      direction: 'down',
      rowCount: 4,
      rows: [1, 2],
    })).toMatchObject({ activeRow: 3, anchorRow: 3, rows: [2, 3] });
  });
});
