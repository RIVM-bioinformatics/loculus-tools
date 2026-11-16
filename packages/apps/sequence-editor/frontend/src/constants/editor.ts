import type { GridGeometry } from '../models/editor.models';

export const MIN_LABEL_WIDTH = 120;

/**
 * Maximum CSS pixel width/height applied to the native scrollbar spacer.
 * Kept safely below Firefox's ~17.89M px and Chromium's ~33.55M px layout ceilings.
 */
export const MAX_SAFE_SCROLL_SIZE = 10_000_000;

/**
 * Maximum index representable as a positive signed 32-bit integer (`isize::MAX` on wasm32).
 */
export const MAX_WASM_INDEX = 0x7FFF_FFFF;

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
