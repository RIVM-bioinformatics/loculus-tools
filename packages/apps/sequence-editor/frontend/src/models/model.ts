import type { Meta } from '../engine/protocol';
import type { EngineClient } from '../engine/useEngineWorker';

export type BenchmarkPanelProps = {
  eng: EngineClient;
};

// ---------------------------------------------------------------------------
// ChunkStore — the in-memory sliding window buffer
// ---------------------------------------------------------------------------

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

/** One measured sample: the bridge timing + the render-to-paint time. */
export interface Sample {
  bridgeBackMs: number;
  bridgeOutMs: number;
  bytes: number;
  engineMs: number;
  renderMs: number;
  totalMs: number;
}

export interface ScrollingViewportProps {
  eng: EngineClient;
  meta: Meta;
}

export interface Stats {
  count: number;
  max: number;
  mean: number;
  median: number;
  min: number;
  p95: number;
}

/** Debug info exposed to a sibling status bar. */
export interface WindowInfo {
  bufBytes: number;
  bufEnd: number;
  bufStart: number;
  fetching: boolean;
  visEnd: number;
  visStart: number;
}
