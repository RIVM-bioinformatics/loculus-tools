import { BASE_COLORS } from '../../constants';
import type {
  ChunkStore,
  Stats,
} from '../../models';

export class SeqEditorUtil {
  public static colorFor(ch: string): string {
    return BASE_COLORS[ch] ?? '#333';
  }

  public static computeStats(values: number[]): Stats {
    if (values.length === 0) {
      return { count: 0, max: 0, mean: 0, median: 0, min: 0, p95: 0 };
    }
    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const pick = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
    return {
      count: sorted.length,
      max: sorted[sorted.length - 1],
      mean: sum / sorted.length,
      median: pick(0.5),
      min: sorted[0],
      p95: pick(0.95),
    };
  }

  public static fmt(ms: number): string {
    return ms < 1 ? ms.toFixed(3) : ms.toFixed(2);
  }

  public static parseRows(csv: string): number[] {
    return csv
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => Number(s))
      .filter((n) => Number.isInteger(n) && n >= 0);
  }


  public static stitchChunks(a: ChunkStore, b: ChunkStore): ChunkStore {
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
      colEnd: mergedEnd,
      cols: mergedCols,
      colStart: mergedStart,
      data,
      numRows: a.numRows,
    };
  }

  /**
 * Trim a ChunkStore to [keepStart, keepEnd).
 * Returns the original object unchanged if no trim is needed.
 */
  public static trimChunk(buf: ChunkStore, keepStart: number, keepEnd: number): ChunkStore {
    const s = Math.max(buf.colStart, keepStart);
    const e = Math.min(buf.colEnd, keepEnd);
    if (s <= buf.colStart && e >= buf.colEnd) {
      return buf;
    } // already within bounds
    if (s >= e) {
      return buf;
    } // degenerate — keep as-is
    const cols = e - s;
    const data = new Uint8Array(buf.numRows * cols);
    for (let r = 0; r < buf.numRows; r++) {
      const srcStart = r * buf.cols + (s - buf.colStart);
      data.set(buf.data.subarray(srcStart, srcStart + cols), r * cols);
    }
    return { colEnd: e, cols, colStart: s, data, numRows: buf.numRows };
  }
}
