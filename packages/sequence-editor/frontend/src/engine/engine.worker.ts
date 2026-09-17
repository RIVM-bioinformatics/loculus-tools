/// <reference lib="webworker" />
/**
 * MSA engine Web Worker.
 *
 * This worker is the **single owner** of the `MsaEngine` WASM instance and its
 * linear memory for the lifetime of the page. All Rust calls happen here, off
 * the main thread, so FASTA parsing, structural mutations, and undo/redo
 * snapshots never stall the React render loop or the (future) WebGL rAF.
 *
 * Efficiency notes:
 *  - WASM is instantiated exactly once; the `MsaEngine` is constructed right
 *    after and reused for every subsequent command.
 *  - `update_viewport` returns a new `Uint8Array` (copied from WASM linear
 *    memory into a JS-owned buffer). We then `sabView.set()` that buffer into
 *    the SharedArrayBuffer — two copies total, but avoids the ~3ms overhead
 *    of wasm-bindgen's `&mut [u8]` marshalling for large SAB views.
 *  - Row-index vectors arrive as `Uint32Array` and are passed straight to the
 *    wasm-bindgen-generated method (no `Array.from` boxing).
 *  - Errors are caught and surfaced as `{ type: "error" }` so the client's
 *    promise rejects rather than hanging.
 */

import init, { MsaEngine, MoveDirection } from "@rivm-loculus-tools/sequence-editor-wasm";
import type {
  EngineRequest,
  EngineResponse,
  Meta,
  SearchResult,
  ViewportResult,
} from "./protocol";

let engine: MsaEngine | null = null;
let initializing = false;

/**
 * SharedArrayBuffer used for zero-copy viewport transfers. Created once after
 * the engine is ready, then sent to the main thread. All subsequent viewport
 * responses write into this buffer and send only a tiny control message.
 */
let sab: SharedArrayBuffer | null = null;
let sabView: Uint8Array | null = null;
/** Max rows × cols we ever expect to serve in a single viewport request.  
 * TODO: see sequence-editor/src/lib.rs MAX_VIEWPORT_BYTES for detailed future todo comment
 */
const SAB_MAX_BYTES = 80 * 200_000;

interface ViewportShape {
  rows: number;
  cols: number;
}

function checkedInclusiveLength(start: number, end: number): number | null {
  const span = end - start;
  if (!Number.isSafeInteger(span) || span >= Number.MAX_SAFE_INTEGER) {
    return null;
  }
  return span + 1;
}

function getViewportShape(
  req: Extract<EngineRequest, { type: "viewport" }>
): ViewportShape | null {
  const bounds = [req.startRow, req.endRow, req.startCol, req.endCol];
  if (!bounds.every((value) => Number.isSafeInteger(value) && value >= 0)) {
    return null;
  }
  if (req.startRow > req.endRow || req.startCol > req.endCol) {
    return null;
  }

  const rows = checkedInclusiveLength(req.startRow, req.endRow);
  const cols = checkedInclusiveLength(req.startCol, req.endCol);
  if (rows === null || cols === null || rows > Math.floor(SAB_MAX_BYTES / cols)) {
    return null;
  }

  return { rows, cols };
}

/** Pending commands issued before WASM finished initializing. */
const queue: EngineRequest[] = [];

async function ensureEngine(): Promise<void> {
  if (engine) return;
  if (initializing) return;
  initializing = true;
  try {
    await init(undefined as never);
    engine = new MsaEngine();
    // Create the SharedArrayBuffer and announce it to the main thread. SAB is
    // shared memory — both threads hold references to the same backing store.
    // No transfer list needed (and SAB cannot be "transferred" like a regular
    // ArrayBuffer; it's simply structured-cloned as a shared reference).
    sab = new SharedArrayBuffer(SAB_MAX_BYTES);
    sabView = new Uint8Array(sab);
    post({ type: "sab", buffer: sab, capacity: SAB_MAX_BYTES });
    post({ type: "ready" });
    // Drain any commands that arrived during initialization.
    while (queue.length > 0) {
      const next = queue.shift()!;
      await handle(next);
    }
  } catch (err) {
    post({
      type: "error",
      reqId: -1,
      message: `WASM init failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  } finally {
    initializing = false;
  }
}

function post(msg: EngineResponse, transfer?: Transferable[]) {
  (self as unknown as Worker).postMessage(msg, transfer ?? []);
}

/**
 * Wrap a handler that produces a response, measuring:
 *  - `engineMs`: time inside the handler (Rust call + buffer prep)
 *  - `workerMs`: total time from request receipt to postMessage
 * Both are stamped onto the response `timing` field.
 */
async function timedHandle(req: EngineRequest): Promise<void> {
  const workerStart = performance.now();
  // `engine` is guaranteed non-null by the dispatch loop below.
  const e = engine!;
  let engineMs = 0;
  const engineStart = performance.now();

  switch (req.type) {
    case "load": {
      const n = e.load_fasta(req.fasta);
      engineMs = performance.now() - engineStart;
      post({ type: "result", reqId: req.reqId, ok: true, data: n, timing: { engineMs, workerMs: 0 } });
      console.log(`Loaded ${n} sequences`);
      break;
    }
    case "viewport": {
      const shape = getViewportShape(req);
      if (!shape) {
        post({
          type: "error",
          reqId: req.reqId,
          message: `Viewport bounds must be non-negative safe integers within ${SAB_MAX_BYTES} bytes`,
        });
        break;
      }

      const view = e.update_viewport(req.startRow, req.endRow, req.startCol, req.endCol);
      const len = view.byteLength;

      // Validate that the viewport data fits in the SharedArrayBuffer before
      // writing. If it doesn't, return an error rather than crashing the worker
      // with a RangeError from sabView.set().
      if (len > SAB_MAX_BYTES) {
        post({
          type: "error",
          reqId: req.reqId,
          message: `Viewport too large: ${len} bytes exceeds SAB capacity of ${SAB_MAX_BYTES}`,
        });
        break;
      }
      if (!sabView) {
        post({
          type: "error",
          reqId: req.reqId,
          message: "SharedArrayBuffer not initialized",
        });
        break;
      }

      // SAB path: `update_viewport` returns a new Uint8Array (copied from WASM
      // linear memory into a JS-owned buffer). We then do a single fast
      // `sabView.set()` memcpy into the SharedArrayBuffer and send only a tiny
      // control message — no ArrayBuffer transfer via postMessage.
      //
      // NOTE: We deliberately do NOT use `update_viewport_into(&mut [u8])`
      // here. wasm-bindgen marshals `&mut [u8]` by copying the entire JS
      // Uint8Array into WASM linear memory and back out, which for our 16MB
      // SAB view adds ~3ms per call. The `set()` approach is a single
      // typed-array memcpy and is dramatically faster.
      sabView.set(view, 0);

      // Derive metadata from actual engine output, not request bounds.
      // Engine clamps ranges and pads with spaces; we must compute actual rows
      // from the returned byte length and clamped column count.
      const actualRows = Math.floor(len / shape.cols);

      const data: ViewportResult = {
        rows: actualRows,
        cols: shape.cols,
        startRow: req.startRow,
        startCol: req.startCol,
      };
      engineMs = performance.now() - engineStart;
      const workerMs = performance.now() - workerStart;
      post({
        type: "result",
        reqId: req.reqId,
        ok: true,
        data,
        sabLen: len,
        timing: { engineMs, workerMs },
      });
      break;
    }

    case "search": {
      // `e.search` returns one `SearchResult` per matrix (nucleotide, amino
      // acid, record names), serialized via serde_wasm_bindgen.
      const data: SearchResult = e.search(req.query, req.checkRecordNames);
      console.log(`Search query: ${req.query}, checkRecordNames: ${req.checkRecordNames}, result: ${JSON.stringify(data)}`);
      engineMs = performance.now() - engineStart;
      const workerMs = performance.now() - workerStart;
      post({
        type: "result",
        reqId: req.reqId,
        ok: true,
        data,
        timing: { engineMs, workerMs },
      });
      break;
    }

    case "translate": {
      // `e.translate` returns raw amino-acid bytes, padded to a fixed stride
      // just like `update_viewport` — reuse the same SAB copy-and-describe path.
      const view = e.translate(
        req.startRow,
        req.endRow,
        req.startCol,
        req.endCol,
        req.readingFrame
      );
      console.log(`Translated rows ${req.startRow}-${req.endRow}, cols ${req.startCol}-${req.endCol}, returned reading frame: ${req.readingFrame}`);
      const len = view.byteLength;

      if (len > SAB_MAX_BYTES) {
        post({
          type: "error",
          reqId: req.reqId,
          message: `Translate result too large: ${len} bytes exceeds SAB capacity of ${SAB_MAX_BYTES}`,
        });
        break;
      }
      if (!sabView) {
        post({
          type: "error",
          reqId: req.reqId,
          message: "SharedArrayBuffer not initialized",
        });
        break;
      }
      sabView.set(view, 0);

      // Rust's `translate` now uses the same inclusive `[start, end]` ranges
      // and fixed-stride row padding as `update_viewport`.
      const reqCols = Math.max(0, req.endCol - req.startCol + 1);
      const actualCols = reqCols > 0 ? reqCols : 0;
      const actualRows = actualCols > 0 ? Math.floor(len / actualCols) : 0;

      const data: ViewportResult = {
        rows: actualRows,
        cols: actualCols,
        startRow: req.startRow,
        startCol: req.startCol,
      };
      console.log(`Viewport result: ${JSON.stringify(data)}`);
      engineMs = performance.now() - engineStart;
      const workerMs = performance.now() - workerStart;
      post({
        type: "result",
        reqId: req.reqId,
        ok: true,
        data,
        sabLen: len,
        timing: { engineMs, workerMs },
      });
      break;
    }

    case "mutate": {
      const errCode = e.mutate_base_subset(req.rows, req.col, req.base);
      engineMs = performance.now() - engineStart;
      if (errCode) {
        post({ type: "result", reqId: req.reqId, ok: false, errorCode: errCode });
      } else {
        post({ type: "result", reqId: req.reqId, ok: true, timing: { engineMs, workerMs: 0 } });
      }
      break;
    }
    case "insert": {
      const errCode = e.insert_at_subset(req.rows, req.col);
      engineMs = performance.now() - engineStart;
      if (errCode) {
        post({ type: "result", reqId: req.reqId, ok: false, errorCode: errCode });
      } else {
        post({ type: "result", reqId: req.reqId, ok: true, timing: { engineMs, workerMs: 0 } });
      }
      break;
    }
    case "delete": {
      const errCode = e.delete_at_subset(req.rows, req.col);
      engineMs = performance.now() - engineStart;
      if (errCode) {
        post({ type: "result", reqId: req.reqId, ok: false, errorCode: errCode });
      } else {
        post({ type: "result", reqId: req.reqId, ok: true, timing: { engineMs, workerMs: 0 } });
      }
      break;
    }
    case "deleteColumn": {
      const errCode = e.delete_column(req.col);
      engineMs = performance.now() - engineStart;
      if (errCode) {
        post({ type: "result", reqId: req.reqId, ok: false, errorCode: errCode });
      } else {
        post({ type: "result", reqId: req.reqId, ok: true, timing: { engineMs, workerMs: 0 } });
      }
      break;
    }
    case "undo": {
      const r = e.undo();
      engineMs = performance.now() - engineStart;
      post({ type: "result", reqId: req.reqId, ok: true, data: r, timing: { engineMs, workerMs: 0 } });
      break;
    }
    case "redo": {
      const r = e.redo();
      engineMs = performance.now() - engineStart;
      post({ type: "result", reqId: req.reqId, ok: true, data: r, timing: { engineMs, workerMs: 0 } });
      break;
    }
    case "meta": {
      const data: Meta = {
        sequences: e.get_sequence_count(),
        width: e.get_alignment_width(),
        undoDepth: e.undo_depth(),
        redoDepth: e.redo_depth(),
      };
      engineMs = performance.now() - engineStart;
      post({ type: "result", reqId: req.reqId, ok: true, data, timing: { engineMs, workerMs: 0 } });
      break;
    }
    case "name": {
      const data = e.get_name(req.row);
      engineMs = performance.now() - engineStart;
      post({ type: "result", reqId: req.reqId, ok: true, data, timing: { engineMs, workerMs: 0 } });
      break;
    }
    case "moveHorizontal": {
      const direction = req.direction === "Left" ? MoveDirection.Left : MoveDirection.Right;
      const errCode = e.move_horizontal(req.row, req.cols, direction);
      engineMs = performance.now() - engineStart;
      if (errCode) {
        post({ type: "result", reqId: req.reqId, ok: false, errorCode: errCode });
      } else {
        post({ type: "result", reqId: req.reqId, ok: true, timing: { engineMs, workerMs: 0 } });
      }
      break;
    }
    case "moveRowsUp": {
      const errCode = e.move_rows_up(req.rows);
      engineMs = performance.now() - engineStart;
      if (errCode) {
        post({ type: "result", reqId: req.reqId, ok: false, errorCode: errCode });
      } else {
        post({ type: "result", reqId: req.reqId, ok: true, timing: { engineMs, workerMs: 0 } });
      }
      break;
    }
    case "moveRowsDown": {
      const errCode = e.move_rows_down(req.rows);
      engineMs = performance.now() - engineStart;
      if (errCode) {
        post({ type: "result", reqId: req.reqId, ok: false, errorCode: errCode });
      } else {
        post({ type: "result", reqId: req.reqId, ok: true, timing: { engineMs, workerMs: 0 } });
      }
      break;
    }
  }
}

/** Backwards-compatible alias used by the init drain loop. */
const handle = timedHandle;

self.onmessage = async (ev: MessageEvent<EngineRequest>) => {
  const req = ev.data;
  if (!engine) {
    // Queue the command; ensureEngine will drain the queue once init finishes.
    queue.push(req);
    await ensureEngine();
    return;
  }
  try {
    await handle(req);
  } catch (err) {
    post({
      type: "error",
      reqId: req.reqId,
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

// Kick off initialization immediately on worker startup so the client receives
// the "ready" signal without waiting for the first command.
ensureEngine();
