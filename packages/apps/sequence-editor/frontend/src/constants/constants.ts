export const CELL_W = 10;
export const CELL_H = 18;
export const LABEL_W = 160;

export const SAMPLE_FASTA = `>seq1 first record
ATGCATGCATGC
>seq2
ATGGTGCAT-TC
>seq3 third record
ATGCAT-CATGC`;

export const BASE_COLORS: Record<string, string> = {
  '-': '#9e9e9e',
  '*': '#6a1b9a',
  A: '#2e7d32',
  C: '#1565c0',
  G: '#ef6c00',
  T: '#c62828',
  X: '#6a1b9a',
};

/** Number of columns to keep beyond each edge of the visible area. */
export const OVERSCAN = 100;
/**
 * Trigger a new fetch when the visible edge is within this many columns of the
 * buffer boundary — 30 % of OVERSCAN.
 */
export const TRIGGER_COLS = Math.round(OVERSCAN * 0.3); // 30


export const VIEWPORT_H = 480; // fixed canvas height

export const SAB_MAX_BYTES = 80 * 200_000;
