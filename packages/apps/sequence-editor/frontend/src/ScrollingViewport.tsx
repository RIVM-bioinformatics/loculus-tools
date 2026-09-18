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

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { SeqEditorUtil } from './utils/SeqEditorUtil';
import type {
  ChunkStore,
  ScrollingViewportProps,
  WindowInfo,
} from './models';
import {
  CELL_H,
  CELL_W,
  LABEL_W,
  OVERSCAN,
  TRIGGER_COLS,
} from './constants';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------


export const ScrollingViewport = ({ eng, meta }: ScrollingViewportProps) => {
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
  /** Measured from ResizeObserver; fills the available editor workspace. */
  const [containerH, setContainerH] = useState(480);
  /** Monotonic tick used to schedule canvas repaints without storing chunk in state. */
  const [renderTick, setRenderTick] = useState(0);
  const [windowInfo, setWindowInfo] = useState<null | WindowInfo>(null);

  const { sequences: numRows, width: totalCols } = meta;
  const visibleCols = Math.max(1, Math.floor((containerW - LABEL_W) / CELL_W));

  // ---- Fetch sequence names whenever the alignment changes ----
  useEffect(() => {
    setNames([]);
    if (!eng.ready || numRows === 0) {
      return;
    }
    let cancelled = false;
    (async () => {
      const ns: string[] = [];
      for (let i = 0; i < numRows; i++) {
        if (cancelled) {
          return;
        }
        ns.push(await eng.name(i));
      }
      if (!cancelled) {
        setNames(ns);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eng, numRows, meta]);

  // ---- Track container width for responsive visible-column count ----
  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const ro = new ResizeObserver((entries) => {
      const { height, width } = entries[0]?.contentRect ?? {};
      if (width && width > 0) {
        setContainerW(width);
      }
      if (height && height > 0) {
        setContainerH(height);
      }
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
      if (fetchColStart >= fetchColEnd) {
        return;
      }
      if (fetchingRef.current || numRows === 0) {
        return;
      }
      fetchingRef.current = true;
      setWindowInfo((w) => (w ? { ...w, fetching: true } : null));
      try {
        const res = await eng.viewport({
          endCol: fetchColEnd,
          endRow: numRows - 1,
          startCol: fetchColStart,
          startRow: 0,
        });
        const incoming: ChunkStore = {
          colEnd: res.startCol + res.cols,
          cols: res.cols,
          colStart: res.startCol,
          data: res.bytes, // already a standalone copy from the worker
          numRows: res.rows,
        };
        let chunk = chunkRef.current
          ? SeqEditorUtil.stitchChunks(chunkRef.current, incoming)
          : incoming;
        chunk = SeqEditorUtil.trimChunk(chunk, keepColStart, keepColEnd);
        chunkRef.current = chunk;

        // Snapshot scroll position for window info
        const scrollX = scrollerRef.current?.scrollLeft ?? 0;
        const vcs = Math.floor(scrollX / CELL_W);
        const vce = Math.min(vcs + visibleCols, totalCols);
        setWindowInfo({
          bufBytes: chunk.data.byteLength,
          bufEnd: chunk.colEnd,
          bufStart: chunk.colStart,
          fetching: false,
          visEnd: vce,
          visStart: vcs,
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
    if (!eng.ready || fetchingRef.current || numRows === 0) {
      return;
    }
    const el = scrollerRef.current;
    if (!el) {
      return;
    }

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
    if (eng.ready && numRows > 0) {
      checkAndFetch();
    }
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
    if (!canvas || !scroller) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    canvas.width = containerW;
    canvas.height = containerH;

    // Background
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, containerW, containerH);

    if (numRows === 0) {
      ctx.fillStyle = '#aaa';
      ctx.font = '14px sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText('Load a FASTA to begin.', 20, 20);
      return;
    }

    const buf = chunkRef.current;
    if (!buf) {
      ctx.fillStyle = '#aaa';
      ctx.font = '14px sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText('Loading initial window…', 20, 20);
      return;
    }

    const scrollX = scroller.scrollLeft;
    const scrollY = scroller.scrollTop;

    const visColStart = Math.floor(scrollX / CELL_W);
    const visColEnd = Math.min(visColStart + visibleCols, totalCols);
    const visRowStart = Math.floor(scrollY / CELL_H);
    // +2 to avoid clipping a partially visible bottom row
    const visRowEnd = Math.min(
      visRowStart + Math.ceil(containerH / CELL_H) + 2,
      numRows,
    );

    ctx.font = '13px monospace';
    ctx.textBaseline = 'top';

    for (let r = visRowStart; r < visRowEnd; r++) {
      const y = r * CELL_H - scrollY;

      // Bases first so the label can paint over any overlap
      for (let c = visColStart; c < visColEnd; c++) {
        const x = LABEL_W + (c - visColStart) * CELL_W;
        if (c < buf.colStart || c >= buf.colEnd) {
          // Column not yet in buffer — indicate with a placeholder
          ctx.fillStyle = '#e8e8e8';
          ctx.fillRect(x, y, CELL_W, CELL_H);
        } else {
          const bufIdx = r * buf.cols + (c - buf.colStart);
          const ch = String.fromCharCode(buf.data[bufIdx]);
          ctx.fillStyle = SeqEditorUtil.colorFor(ch);
          ctx.fillText(ch, x, y + 2);
        }
      }

      // Row label — drawn on top with an opaque background so it acts as a
      // frozen/sticky left pane regardless of horizontal scroll position.
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(0, y, LABEL_W, CELL_H);
      const name = names[r] ?? `seq${r}`;
      ctx.fillStyle = '#555';
      ctx.fillText(
        `${String(r).padStart(3, '0')} ${name.slice(0, 14).padEnd(14)} |`,
        2,
        y + 2,
      );
    }
  }, [containerH, renderTick, containerW, visibleCols, totalCols, numRows, names]);

  // Content dimensions for the scroll spacer
  const totalW = LABEL_W + totalCols * CELL_W;
  const totalH = Math.max(numRows * CELL_H, 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, height: '100%', minHeight: 0 }}>
      {/* Window status bar */}
      <div
        style={{
          background: '#f0f0f0',
          borderRadius: 3,
          color: '#666',
          fontFamily: 'monospace',
          fontSize: 11,
          minHeight: 18,
          padding: '2px 4px',
        }}
      >
        {windowInfo ? (
          <>
            <span style={{ color: windowInfo.fetching ? '#c66' : '#080' }}>
              {windowInfo.fetching ? 'fetching…' : 'idle'}
            </span>
            {' | '}
            {'visible cols '}
            {windowInfo.visStart}
            {'–'}
            {windowInfo.visEnd}
            {' | '}
            {'buffer ['}
            {windowInfo.bufStart}
            {','}
            {windowInfo.bufEnd}
            {') ='}
            {' '}
            {windowInfo.bufEnd - windowInfo.bufStart}
            {' '}
            {'cols'}
            {' | '}
            {(windowInfo.bufBytes / 1024).toFixed(1)}
            {' '}
            {'KB'}
            {' | '}
            {'overscan L='}
            {windowInfo.visStart - windowInfo.bufStart}
            {' '}
            {'R='}
            {windowInfo.bufEnd - windowInfo.visEnd}
          </>
        ) : numRows === 0 ? (
          'no alignment loaded'
        ) : (
          'initialising…'
        )}
      </div>
      {/* Viewport: canvas + transparent scroll overlay */}
      <div
        ref={containerRef}
        style={{ flex: 1, minHeight: 0, position: 'relative', width: '100%' }}
      >
        {/* Paint layer */}
        <canvas
          ref={canvasRef}
          style={{ height: '100%', left: 0, position: 'absolute', top: 0, width: '100%', zIndex: 0 }}
        />
        {/*
         * Scroll layer: transparent but on top (zIndex 1) so native scrollbars
         * and all pointer events (wheel, click-drag scrollbar) are captured.
         * The canvas is visible underneath because this div has no background.
         */}
        <div
          onScroll={onScroll}
          ref={scrollerRef}
          style={{
            inset: 0,
            overflow: 'scroll',
            position: 'absolute',
            zIndex: 1,
          }}
        >
          {/* Spacer defines the scrollable extent */}
          <div
            style={{
              height: totalH,
              pointerEvents: 'none',
              width: totalW,
            }}
          />
        </div>
      </div>
    </div>
  );
};
