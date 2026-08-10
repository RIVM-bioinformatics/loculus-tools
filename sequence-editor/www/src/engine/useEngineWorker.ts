/**
 * Main-thread client for the MSA engine Web Worker.
 *
 * Exposes a small, typed, promise-based API. Each call posts a request with a
 * unique `reqId` and returns a promise that resolves when the matching
 * `{ type: "result" }` message arrives. Responses are dispatched in O(1) via a
 * `Map<reqId, resolver>`.
 *
 * The worker is created lazily on first use and reused for the component's
 * lifetime. Binary viewport responses arrive via a `SharedArrayBuffer` shared
 * at init time — the main thread reads bytes directly from shared memory, with
 * no per-call transfer or structured clone of binary data.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  EngineRequest,
  EngineResponse,
  Meta,
  ViewportResult,
} from "./protocol";

/**
 * Full timing breakdown for a single engine call, measured on the main thread
 * combined with worker-reported timings.
 *
 *   totalMs     = receivedTs - sentTs            (call → response received)
 *   bridgeOutMs = workerMs - engineMs            (postMessage main→worker, approx)
 *   engineMs    = time inside Rust               (reported by worker)
 *   bridgeBackMs = totalMs - workerMs            (postMessage worker→main, approx)
 *
 * `renderMs` is NOT included here; it is measured separately in the harness
 * via `requestAnimationFrame` after the promise resolves, because render time
 * depends on what the caller does with the result (React commit + paint).
 */
export interface CallTiming {
  /** Total call→response latency (ms), main-thread perspective. */
  totalMs: number;
  /** Time inside the Rust engine call (ms), worker-reported. */
  engineMs: number;
  /** Total time worker held the request (ms), worker-reported. */
  workerMs: number;
  /** Estimated main→worker postMessage latency (ms). */
  bridgeOutMs: number;
  /** Estimated worker→main postMessage latency (ms). */
  bridgeBackMs: number;
  /** Number of bytes transferred (for viewport responses), else 0. */
  bytes: number;
}

export interface EngineClient {
  /** Whether the worker has finished instantiating the WASM engine. */
  ready: boolean;
  /** Last error surfaced by the worker (or null). */
  error: string | null;
  /**
   * Synchronous ref to the most recent timing. Read this immediately after an
   * awaited call (e.g. in a benchmark loop) — React state may not have
   * flushed yet within the same microtask.
   */
  lastTimingRef: React.MutableRefObject<CallTiming | null>;
  load: (fasta: string) => Promise<number>;
  viewport: (r: {
    startRow: number;
    endRow: number;
    startCol: number;
    endCol: number;
  }) => Promise<ViewportResult & { bytes: Uint8Array }>;
  mutate: (rows: number[], col: number, base: string) => Promise<void>;
  insert: (rows: number[], col: number) => Promise<void>;
  delete: (rows: number[], col: number) => Promise<void>;
  deleteColumn: (col: number) => Promise<void>;
  undo: () => Promise<boolean>;
  redo: () => Promise<boolean>;
  meta: () => Promise<Meta>;
  name: (row: number) => Promise<string>;
}

type Resolver = (res: EngineResponse) => void;

/** Distributive Omit so union members keep their discriminant. */
type DistributiveOmit<T, K extends string | number | symbol> = T extends unknown
  ? Omit<T, K>
  : never;

/** A request without the reqId (the client fills it in). */
type EngineRequestInit = DistributiveOmit<EngineRequest, "reqId">;

let reqCounter = 0;

export function useEngineWorker(): EngineClient {
  const workerRef = useRef<Worker | null>(null);
  const pending = useRef<
    Map<number, { resolve: Resolver; sentTs: number; bytes: number }>
  >(new Map());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * Synchronous mirror so callers (e.g. the benchmark) can read
   * the most recent timing *immediately* after an awaited call, without waiting
   * for React state to flush.
   */
  const lastTimingRef = useRef<CallTiming | null>(null);
  /**
   * SharedArrayBuffer received from the worker on init. All viewport responses
   * write into this buffer; the main thread reads bytes directly from it — no
   * per-call transfer or structured-clone of binary data.
   */
  const sabRef = useRef<SharedArrayBuffer | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL("./engine.worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;

    worker.onmessage = (ev: MessageEvent<EngineResponse>) => {
      const res = ev.data;
      if (res.type === "sab") {
        sabRef.current = res.buffer;
        return;
      }
      if (res.type === "ready") {
        setReady(true);
        return;
      }
      if (res.type === "error") {
        // Resolve the matching pending promise with the error response so the
        // caller's promise rejects via the result-handler below.
        const entry = pending.current.get(res.reqId);
        if (entry) {
          entry.resolve(res);
          pending.current.delete(res.reqId);
          // Also surface the error to the general `error` state so UI
          // components that watch `engine.error` are notified, not just the
          // caller's rejected promise.
          setError(res.message);
        } else {
          setError(res.message);
        }
        return;
      }
      // res.type === "result"
      const entry = pending.current.get(res.reqId);
      if (entry) {
        // The `ok: false` variant carries only `errorCode`; all the data-bearing
        // fields (sabLen, data, timing, transfer) only exist on the `ok: true`
        // variant. Narrow the union before touching them.
        if (res.ok) {
          // For SAB-based viewport responses, read bytes directly from the
          // shared buffer using the reported length. No transfer reassembly.
          if (
            res.sabLen !== undefined &&
            res.data &&
            typeof res.data === "object" &&
            "rows" in res.data &&
            sabRef.current
          ) {
            const view = new Uint8Array(sabRef.current, 0, res.sabLen);
            // Copy into a standalone buffer so callers own their bytes and are
            // immune to subsequent viewport calls overwriting the SAB.
            const copy = new Uint8Array(res.sabLen);
            copy.set(view);
            (res.data as ViewportResult & { bytes: Uint8Array }).bytes = copy;
          }

          // Record timing if the worker reported it.
          if (res.timing) {
            const receivedTs = performance.now();
            const totalMs = receivedTs - entry.sentTs;
            const { engineMs, workerMs } = res.timing;
            const t: CallTiming = {
              totalMs,
              engineMs,
              workerMs,
              bridgeOutMs: Math.max(0, workerMs - engineMs),
              bridgeBackMs: Math.max(0, totalMs - workerMs),
              bytes: res.sabLen ?? (res.transfer ? res.transfer.byteLength : entry.bytes),
            };
            lastTimingRef.current = t;
            // NOTE: We intentionally do NOT call setLastTiming(t) here. Updating
            // React state on every worker response causes 500 re-renders during
            // a benchmark run, and each re-render forces the browser to composite
            // — inflating the double-rAF "renderMs" measurement to 100ms+. The
            // benchmark reads lastTimingRef.current (synchronous ref) instead.
          }
        }
        entry.resolve(res);
        pending.current.delete(res.reqId);
      }
    };

    worker.onerror = (e) => {
      setError(e.message || "Worker crashed");
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
      pending.current.clear();
      setReady(false);
    };
  }, []);

  const send = useCallback(
    <T,>(req: EngineRequestInit): Promise<T> => {
      return new Promise<T>((resolve, reject) => {
        const worker = workerRef.current;
        if (!worker) {
          reject(new Error("Worker not initialized"));
          return;
        }
        const reqId = ++reqCounter;
        const sentTs = performance.now();
        // Estimate payload bytes for viewport (the only binary-bearing request
        // type that returns a large buffer). For requests, the payload is tiny.
        const bytes =
          req.type === "viewport"
            ? Math.max(0, (req.endRow - req.startRow + 1) * (req.endCol - req.startCol + 1))
            : 0;
        pending.current.set(reqId, {
          resolve: (res) => {
            if (res.type === "result" && res.ok) {
              resolve(res.data as T);
            } else if (res.type === "result" && !res.ok) {
              const err = new Error(`Engine rejected: ${res.errorCode}`);
              (err as any).code = res.errorCode;
              reject(err);
            } else if (res.type === "error") {
              reject(new Error(res.message));
            } else {
              reject(new Error("Unexpected worker response"));
            }
          },
          sentTs,
          bytes,
        });
        worker.postMessage({ ...req, reqId });
      });
    },
    []
  );

  const toRows = (rows: number[]): Uint32Array => new Uint32Array(rows);

  const load = useCallback(
    (fasta: string) => send<number>({ type: "load", fasta }),
    [send]
  );
  const viewport = useCallback(
    (r: { startRow: number; endRow: number; startCol: number; endCol: number }) =>
      send<ViewportResult & { bytes: Uint8Array }>({ type: "viewport", ...r }),
    [send]
  );
  const mutate = useCallback(
    (rows: number[], col: number, base: string) =>
      send<void>({ type: "mutate", rows: toRows(rows), col, base: base.charCodeAt(0) }),
    [send]
  );
  const insert = useCallback(
    (rows: number[], col: number) =>
      send<void>({ type: "insert", rows: toRows(rows), col }),
    [send]
  );
  const del = useCallback(
    (rows: number[], col: number) =>
      send<void>({ type: "delete", rows: toRows(rows), col }),
    [send]
  );
  const deleteColumn = useCallback(
    (col: number) => send<void>({ type: "deleteColumn", col }),
    [send]
  );
  const undo = useCallback(() => send<boolean>({ type: "undo" }), [send]);
  const redo = useCallback(() => send<boolean>({ type: "redo" }), [send]);
  const meta = useCallback(() => send<Meta>({ type: "meta" }), [send]);
  const name = useCallback((row: number) => send<string>({ type: "name", row }), [send]);

  return {
    ready,
    error,
    lastTimingRef,
    load,
    viewport,
    mutate,
    insert,
    delete: del,
    deleteColumn,
    undo,
    redo,
    meta,
    name,
  };
}
