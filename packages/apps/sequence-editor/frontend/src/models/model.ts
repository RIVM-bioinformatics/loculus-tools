import type { MoveDirection } from '@rivm-loculus-tools/sequence-editor-wasm';

export enum EDITOR_PATH_PROPERTIES_TYPE {
  CELL = 'CELL',
  DIVIDER = 'DIVIDER',
  LABEL = 'LABEL',
  RULER = 'RULER',
}


export enum MATRIX_TYPE {
  AMINO_ACID = 'amino_acid',
  NUCLEOTIDE = 'nucleotide',
  RECORD_NAME = 'record_name',
}

export type EditorAssembly = {
  cells: EditorAssemblyCells;
  divider: EditorAssemblyDivider;
  labels: EditorAssemblyLabels;
  ruler: EditorAssemblyRuler;
};

export type EditorAssemblyCells = {
  pathPropertiesMap: Map<Path2D, EditorPathProperties>;
};

export type EditorAssemblyDivider = {
  pathPropertiesMap: Map<Path2D, EditorPathProperties>;
};

export type EditorAssemblyLabels = {
  pathPropertiesMap: Map<Path2D, EditorPathProperties>;
};

export type EditorAssemblyRuler = {
  pathPropertiesMap: Map<Path2D, EditorPathProperties>;
};

export type EditorPathProperties = {
  col: number;
  row: number;
  type: EDITOR_PATH_PROPERTIES_TYPE.CELL;
} | {
  col: number;
  type: EDITOR_PATH_PROPERTIES_TYPE.RULER;
} | {
  row: number;
  type: EDITOR_PATH_PROPERTIES_TYPE.LABEL;
} | {
  type: EDITOR_PATH_PROPERTIES_TYPE.DIVIDER;
};

export type EditorSelection = {
  cells?: { // when a rectangular block of cells is selected
    endCol: number;
    endRow: number;
    startCol: number;
    startRow: number;
  };
  cols?: number[]; // when entire columns are selected
  rows?: number[]; // when entire rows are selected
};

/** Metadata describing the currently loaded alignment. */
export type EngineMeta = {
  alignmentWidth: number;
  redoDepth: number;
  sequenceCount: number;
  undoDepth: number;
};

/** A single search match, matching the Rust `search_algorithms::Match`. */
export type EngineSearchMatch = {
  col: number;
  matrix_type: MATRIX_TYPE;
  row: number;
};

/** Search results, matching the Rust `search_algorithms::SearchResult`. */
export type EngineSearchResult = {
  num_matches: number;
  positions: EngineSearchMatch[];
  query: string;
  truncated: boolean;
};

/**
 * Timing breakdown for a single request, measured in milliseconds via
 * `performance.now()`. All fields are optional so non-instrumented responses
 * (e.g. `ready`) can omit them.
 *
 * The full call-to-render latency decomposes as:
 *
 *   total = bridgeOut + engineMs + bridgeBack + renderMs
 *
 * where:
 *   - `engineMs`    : time spent inside the Rust call (measured in worker)
 *   - `workerMs`    : total time the worker held the request, including the
 *                     Rust call + response postMessage setup (measured in worker)
 *   - `bridgeOut`   : main→worker postMessage latency (computed on main thread
 *                     as `workerReceiveTs - sentTs`, see `TimingMarks`)
 *   - `bridgeBack`  : worker→main postMessage latency (computed on main thread
 *                     as `receivedTs - workerDoneTs`)
 *   - `renderMs`    : time from promise resolution to browser paint (measured
 *                     with `requestAnimationFrame` in the harness)
 */
export type EngineTiming = {
  /** Time inside the Rust engine call (ms). */
  engineMs: number;
  /** Total time the worker held the request (ms): from receive to postMessage. */
  workerMs: number;
};

/** A fetched viewport or translation slice plus the metadata to interpret it. */
export type EngineViewportResult = {
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
};


/**
 * Wire protocol between the main thread and the MSA Web Worker.
 *
 * Design goals:
 *  - **Zero-copy for binary payloads via SharedArrayBuffer.** Viewport
 *    responses write into a single SAB created at worker init. The worker
 *    sends a tiny control message (`{sabLen, data: ViewportResult}`) and the
 *    main thread reads bytes directly from shared memory — no per-call
 *    structured clone of binary data.
 *  - **O(1) response correlation.** Every request carries a monotonically
 *    increasing `reqId`; the client keeps a `Map<reqId, resolver>` for
 *    constant-time dispatch.
 *  - **Typed arrays for index vectors.** Row-index lists travel as
 *    `Uint32Array` (not `number[]`) to avoid per-element number boxing and to
 *    match the wasm-bindgen `&[usize]` slice mapping directly.
 *  - **No JSON for hot paths.** Only small plain objects are structured-cloned;
 *    binary data is always transferred via the shared SAB.
 */

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/**
 * Contract implemented by the `EngineWorker` class and exposed to the main
 * thread through comlink. Every method is asynchronous so comlink can proxy it
 * across the worker boundary.
 */
export interface EngineWorkerApi {
  delete: (rows: number[], column: number) => Promise<void>;
  deleteColumn: (column: number) => Promise<void>;
  exportFasta: () => Promise<string>;
  /** Idempotently initializes the WASM engine; resolves once it is ready. */
  initialize: () => Promise<void>;
  insert: (rows: number[], column: number) => Promise<void>;
  load: (fastaContent: string) => Promise<number>;
  meta: () => Promise<EngineMeta>;
  moveHorizontal: (row: number, columns: number[], direction: MoveDirection) => Promise<void>;
  moveRowsDown: (rows: number[]) => Promise<void>;
  moveRowsUp: (rows: number[]) => Promise<void>;
  mutate: (rows: number[], column: number, base: string) => Promise<void>;
  mutateRange: (rows: number[], startColumn: number, endColumn: number, base: string) => Promise<void>;
  name: (row: number) => Promise<string>;
  redo: () => Promise<boolean>;
  search: (query: string, checkRecordNames: boolean) => Promise<EngineSearchResult>;
  translate: (bounds: ViewportBounds, readingFrame: number) => Promise<EngineViewportResult>;
  undo: () => Promise<boolean>;
  viewport: (bounds: ViewportBounds) => Promise<EngineViewportResult>;
}

export type GridGeometry = {
  cellHeight: number;
  cellWidth: number;
  dividerWidth: number;
  labelWidth: number;
  numOverscanCols: number;
  numOverscanRows: number;
  rulerHeight: number;
};

export type GridPoint = {
  col: number;
  row: number;
  surface: 'cell' | 'gutter' | 'ruler';
};

export type GridRange = {
  endCol: number;
  endRow: number;
  startCol: number;
  startRow: number;
};

export type GridRangeWithRowNames = {
  range: GridRange;
  rowNames: string[];
};

export type GridRangeWithViewportResults = {
  range: GridRange;
  viewportResult: EngineViewportResult;
};

// ---------------------------------------------------------------------------
// Main → Worker requests
// ---------------------------------------------------------------------------

export type Meta = {
  redoDepth: number;
  sequences: number;
  undoDepth: number;
  width: number;
};

// ---------------------------------------------------------------------------
// Worker → Main responses
// ---------------------------------------------------------------------------

/**The following types match the Rust `search_algorithms::Match` and search_algorithms::SearchResult structures. */
export type SearchMatch = {
  col: number;
  matrix_type: MATRIX_TYPE;
  row: number;
};

export type SearchResult = EngineSearchResult;

/** Summary statistics for a set of measured values. */
export type Stats = {
  count: number;
  max: number;
  mean: number;
  median: number;
  min: number;
  p95: number;
};

/** Inclusive column/row bounds for a viewport or translation request. */
export type ViewportBounds = {
  endCol: number;
  endRow: number;
  startCol: number;
  startRow: number;
};

/** A fetched viewport slice plus the metadata needed to interpret it. */
export type ViewportResult = {
  /** Number of columns per row (may be less than requested if clamped). */
  cols: number;
  /** Number of rows actually present in `bytes`. */
  rows: number;
  /** Column index of the first column in the slice. */
  startCol: number;
  /** Row index of the first row in the slice. */
  startRow: number;
};

export type VisibleGridRange = {
  cache: GridRange;
  visible: GridRange;
};

export type VisibleGridRangeWithArguments = {
  geometry: GridGeometry;
  scrollLeft: number;
  scrollTop: number;
  viewportHeight: number;
  viewportWidth: number;
  visibleGridRange: VisibleGridRange;
};

/** Debug info exposed to the scrolling viewport status bar. */
export type WindowInfo = {
  bufBytes: number;
  bufEnd: number;
  bufStart: number;
  fetching: boolean;
  visEnd: number;
  visStart: number;
};
