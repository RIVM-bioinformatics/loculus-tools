export interface GridGeometry {
  cellHeight: number;
  cellWidth: number;
  labelWidth: number;
  rulerHeight: number;
}

export interface GridPoint {
  col: number;
  row: number;
  surface: 'cell' | 'gutter' | 'ruler';
}

export interface GridRange {
  endCol: number;
  endRow: number;
  startCol: number;
  startRow: number;
}

export interface VisibleGridRange {
  cache: GridRange;
  visible: GridRange;
}

export const DEFAULT_GRID_GEOMETRY: GridGeometry = {
  cellHeight: 22,
  cellWidth: 18,
  labelWidth: 190,
  rulerHeight: 26,
};

export const getVisibleGridRange = (
  scrollLeft: number,
  scrollTop: number,
  viewportWidth: number,
  viewportHeight: number,
  rows: number,
  cols: number,
  geometry: GridGeometry = DEFAULT_GRID_GEOMETRY,
  overscanRows = 16,
  overscanCols = 128,
): VisibleGridRange => {
  const visibleStartCol = Math.max(0, Math.floor(scrollLeft / geometry.cellWidth));
  const visibleEndCol = Math.min(
    cols,
    visibleStartCol + Math.max(1, Math.ceil((viewportWidth - geometry.labelWidth) / geometry.cellWidth) + 1),
  );
  const visibleStartRow = Math.max(0, Math.floor(Math.max(0, scrollTop - geometry.rulerHeight) / geometry.cellHeight));
  const visibleEndRow = Math.min(
    rows,
    visibleStartRow + Math.max(1, Math.ceil((viewportHeight - geometry.rulerHeight) / geometry.cellHeight) + 1),
  );

  return {
    cache: {
      endCol: Math.min(cols, visibleEndCol + overscanCols),
      endRow: Math.min(rows, visibleEndRow + overscanRows),
      startCol: Math.max(0, visibleStartCol - overscanCols),
      startRow: Math.max(0, visibleStartRow - overscanRows),
    },
    visible: {
      endCol: visibleEndCol,
      endRow: visibleEndRow,
      startCol: visibleStartCol,
      startRow: visibleStartRow,
    },
  };
};

export const rangeContains = (outer: GridRange, inner: GridRange): boolean => (
  outer.startRow <= inner.startRow
  && outer.endRow >= inner.endRow
  && outer.startCol <= inner.startCol
  && outer.endCol >= inner.endCol
);

export const hitTestGridPoint = (
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, 'left' | 'top'>,
  scrollLeft: number,
  scrollTop: number,
  geometry: GridGeometry = DEFAULT_GRID_GEOMETRY,
): GridPoint => {
  const screenX = clientX - rect.left;
  const screenY = clientY - rect.top;
  const contentX = screenX < geometry.labelWidth ? screenX : screenX + scrollLeft;
  const contentY = screenY + scrollTop;

  if (screenX < geometry.labelWidth) {
    return {
      col: 0,
      row: Math.max(0, Math.floor((contentY - geometry.rulerHeight) / geometry.cellHeight)),
      surface: contentY < geometry.rulerHeight ? 'ruler' : 'gutter',
    };
  }

  return {
    col: Math.max(0, Math.floor((contentX - geometry.labelWidth) / geometry.cellWidth)),
    row: Math.max(0, Math.floor((contentY - geometry.rulerHeight) / geometry.cellHeight)),
    surface: contentY < geometry.rulerHeight ? 'ruler' : 'cell',
  };
};

export const scrollPositionForCell = (
  cell: { col: number; row: number },
  scrollLeft: number,
  scrollTop: number,
  viewportWidth: number,
  viewportHeight: number,
  geometry: GridGeometry = DEFAULT_GRID_GEOMETRY,
): { left: number; top: number } => {
  const cellLeft = geometry.labelWidth + cell.col * geometry.cellWidth;
  const cellRight = cellLeft + geometry.cellWidth;
  const cellTop = geometry.rulerHeight + cell.row * geometry.cellHeight;
  const cellBottom = cellTop + geometry.cellHeight;
  const visibleLeft = scrollLeft + geometry.labelWidth;
  const visibleRight = scrollLeft + viewportWidth;
  const visibleTop = scrollTop + geometry.rulerHeight;
  const visibleBottom = scrollTop + viewportHeight;

  let left = scrollLeft;
  if (cellLeft < visibleLeft) {
    left = Math.max(0, cellLeft - geometry.labelWidth);
  } else if (cellRight > visibleRight) {
    left = Math.max(0, cellRight - viewportWidth);
  }
  let top = scrollTop;
  if (cellTop < visibleTop) {
    top = Math.max(0, cellTop - geometry.rulerHeight);
  } else if (cellBottom > visibleBottom) {
    top = Math.max(0, cellBottom - viewportHeight);
  }
  return { left, top };
};
