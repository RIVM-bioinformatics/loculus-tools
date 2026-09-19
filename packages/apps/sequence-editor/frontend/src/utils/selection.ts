import type {
  ActiveCell,
  SelectionBlock,
} from '../models';

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
