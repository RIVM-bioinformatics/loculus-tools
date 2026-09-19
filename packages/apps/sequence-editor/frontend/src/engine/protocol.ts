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

export enum MatrixType {
  AminoAcid = 'amino_acid',
  Nucleotide = 'nucleotide',
  RecordName = 'record_name',
}

export type EngineRequest =
  | { base: number; col: number; reqId: number; rows: Uint32Array; type: 'mutate' }
  | { base: number; endCol: number; reqId: number; rows: Uint32Array; startCol: number; type: 'mutateRange' }
  | { checkRecordNames: boolean; query: string; reqId: number; type: 'search' }
  | { col: number; reqId: number; rows: Uint32Array; type: 'delete' }
  | { col: number; reqId: number; rows: Uint32Array; type: 'insert' }
  | { col: number; reqId: number; type: 'deleteColumn' }
  | { cols: Uint32Array; direction: 'Left' | 'Right'; reqId: number; row: number; type: 'moveHorizontal' }
  | {
    endCol: number;
    endRow: number;
    /** 0-indexed reading frame (0, 1, or 2). */
    readingFrame: number;
    reqId: number;
    startCol: number;
    startRow: number;
    type: 'translate';
  }
  | {
    endCol: number;
    endRow: number;
    reqId: number;
    startCol: number;
    startRow: number;
    type: 'viewport';
  }
  | { fasta: string; reqId: number; type: 'load' }
  | { reqId: number; type: 'exportFasta' }
  | { reqId: number; row: number; type: 'name' }
  | { reqId: number; rows: Uint32Array; type: 'moveRowsDown' }
  | { reqId: number; rows: Uint32Array; type: 'moveRowsUp' }
  | { reqId: number; type: 'meta' }
  | { reqId: number; type: 'redo' }
  | { reqId: number; type: 'undo' };

export type EngineResponse =
  | {
    buffer: SharedArrayBuffer;
    /** Maximum bytes the SAB can hold (rows*cols upper bound). */
    capacity: number;
    /**
     * Sent once after the worker creates its SharedArrayBuffer. The main
     * thread holds this reference and reads viewport bytes directly from it
     * on every subsequent viewport response — no per-call transfer.
     */
    type: 'sab';
  }
  | {
    data?: EngineResultData;
    ok: true;
    reqId: number;
    /**
     * For SAB-based viewport responses: number of bytes the worker wrote
     * into the shared buffer. The main thread reads `sab[0..len]`.
     */
    sabLen?: number;
    timing?: EngineTiming;
    /** For viewport responses: the transferred byte buffer (row-major). */
    transfer?: ArrayBuffer;
    type: 'result';
  }
  | {
    errorCode: string;
    ok: false;
    reqId: number;
    type: 'result';
  }
  | { message: string; reqId: number; type: 'error' }
  | { type: 'ready' };

export type EngineResultData =
  | boolean
  | Meta
  | number
  | SearchResult
  | string
  | ViewportResult;
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
export interface EngineTiming {
  /** Time inside the Rust engine call (ms). */
  engineMs: number;
  /** Total time the worker held the request (ms): from receive to postMessage. */
  workerMs: number;
}

// ---------------------------------------------------------------------------
// Main → Worker requests
// ---------------------------------------------------------------------------

export interface Meta {
  redoDepth: number;
  sequences: number;
  undoDepth: number;
  width: number;
}

// ---------------------------------------------------------------------------
// Worker → Main responses
// ---------------------------------------------------------------------------

/**The following interfaces match the Rust `search_algorithms::Match` and search_algorithms::SearchResult structures. */
export interface SearchMatch {
  col: number;
  matrix_type: MatrixType;
  row: number;
}

export interface SearchResult {
  num_matches: number;
  positions: SearchMatch[];
  query: string;
}

/** A fetched viewport slice plus the metadata needed to interpret it. */
export interface ViewportResult {
  /** Number of columns per row (may be less than requested if clamped). */
  cols: number;
  /** Number of rows actually present in `bytes`. */
  rows: number;
  /** Column index of the first column in the slice. */
  startCol: number;
  /** Row index of the first row in the slice. */
  startRow: number;
}
