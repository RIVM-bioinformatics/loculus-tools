import type { GridGeometry } from '../models/editor.models';

export const MIN_LABEL_WIDTH = 120;

export const DEFAULT_GRID_GEOMETRY: GridGeometry = {
  cellHeight: 22,
  cellWidth: 18,
  dividerWidth: 4,
  labelWidth: 300,
  numOverscanCols: 128,
  numOverscanRows: 16,
  rulerHeight: 26,
};

export const IUPAC_KEYS = new Set('ACGTURYKMSWBDHVN');
