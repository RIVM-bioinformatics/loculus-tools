import type { GridGeometry } from '../models';

export const SAB_MAX_BYTES = 80 * 200_000;

export const DEFAULT_GRID_GEOMETRY: GridGeometry = {
  cellHeight: 22,
  cellWidth: 18,
  dividerWidth: 4,
  labelWidth: 300,
  numOverscanCols: 128,
  numOverscanRows: 16,
  rulerHeight: 26,
};
