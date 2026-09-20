import type {
  ActiveCell,
  SelectionBlock,
} from '../models';

export interface MovedRowSelection {
  activeRow: number;
  anchorRow: null | number;
  block: null | SelectionBlock;
  rows: number[];
}

export type RowMoveDirection = 'down' | 'up';

export const normalizeRows = (rows: number[], rowCount: number): number[] => (
  [...new Set(rows)]
    .filter((row) => Number.isInteger(row) && row >= 0 && row < rowCount)
    .sort((a, b) => a - b)
);

export const rowSelectionForClick = ({
  anchorRow,
  currentRows,
  row,
  rowCount,
  shiftKey,
  toggle,
}: {
  anchorRow: null | number;
  currentRows: number[];
  row: number;
  rowCount: number;
  shiftKey: boolean;
  toggle: boolean;
}): { anchorRow: number; rows: number[] } => {
  const boundedRow = Math.max(0, Math.min(rowCount - 1, row));
  if (shiftKey && anchorRow !== null) {
    const start = Math.min(anchorRow, boundedRow);
    const end = Math.max(anchorRow, boundedRow);
    return {
      anchorRow,
      rows: Array.from({ length: end - start + 1 }, (_, index) => start + index),
    };
  }
  if (toggle) {
    const rows = currentRows.includes(boundedRow)
      ? currentRows.filter((currentRow) => currentRow !== boundedRow)
      : [...currentRows, boundedRow];
    return { anchorRow: boundedRow, rows: normalizeRows(rows, rowCount) };
  }
  return { anchorRow: boundedRow, rows: [boundedRow] };
};

export const selectionBlockForMove = (
  activeCol: number,
  nextCol: number,
  currentBlock: null | SelectionBlock,
): SelectionBlock => ({
  endCol: Math.max(currentBlock?.startCol ?? activeCol, nextCol),
  endRow: currentBlock?.endRow,
  startCol: Math.min(currentBlock?.startCol ?? activeCol, nextCol),
  startRow: currentBlock?.startRow,
});

export const selectionBlockForRange = (
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
): SelectionBlock => ({
  endCol: Math.max(startCol, endCol),
  endRow: Math.max(startRow, endRow),
  startCol: Math.min(startCol, endCol),
  startRow: Math.min(startRow, endRow),
});

export const rowsForBlock = (activeRow: number, block: SelectionBlock, rowCount: number): number[] => {
  const start = Math.max(0, Math.min(rowCount - 1, block.startRow ?? activeRow));
  const end = Math.max(start, Math.min(rowCount - 1, block.endRow ?? activeRow));
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
};

export const columnsForBlock = (active: ActiveCell, block: null | SelectionBlock): number[] => {
  const start = block ? Math.min(block.startCol, block.endCol) : active.col;
  const end = block ? Math.max(block.startCol, block.endCol) : active.col;
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
};

export const mutationRows = (activeRow: number, selectedRows: number[]): number[] => (
  selectedRows.length > 0 ? selectedRows : [activeRow]
);

const movePosition = (position: number, rowIndices: number[], rowCount: number, direction: RowMoveDirection): number => {
  if (!rowIndices.includes(position)) {
    return position;
  }
  let current = position;
  const orderedRows = [...new Set(rowIndices)]
    .filter((row) => Number.isInteger(row))
    .sort((a, b) => direction === 'up' ? a - b : b - a);
  for (const row of orderedRows) {
    if (row < 0 || row >= rowCount || rowCount < 2) {
      continue;
    }
    if (direction === 'up' && row > 0) {
      if (current === row) {
        current = row - 1;
      } else if (current === row - 1) {
        current = row;
      }
    }
    if (direction === 'down' && row + 1 < rowCount) {
      if (current === row) {
        current = row + 1;
      } else if (current === row + 1) {
        current = row;
      }
    }
  }
  return current;
};

export const moveRowSelection = ({
  activeRow,
  anchorRow,
  block,
  direction,
  rowCount,
  rows,
}: {
  activeRow: number;
  anchorRow: null | number;
  block: null | SelectionBlock;
  direction: RowMoveDirection;
  rowCount: number;
  rows: number[];
}): MovedRowSelection => {
  const movedRows = rows.map((row) => movePosition(row, rows, rowCount, direction));
  const movedBlock = block ? {
    ...block,
    endRow: movePosition(block.endRow ?? activeRow, rows, rowCount, direction),
    startRow: movePosition(block.startRow ?? activeRow, rows, rowCount, direction),
  } : null;
  if (movedBlock?.startRow !== undefined && movedBlock.endRow !== undefined && movedBlock.startRow > movedBlock.endRow) {
    [movedBlock.startRow, movedBlock.endRow] = [movedBlock.endRow, movedBlock.startRow];
  }
  return {
    activeRow: movePosition(activeRow, rows, rowCount, direction),
    anchorRow: anchorRow === null ? null : movePosition(anchorRow, rows, rowCount, direction),
    block: movedBlock,
    rows: normalizeRows(movedRows, rowCount),
  };
};
