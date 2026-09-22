export enum MATRIX_TYPE {
  AMINO_ACID = 'amino_acid',
  NUCLEOTIDE = 'nucleotide',
  RECORD_NAME = 'record_name',
}

/** Sliding-window byte buffer used by the scrolling viewport. */
export interface ChunkStore {
  /** Exclusive right column index (alignment-space). */
  colEnd: number;
  /** = colEnd − colStart */
  cols: number;
  /** Inclusive left column index (alignment-space). */
  colStart: number;
  /** Row-major byte array: index = row * cols + (col − colStart). */
  data: Uint8Array;
  numRows: number;
}

/** Metadata describing the currently loaded alignment. */
export interface EngineMeta {
  redoDepth: number;
  sequences: number;
  undoDepth: number;
  width: number;
}

/** A single search match, matching the Rust `search_algorithms::Match`. */
export interface EngineSearchMatch {
  col: number;
  matrix_type: MATRIX_TYPE;
  row: number;
}

/** Search results, matching the Rust `search_algorithms::SearchResult`. */
export interface EngineSearchResult {
  num_matches: number;
  positions: EngineSearchMatch[];
  query: string;
}

/** A fetched viewport or translation slice plus the metadata to interpret it. */
export interface EngineViewportResult {
  /** Row-major bytes, transferred from the worker via comlink. */
  bytes: Uint8Array;
  /** Number of columns per row (may be less than requested if clamped). */
  cols: number;
  /** Number of rows actually present in `bytes`. */
  rows: number;
  /** Column index of the first column in the slice. */
  startCol: number;
  /** Row index of the first row in the slice. */
  startRow: number;
}

/**
 * Contract implemented by the `EngineWorker` class and exposed to the main
 * thread through comlink. Every method is asynchronous so comlink can proxy it
 * across the worker boundary.
 */
export interface EngineWorkerApi {
  delete: (rows: number[], column: number) => Promise<void>;
  deleteColumn: (column: number) => Promise<void>;
  /** Idempotently initializes the WASM engine; resolves once it is ready. */
  initialize: () => Promise<void>;
  insert: (rows: number[], column: number) => Promise<void>;
  load: (fastaContent: string) => Promise<number>;
  meta: () => Promise<EngineMeta>;
  moveHorizontal: (row: number, columns: number[], direction: MoveDirection) => Promise<void>;
  moveRowsDown: (rows: number[]) => Promise<void>;
  moveRowsUp: (rows: number[]) => Promise<void>;
  mutate: (rows: number[], column: number, base: string) => Promise<void>;
  name: (row: number) => Promise<string>;
  redo: () => Promise<boolean>;
  search: (query: string, checkRecordNames: boolean) => Promise<EngineSearchResult>;
  translate: (bounds: ViewportBounds, readingFrame: number) => Promise<EngineViewportResult>;
  undo: () => Promise<boolean>;
  viewport: (bounds: ViewportBounds) => Promise<EngineViewportResult>;
}

/** Horizontal move direction understood by the engine. */
export type MoveDirection = 'Left' | 'Right';

export interface ScrollingViewportProps {
  engine: EngineWorkerApi;
  meta: EngineMeta;
  ready: boolean;
}

/** Summary statistics for a set of measured values. */
export interface Stats {
  count: number;
  max: number;
  mean: number;
  median: number;
  min: number;
  p95: number;
}

/** Inclusive column/row bounds for a viewport or translation request. */
export interface ViewportBounds {
  endCol: number;
  endRow: number;
  startCol: number;
  startRow: number;
}

/** Debug info exposed to the scrolling viewport status bar. */
export interface WindowInfo {
  bufBytes: number;
  bufEnd: number;
  bufStart: number;
  fetching: boolean;
  visEnd: number;
  visStart: number;
}
