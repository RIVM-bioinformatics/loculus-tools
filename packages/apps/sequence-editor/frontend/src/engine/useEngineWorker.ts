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

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { RefObject } from 'react';

import type {
  EngineRequest,
  EngineResponse,
  Meta,
  SearchResult,
  ViewportResult,
} from './protocol';

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
  /** Estimated worker→main postMessage latency (ms). */
  bridgeBackMs: number;
  /** Estimated main→worker postMessage latency (ms). */
  bridgeOutMs: number;
  /** Number of bytes transferred (for viewport responses), else 0. */
  bytes: number;
  /** Time inside the Rust engine call (ms), worker-reported. */
  engineMs: number;
  /** Total call→response latency (ms), main-thread perspective. */
  totalMs: number;
  /** Total time worker held the request (ms), worker-reported. */
  workerMs: number;
}

export interface EngineClient {
  delete: (rows: number[], col: number) => Promise<void>;
  deleteColumn: (col: number) => Promise<void>;
  /** Last error surfaced by the worker (or null). */
  error: null | string;
  exportFasta: () => Promise<string>;
  insert: (rows: number[], col: number) => Promise<void>;
  /**
   * Synchronous ref to the most recent timing. Read this immediately after an
   * awaited call (e.g. in a benchmark loop) — React state may not have
   * flushed yet within the same microtask.
   */
  lastTimingRef: RefObject<CallTiming | null>;
  load: (fasta: string) => Promise<number>;
  meta: () => Promise<Meta>;
  moveHorizontal: (row: number, cols: number[], direction: 'Left' | 'Right') => Promise<void>;
  moveRowsDown: (rows: number[]) => Promise<void>;
  moveRowsUp: (rows: number[]) => Promise<void>;
  mutate: (rows: number[], col: number, base: string) => Promise<void>;
  mutateRange: (rows: number[], startCol: number, endCol: number, base: string) => Promise<void>;
  name: (row: number) => Promise<string>;
  /** Whether the worker has finished instantiating the WASM engine. */
  ready: boolean;
  redo: () => Promise<boolean>;
  search: (query: string, checkRecordNames?: boolean) => Promise<SearchResult>;
  translate: (r: {
    endCol: number;
    endRow: number;
    /** 0-indexed reading frame (0, 1, or 2). */
    readingFrame: number;
    startCol: number;
    startRow: number;
  }) => Promise<{ bytes: Uint8Array } & ViewportResult>;
  undo: () => Promise<boolean>;
  viewport: (r: {
    endCol: number;
    endRow: number;
    startCol: number;
    startRow: number;
  }) => Promise<{ bytes: Uint8Array } & ViewportResult>;
}

/** Distributive Omit so union members keep their discriminant. */
type DistributiveOmit<T, K extends number | string | symbol> = T extends unknown
  ? Omit<T, K>
  : never;
/** A request without the reqId (the client fills it in). */
type EngineRequestInit = DistributiveOmit<EngineRequest, 'reqId'>;

type PendingEntry = {
  bytes: number;
  reject: (reason: Error) => void;
  resolve: Resolver;
  sentTs: number;
};

type Resolver = (res: EngineResponse) => void;

let reqCounter = 0;

export const useEngineWorker = (): EngineClient => {
  const workerRef = useRef<null | Worker>(null);
  const pendingRef = useRef<Map<number, PendingEntry>>(new Map());
  const workerFailedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<null | string>(null);
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
  const sabRef = useRef<null | SharedArrayBuffer>(null);

  useEffect(() => {
    workerFailedRef.current = false;
    const worker = new Worker(new URL('./engine.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;

    const rejectPending = (reason: Error) => {
      for (const entry of pendingRef.current.values()) {
        entry.reject(reason);
      }
      pendingRef.current.clear();
    };

    worker.onmessage = (ev: MessageEvent<EngineResponse>) => {
      const res = ev.data;
      if (res.type === 'sab') {
        sabRef.current = res.buffer;
        return;
      }
      if (res.type === 'ready') {
        setReady(true);
        return;
      }
      if (res.type === 'error') {
        if (res.reqId < 0) {
          const initError = new Error(res.message);
          workerFailedRef.current = true;
          setReady(false);
          setError(res.message);
          rejectPending(initError);
          return;
        }
        // Resolve the matching pending promise with the error response so the
        // caller's promise rejects via the result-handler below.
        const entry = pendingRef.current.get(res.reqId);
        if (entry) {
          entry.resolve(res);
          pendingRef.current.delete(res.reqId);
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
      const entry = pendingRef.current.get(res.reqId);
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
            typeof res.data === 'object' &&
            'rows' in res.data &&
            sabRef.current
          ) {
            const view = new Uint8Array(sabRef.current, 0, res.sabLen);
            // Copy into a standalone buffer so callers own their bytes and are
            // immune to subsequent viewport calls overwriting the SAB.
            const copy = new Uint8Array(res.sabLen);
            copy.set(view);
            (res.data as { bytes: Uint8Array } & ViewportResult).bytes = copy;
          }

          // Record timing if the worker reported it.
          if (res.timing) {
            const receivedTs = performance.now();
            const totalMs = receivedTs - entry.sentTs;
            const { engineMs, workerMs } = res.timing;
            const t: CallTiming = {
              bridgeBackMs: Math.max(0, totalMs - workerMs),
              bridgeOutMs: Math.max(0, workerMs - engineMs),
              bytes: res.sabLen ?? (res.transfer ? res.transfer.byteLength : entry.bytes),
              engineMs,
              totalMs,
              workerMs,
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
        pendingRef.current.delete(res.reqId);
      }
    };

    worker.onerror = (e) => {
      const message = e.message || 'Worker crashed';
      workerFailedRef.current = true;
      setReady(false);
      setError(message);
      rejectPending(new Error(message));
    };

    worker.onmessageerror = () => {
      const message = 'Engine worker communication failed';
      workerFailedRef.current = true;
      setReady(false);
      setError(message);
      rejectPending(new Error(message));
    };

    return () => {
      workerFailedRef.current = true;
      rejectPending(new Error('Engine worker stopped'));
      worker.terminate();
      workerRef.current = null;
      setReady(false);
    };
  }, []);

  const send = useCallback(
    async <T,>(req: EngineRequestInit): Promise<T> => {
      return new Promise<T>((resolve, reject) => {
        const worker = workerRef.current;
        if (!worker || workerFailedRef.current) {
          reject(new Error(workerFailedRef.current ? 'Engine worker unavailable' : 'Worker not initialized'));
          return;
        }
        const reqId = ++reqCounter;
        const sentTs = performance.now();
        // Estimate payload bytes for viewport (the only binary-bearing request
        // type that returns a large buffer). For requests, the payload is tiny.
        const bytes =
          req.type === 'viewport'
            ? Math.max(0, (req.endRow - req.startRow + 1) * (req.endCol - req.startCol + 1))
            : 0;
        pendingRef.current.set(reqId, {
          bytes,
          reject,
          resolve: (res) => {
            if (res.type === 'result' && res.ok) {
              resolve(res.data as T);
            } else if (res.type === 'result' && !res.ok) {
              const err = new Error(`Engine rejected: ${res.errorCode}`);
              Object.assign(err, { code: res.errorCode });
              reject(err);
            } else if (res.type === 'error') {
              console.log('Worker error:', res.message);
              reject(new Error(res.message));
            } else {
              reject(new Error('Unexpected worker response'));
            }
          },
          sentTs,
        });
        try {
          worker.postMessage({ ...req, reqId });
        } catch (caught) {
          pendingRef.current.delete(reqId);
          reject(caught instanceof Error ? caught : new Error(String(caught)));
        }
      });
    },
    [],
  );

  const toRows = (rows: number[]): Uint32Array => new Uint32Array(rows);

  const load = useCallback(
    async (fasta: string) => send<number>({ fasta, type: 'load' }),
    [send],
  );
  const exportFasta = useCallback(
    async () => send<string>({ type: 'exportFasta' }),
    [send],
  );
  const viewport = useCallback(
    async (r: { endCol: number; endRow: number; startCol: number; startRow: number }) =>
      send<{ bytes: Uint8Array } & ViewportResult>({ type: 'viewport', ...r }),
    [send],
  );

  const search = useCallback(
    async (query: string, checkRecordNames = false) =>
      send<SearchResult>({ checkRecordNames, query, type: 'search' }),
    [send],
  );

  const translate = useCallback(
    async (r: { endCol: number; endRow: number; readingFrame: number; startCol: number; startRow: number }) =>
      send<{ bytes: Uint8Array } & ViewportResult>({ type: 'translate', ...r }),
    [send],
  );

  const mutate = useCallback(
    async (rows: number[], col: number, base: string) =>
      send<void>({ base: base.charCodeAt(0), col, rows: toRows(rows), type: 'mutate' }),
    [send],
  );
  const mutateRange = useCallback(
    async (rows: number[], startCol: number, endCol: number, base: string) =>
      send<void>({ base: base.charCodeAt(0), endCol, rows: toRows(rows), startCol, type: 'mutateRange' }),
    [send],
  );
  const insert = useCallback(
    async (rows: number[], col: number) =>
      send<void>({ col, rows: toRows(rows), type: 'insert' }),
    [send],
  );
  const del = useCallback(
    async (rows: number[], col: number) =>
      send<void>({ col, rows: toRows(rows), type: 'delete' }),
    [send],
  );
  const deleteColumn = useCallback(
    async (col: number) => send<void>({ col, type: 'deleteColumn' }),
    [send],
  );
  const undo = useCallback(async () => send<boolean>({ type: 'undo' }), [send]);
  const redo = useCallback(async () => send<boolean>({ type: 'redo' }), [send]);
  const meta = useCallback(async () => send<Meta>({ type: 'meta' }), [send]);
  const name = useCallback(async (row: number) => send<string>({ row, type: 'name' }), [send]);
  const moveHorizontal = useCallback(
    async (row: number, cols: number[], direction: 'Left' | 'Right') =>
      send<void>({ cols: toRows(cols), direction, row, type: 'moveHorizontal' }),
    [send],
  );
  const moveRowsUp = useCallback(
    async (rows: number[]) => send<void>({ rows: toRows(rows), type: 'moveRowsUp' }),
    [send],
  );
  const moveRowsDown = useCallback(
    async (rows: number[]) => send<void>({ rows: toRows(rows), type: 'moveRowsDown' }),
    [send],
  );

  return {
    delete: del,
    deleteColumn,
    error,
    exportFasta,
    insert,
    lastTimingRef,
    load,
    meta,
    moveHorizontal,
    moveRowsDown,
    moveRowsUp,
    mutate,
    mutateRange,
    name,
    ready,
    redo,
    search,
    translate,
    undo,
    viewport,
  };
};
