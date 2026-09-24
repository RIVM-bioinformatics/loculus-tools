import type { GridGeometry } from '../models';

export const OVERSCAN_COLS = 128;
export const OVERSCAN_ROWS = 16;


export const SAB_MAX_BYTES = 80 * 200_000;

export const DEFAULT_GRID_GEOMETRY: GridGeometry = {
  cellHeight: 22,
  cellWidth: 18,
  labelWidth: 190,
  rulerHeight: 26,
};
