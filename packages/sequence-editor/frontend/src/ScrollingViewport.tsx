/**
 * ScrollingViewport — canvas-based MSA column viewer with a sliding window.
 *
 * Design
 * ──────
 * The user's visible column range is padded on both sides by OVERSCAN columns.
 * Only the bytes inside [visColStart - OVERSCAN, visColEnd + OVERSCAN] are kept
 * in memory (the "active window"). A new engine fetch is fired as soon as the
 * visible area is within TRIGGER_COLS of either window edge (30 % of OVERSCAN).
 *
 * Stitching
 * ─────────
 * Each fetch returns the *missing* strip (left of or right of the current
 * buffer). The strip is merged (stitched) with the existing buffer so only
 * incremental bytes cross the worker bridge. After stitching the buffer is
 * trimmed to the current keep window, discarding columns that have scrolled out
 * of relevance.
 *
 * Scrolling
 * ─────────
 * A transparent overlay <div> sits above the canvas at z-index 1. It owns the
 * native scrollbar (overflow: scroll) and a full-size spacer that defines the
 * scrollable extent. All pointer events go to this layer; the canvas beneath
 * is purely a paint surface.
 */

import { useRef, useState, useCallback, useEffect } from "react";
import type { EngineClient } from "./engine/useEngineWorker";
import type { Meta } from "./engine/protocol";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of columns to keep beyond each edge of the visible area. */
const OVERSCAN = 100;
/**
 * Trigger a new fetch when the visible edge is within this many columns of the
 * buffer boundary — 30 % of OVERSCAN.
 */
const TRIGGER_COLS = Math.round(OVERSCAN * 0.3); // 30

const CELL_W = 10; // px per base column
const CELL_H = 18; // px per sequence row
const LABEL_W = 160; // px reserved for row labels
const VIEWPORT_H = 480; // fixed canvas height

const BASE_COLORS: Record<string, string> = {
  A: "#2e7d32",
  T: "#c62828",
  G: "#ef6c00",
  C: "#1565c0",
  "-": "#9e9e9e",
  "*": "#6a1b9a",
  X: "#6a1b9a",
};
function colorFor(ch: string): string {
  return BASE_COLORS[ch] ?? "#333";
}

// ---------------------------------------------------------------------------
// ChunkStore — the in-memory sliding window buffer
// ---------------------------------------------------------------------------

interface ChunkStore {
  /** Inclusive left column index (alignment-space). */
  colStart: number;
  /** Exclusive right column index (alignment-space). */
  colEnd: number;
  numRows: number;
  /** = colEnd − colStart */
  cols: number;
  /** Row-major byte array: index = row * cols + (col − colStart). */
  data: Uint8Array;
}

/**
 * Merge two column strips into one contiguous buffer.
 * Strip `b` wins in any overlap region (fresher data).
 */
function stitchChunks(a: ChunkStore, b: ChunkStore): ChunkStore {
  const mergedStart = Math.min(a.colStart, b.colStart);
  const mergedEnd = Math.max(a.colEnd, b.colEnd);
  const mergedCols = mergedEnd - mergedStart;
  const data = new Uint8Array(a.numRows * mergedCols);
  for (let r = 0; r < a.numRows; r++) {
    // Write a's row, then overlay b's row so b wins in the overlap.
    data.set(
      a.data.subarray(r * a.cols, (r + 1) * a.cols),
      r * mergedCols + (a.colStart - mergedStart),
    );
    data.set(
      b.data.subarray(r * b.cols, (r + 1) * b.cols),
      r * mergedCols + (b.colStart - mergedStart),
    );
  }
  return {
    colStart: mergedStart,
    colEnd: mergedEnd,
    numRows: a.numRows,
    cols: mergedCols,
    data,
  };
}

/**
 * Trim a ChunkStore to [keepStart, keepEnd).
 * Returns the original object unchanged if no trim is needed.
 */
function trimChunk(buf: ChunkStore, keepStart: number, keepEnd: number): ChunkStore {
  const s = Math.max(buf.colStart, keepStart);
  const e = Math.min(buf.colEnd, keepEnd);
  if (s <= buf.colStart && e >= buf.colEnd) return buf; // already within bounds
  if (s >= e) return buf; // degenerate — keep as-is
  const cols = e - s;
  const data = new Uint8Array(buf.numRows * cols);
  for (let r = 0; r < buf.numRows; r++) {
    const srcStart = r * buf.cols + (s - buf.colStart);
    data.set(buf.data.subarray(srcStart, srcStart + cols), r * cols);
  }
  return { colStart: s, colEnd: e, numRows: buf.numRows, cols, data };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ScrollingViewportProps {
  eng: EngineClient;
  meta: Meta;
}

/** Debug info exposed to a sibling status bar. */
interface WindowInfo {
  bufStart: number;
  bufEnd: number;
  bufBytes: number;
  visStart: number;
  visEnd: number;
  fetching: boolean;
}

export function ScrollingViewport({ eng, meta }: ScrollingViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  /** Transparent overflow:scroll layer — hosts the native scrollbar. */
  const scrollerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /** Active sliding window buffer. Written by fetch callbacks; read by paint. */
  const chunkRef = useRef<ChunkStore | null>(null);
  /** Guards against concurrent in-flight fetches. */
  const fetchingRef = useRef(false);

  const [names, setNames] = useState<string[]>([]);
  /** Measured from ResizeObserver; drives visibleCols. */
  const [containerW, setContainerW] = useState(900);
  /** Monotonic tick used to schedule canvas repaints without storing chunk in state. */
  const [renderTick, setRenderTick] = useState(0);
  const [windowInfo, setWindowInfo] = useState<WindowInfo | null>(null);

  const { sequences: numRows, width: totalCols } = meta;
  const visibleCols = Math.max(1, Math.floor((containerW - LABEL_W) / CELL_W));

  // ---- Fetch sequence names whenever the alignment changes ----
  useEffect(() => {
    setNames([]);
    if (!eng.ready || numRows === 0) return;
    let cancelled = false;
    (async () => {
      const ns: string[] = [];
      for (let i = 0; i < numRows; i++) {
        if (cancelled) return;
        ns.push(await eng.name(i));
      }
      if (!cancelled) setNames(ns);
    })();
    return () => {
      cancelled = true;
    };
  }, [eng, numRows, meta]);

  // ---- Track container width for responsive visible-column count ----
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setContainerW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- Engine fetch + stitch + trim ----
  const doFetch = useCallback(
    async (
      fetchColStart: number,
      fetchColEnd: number,
      keepColStart: number,
      keepColEnd: number,
    ) => {
      if (fetchColStart >= fetchColEnd) return;
      if (fetchingRef.current || numRows === 0) return;
      fetchingRef.current = true;
      setWindowInfo((w) => (w ? { ...w, fetching: true } : null));
      try {
        const res = await eng.viewport({
          startRow: 0,
          endRow: numRows - 1,
          startCol: fetchColStart,
          endCol: fetchColEnd,
        });
        const incoming: ChunkStore = {
          colStart: res.startCol,
          colEnd: res.startCol + res.cols,
          numRows: res.rows,
          cols: res.cols,
          data: res.bytes, // already a standalone copy from the worker
        };
        let chunk = chunkRef.current
          ? stitchChunks(chunkRef.current, incoming)
          : incoming;
        chunk = trimChunk(chunk, keepColStart, keepColEnd);
        chunkRef.current = chunk;

        // Snapshot scroll position for window info
        const scrollX = scrollerRef.current?.scrollLeft ?? 0;
        const vcs = Math.floor(scrollX / CELL_W);
        const vce = Math.min(vcs + visibleCols, totalCols);
        setWindowInfo({
          bufStart: chunk.colStart,
          bufEnd: chunk.colEnd,
          bufBytes: chunk.data.byteLength,
          visStart: vcs,
          visEnd: vce,
          fetching: false,
        });
        setRenderTick((t) => t + 1);
      } finally {
        fetchingRef.current = false;
      }
    },
    [eng, numRows, visibleCols, totalCols],
  );

  // ---- Sliding-window trigger logic ----
  const checkAndFetch = useCallback(() => {
    if (!eng.ready || fetchingRef.current || numRows === 0) return;
    const el = scrollerRef.current;
    if (!el) return;

    const visColStart = Math.floor(el.scrollLeft / CELL_W);
    const visColEnd = Math.min(visColStart + visibleCols, totalCols);
    // The keep window is [visColStart - OVERSCAN, visColEnd + OVERSCAN].
    const keepStart = Math.max(0, visColStart - OVERSCAN);
    const keepEnd = Math.min(totalCols, visColEnd + OVERSCAN);

    const buf = chunkRef.current;

    if (!buf) {
      // No data yet — fetch the initial window.
      doFetch(keepStart, keepEnd, keepStart, keepEnd);
      return;
    }

    const leftMargin = visColStart - buf.colStart;
    const rightMargin = buf.colEnd - visColEnd;

    if (leftMargin < TRIGGER_COLS && buf.colStart > 0) {
      // Visible area is within TRIGGER_COLS of the left buffer boundary.
      // Fetch the missing left strip; trim any excess from the right.
      const fetchStart = Math.max(0, visColStart - OVERSCAN);
      doFetch(fetchStart, buf.colStart, keepStart, keepEnd);
    } else if (rightMargin < TRIGGER_COLS && buf.colEnd < totalCols) {
      // Visible area is within TRIGGER_COLS of the right buffer boundary.
      // Fetch the missing right strip; trim any excess from the left.
      const fetchEnd = Math.min(totalCols, visColEnd + OVERSCAN);
      doFetch(buf.colEnd, fetchEnd, keepStart, keepEnd);
    }
  }, [eng.ready, numRows, visibleCols, totalCols, doFetch]);

  // ---- Reset and initial fetch when a new FASTA is loaded ----
  useEffect(() => {
    chunkRef.current = null;
    setWindowInfo(null);
    const el = scrollerRef.current;
    if (el) {
      el.scrollLeft = 0;
      el.scrollTop = 0;
    }
    setRenderTick((t) => t + 1);
    if (eng.ready && numRows > 0) checkAndFetch();
    // checkAndFetch is excluded from deps intentionally:
    // we only want to re-run this when meta (the loaded alignment) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, eng.ready]);

  // ---- Scroll handler ----
  const onScroll = useCallback(() => {
    setRenderTick((t) => t + 1);
    checkAndFetch();
  }, [checkAndFetch]);

  // ---- Canvas paint ----
  useEffect(() => {
    const canvas = canvasRef.current;
    const scroller = scrollerRef.current;
    if (!canvas || !scroller) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = containerW;
    canvas.height = VIEWPORT_H;

    // Background
    ctx.fillStyle = "#fafafa";
    ctx.fillRect(0, 0, containerW, VIEWPORT_H);

    if (numRows === 0) {
      ctx.fillStyle = "#aaa";
      ctx.font = "14px sans-serif";
      ctx.textBaseline = "top";
      ctx.fillText("Load a FASTA to begin.", 20, 20);
      return;
    }

    const buf = chunkRef.current;
    if (!buf) {
      ctx.fillStyle = "#aaa";
      ctx.font = "14px sans-serif";
      ctx.textBaseline = "top";
      ctx.fillText("Loading initial window…", 20, 20);
      return;
    }

    const scrollX = scroller.scrollLeft;
    const scrollY = scroller.scrollTop;

    const visColStart = Math.floor(scrollX / CELL_W);
    const visColEnd = Math.min(visColStart + visibleCols, totalCols);
    const visRowStart = Math.floor(scrollY / CELL_H);
    // +2 to avoid clipping a partially visible bottom row
    const visRowEnd = Math.min(
      visRowStart + Math.ceil(VIEWPORT_H / CELL_H) + 2,
      numRows,
    );

    ctx.font = "13px monospace";
    ctx.textBaseline = "top";

    for (let r = visRowStart; r < visRowEnd; r++) {
      const y = r * CELL_H - scrollY;

      // Bases first so the label can paint over any overlap
      for (let c = visColStart; c < visColEnd; c++) {
        const x = LABEL_W + (c - visColStart) * CELL_W;
        if (c < buf.colStart || c >= buf.colEnd) {
          // Column not yet in buffer — indicate with a placeholder
          ctx.fillStyle = "#e8e8e8";
          ctx.fillRect(x, y, CELL_W, CELL_H);
        } else {
          const bufIdx = r * buf.cols + (c - buf.colStart);
          const ch = String.fromCharCode(buf.data[bufIdx]);
          ctx.fillStyle = colorFor(ch);
          ctx.fillText(ch, x, y + 2);
        }
      }

      // Row label — drawn on top with an opaque background so it acts as a
      // frozen/sticky left pane regardless of horizontal scroll position.
      ctx.fillStyle = "#f5f5f5";
      ctx.fillRect(0, y, LABEL_W, CELL_H);
      const name = names[r] ?? `seq${r}`;
      ctx.fillStyle = "#555";
      ctx.fillText(
        `${String(r).padStart(3, "0")} ${name.slice(0, 14).padEnd(14)} |`,
        2,
        y + 2,
      );
    }
  }, [renderTick, containerW, visibleCols, totalCols, numRows, names]);

  // Content dimensions for the scroll spacer
  const totalW = LABEL_W + totalCols * CELL_W;
  const totalH = Math.max(numRows * CELL_H, 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {/* Window status bar */}
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 11,
          color: "#666",
          padding: "2px 4px",
          background: "#f0f0f0",
          borderRadius: 3,
          minHeight: 18,
        }}
      >
        {windowInfo ? (
          <>
            <span style={{ color: windowInfo.fetching ? "#c66" : "#080" }}>
              {windowInfo.fetching ? "fetching…" : "idle"}
            </span>
            {" | "}
            visible cols {windowInfo.visStart}–{windowInfo.visEnd}
            {" | "}
            buffer [{windowInfo.bufStart}, {windowInfo.bufEnd}) ={" "}
            {windowInfo.bufEnd - windowInfo.bufStart} cols
            {" | "}
            {(windowInfo.bufBytes / 1024).toFixed(1)} KB
            {" | "}
            overscan L={windowInfo.visStart - windowInfo.bufStart} R=
            {windowInfo.bufEnd - windowInfo.visEnd}
          </>
        ) : numRows === 0 ? (
          "no alignment loaded"
        ) : (
          "initialising…"
        )}
      </div>

      {/* Viewport: canvas + transparent scroll overlay */}
      <div
        ref={containerRef}
        style={{ position: "relative", width: "100%", height: VIEWPORT_H }}
      >
        {/* Paint layer */}
        <canvas
          ref={canvasRef}
          style={{ position: "absolute", top: 0, left: 0, zIndex: 0 }}
        />
        {/*
         * Scroll layer: transparent but on top (zIndex 1) so native scrollbars
         * and all pointer events (wheel, click-drag scrollbar) are captured.
         * The canvas is visible underneath because this div has no background.
         */}
        <div
          ref={scrollerRef}
          style={{
            position: "absolute",
            inset: 0,
            overflow: "scroll",
            zIndex: 1,
          }}
          onScroll={onScroll}
        >
          {/* Spacer defines the scrollable extent */}
          <div
            style={{
              width: totalW,
              height: totalH,
              pointerEvents: "none",
            }}
          />
        </div>
      </div>
    </div>
  );
}
