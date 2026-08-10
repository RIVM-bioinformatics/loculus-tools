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

export interface Meta {
  sequences: number;
  width: number;
  undoDepth: number;
  redoDepth: number;
}

/** A fetched viewport slice plus the metadata needed to interpret it. */
export interface ViewportResult {
  /** Number of rows actually present in `bytes`. */
  rows: number;
  /** Number of columns per row (may be less than requested if clamped). */
  cols: number;
  /** Row index of the first row in the slice. */
  startRow: number;
  /** Column index of the first column in the slice. */
  startCol: number;
}

// ---------------------------------------------------------------------------
// Main → Worker requests
// ---------------------------------------------------------------------------

export type EngineRequest =
  | { type: "load"; reqId: number; fasta: string }
  | {
      type: "viewport";
      reqId: number;
      startRow: number;
      endRow: number;
      startCol: number;
      endCol: number;
    }
  | { type: "mutate"; reqId: number; rows: Uint32Array; col: number; base: number }
  | { type: "insert"; reqId: number; rows: Uint32Array; col: number }
  | { type: "delete"; reqId: number; rows: Uint32Array; col: number }
  | { type: "deleteColumn"; reqId: number; col: number }
  | { type: "undo"; reqId: number }
  | { type: "redo"; reqId: number }
  | { type: "meta"; reqId: number }
  | { type: "name"; reqId: number; row: number }
  | { type: "moveHorizontal"; reqId: number; row: number; cols: Uint32Array; direction: "Left" | "Right" }
  | { type: "moveRowsUp"; reqId: number; rows: Uint32Array }
  | { type: "moveRowsDown"; reqId: number; rows: Uint32Array };

// ---------------------------------------------------------------------------
// Worker → Main responses
// ---------------------------------------------------------------------------

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

export type EngineResponse =
  | { type: "ready" }
  | {
      /**
       * Sent once after the worker creates its SharedArrayBuffer. The main
       * thread holds this reference and reads viewport bytes directly from it
       * on every subsequent viewport response — no per-call transfer.
       */
      type: "sab";
      buffer: SharedArrayBuffer;
      /** Maximum bytes the SAB can hold (rows*cols upper bound). */
      capacity: number;
    }
  | {
      type: "result";
      reqId: number;
      ok: true;
      data?: EngineResultData;
      /** For viewport responses: the transferred byte buffer (row-major). */
      transfer?: ArrayBuffer;
      /**
       * For SAB-based viewport responses: number of bytes the worker wrote
       * into the shared buffer. The main thread reads `sab[0..len]`.
       */
      sabLen?: number;
      timing?: EngineTiming;
    }
  | {
      type: "result";
      reqId: number;
      ok: false;
      errorCode: string;
    }
  | { type: "error"; reqId: number; message: string };

export type EngineResultData =
  | number
  | boolean
  | string
  | Meta
  | ViewportResult;
