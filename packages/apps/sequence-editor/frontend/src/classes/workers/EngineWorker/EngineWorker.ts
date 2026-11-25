/// <reference lib="webworker" />
import { expose } from 'comlink';
import type { MoveDirection } from '@rivm-loculus-tools/sequence-editor-wasm';
import init, { MsaEngine } from '@rivm-loculus-tools/sequence-editor-wasm';

import type {
  EngineMeta,
  EngineSearchResult,
  EngineViewportResult,
  EngineWorkerApi,
  MoveRowsOptions,
  ViewportBounds,
} from '../../../models/editor.models';

/**
 * MSA engine Web Worker.
 *
 * This worker is the **single owner** of the `MsaEngine` WASM instance and its
 * linear memory for the lifetime of the page. All Rust calls happen here, off
 * the main thread, so FASTA parsing, structural mutations, and undo/redo
 * history never stall the React render loop.
 *
 * The class is exposed to the main thread through comlink, so every public
 * method is proxied as an asynchronous call across the worker boundary.
 */
export class EngineWorker implements EngineWorkerApi {
  private engine: MsaEngine | null = null;
  private initialization: null | Promise<void> = null;

  public async applyAlignedFasta(fasta: string, expectedRevision?: number): Promise<boolean> {
    const engine = await this.requireEngine();
    return this.runRevisionTrackedOperation(engine, () => {
      engine.apply_aligned_fasta(fasta, expectedRevision);
    });
  }

  public async delete(rows: number[], column: number): Promise<boolean> {
    const engine = await this.requireEngine();
    return this.runRevisionTrackedOperation(engine, () => {
      engine.delete_at_subset(this.toRowIndices(rows), column);
    });
  }

  public async deleteColumn(column: number): Promise<boolean> {
    const engine = await this.requireEngine();
    return this.runRevisionTrackedOperation(engine, () => {
      engine.delete_column(column);
    });
  }

  public async deleteRows(rows: number[]): Promise<boolean> {
    const engine = await this.requireEngine();
    return this.runRevisionTrackedOperation(engine, () => {
      engine.delete_rows(this.toRowIndices(rows));
    });
  }

  public async exportGappedFasta(): Promise<string> {
    const engine = await this.requireEngine();
    const bytes = engine.export_gapped_fasta();
    return new TextDecoder().decode(bytes);
  }

  public async exportUngappedFasta(): Promise<string> {
    const engine = await this.requireEngine();
    const bytes = engine.export_ungapped_fasta();
    return new TextDecoder().decode(bytes);
  }

  /**
   * Idempotently instantiates the WASM module and constructs the engine.
   * Safe to call multiple times; concurrent callers share one initialization.
   */
  public async initialize(): Promise<void> {
    if (this.engine) {
      return;
    }
    if (!this.initialization) {
      this.initialization = (async () => {
        await init(undefined);
        this.engine = new MsaEngine();
      })();
      this.initialization.catch(() => {
        this.initialization = null;
      });
    }
    await this.initialization;
  }

  public async insert(rows: number[], column: number): Promise<boolean> {
    const engine = await this.requireEngine();
    return this.runRevisionTrackedOperation(engine, () => {
      engine.insert_at_subset(this.toRowIndices(rows), column);
    });
  }

  public async load(fastaContent: string): Promise<boolean> {
    const engine = await this.requireEngine();
    return this.runRevisionTrackedOperation(engine, () => {
      engine.load_fasta(fastaContent);
    });
  }

  public async meta(): Promise<EngineMeta> {
    const engine = await this.requireEngine();
    return {
      alignmentWidth: engine.get_alignment_width(),
      redoDepth: engine.redo_depth(),
      revision: engine.get_revision(),
      sequenceCount: engine.get_sequence_count(),
      undoDepth: engine.undo_depth(),
    };
  }

  public async moveHorizontal(rows: number[], columns: number[], direction: MoveDirection): Promise<boolean> {
    const engine = await this.requireEngine();
    return this.runRevisionTrackedOperation(engine, () => {
      engine.move_horizontal(this.toRowIndices(rows), this.toRowIndices(columns), direction);
    });
  }

  public async moveRows(rows: number[], options: MoveRowsOptions): Promise<boolean> {
    switch (options.mode) {
      case 'bottom': {
        return this.moveRowsToBottom(rows);
      }
      case 'grouped': {
        return this.moveRowsGrouped(rows, options.targetRow);
      }
      case 'relative': {
        return this.moveRowsRelative(rows, options.delta);
      }
      case 'top': {
        return this.moveRowsToTop(rows);
      }
      default: {
        return false;
      }
    }
  }

  public async moveRowsDown(rows: number[]): Promise<boolean> {
    const engine = await this.requireEngine();
    return this.runRevisionTrackedOperation(engine, () => {
      engine.move_rows_down(this.toRowIndices(rows));
    });
  }

  public async moveRowsGrouped(rows: number[], targetRow: number): Promise<boolean> {
    const engine = await this.requireEngine();
    return this.runRevisionTrackedOperation(engine, () => {
      engine.move_rows_grouped(this.toRowIndices(rows), targetRow);
    });
  }

  public async moveRowsRelative(rows: number[], delta: number): Promise<boolean> {
    const engine = await this.requireEngine();
    return this.runRevisionTrackedOperation(engine, () => {
      engine.move_rows_relative(this.toRowIndices(rows), delta);
    });
  }

  public async moveRowsToBottom(rows: number[]): Promise<boolean> {
    const engine = await this.requireEngine();
    return this.runRevisionTrackedOperation(engine, () => {
      engine.move_rows_to_bottom(this.toRowIndices(rows));
    });
  }

  public async moveRowsToTop(rows: number[]): Promise<boolean> {
    const engine = await this.requireEngine();
    return this.runRevisionTrackedOperation(engine, () => {
      engine.move_rows_to_top(this.toRowIndices(rows));
    });
  }

  public async moveRowsUp(rows: number[]): Promise<boolean> {
    const engine = await this.requireEngine();
    return this.runRevisionTrackedOperation(engine, () => {
      engine.move_rows_up(this.toRowIndices(rows));
    });
  }

  public async mutate(rows: number[], columns: number[], base: string): Promise<boolean> {
    const engine = await this.requireEngine();
    return this.runRevisionTrackedOperation(engine, () => {
      engine.mutate_base(this.toRowIndices(rows), this.toRowIndices(columns), base.charCodeAt(0));
    });
  }

  public async name(row: number): Promise<string> {
    const engine = await this.requireEngine();
    return engine.get_name(row);
  }

  public async redo(): Promise<boolean> {
    const engine = await this.requireEngine();
    return engine.redo();
  }

  public async reset(): Promise<void> {
    const engine = await this.requireEngine();
    engine.reset();
  }

  public async search(query: string, checkRecordNames: boolean): Promise<EngineSearchResult> {
    const engine = await this.requireEngine();
    return engine.search(query, checkRecordNames) as EngineSearchResult;
  }

  public async translate(bounds: ViewportBounds, readingFrame: number): Promise<EngineViewportResult> {
    const engine = await this.requireEngine();
    this.validateBounds(bounds);
    const bytes = engine.translate(
      bounds.startRow,
      bounds.endRow,
      bounds.startCol,
      bounds.endCol,
      readingFrame,
    );
    return this.buildViewportResult(bytes, bounds);
  }

  public async undo(): Promise<boolean> {
    const engine = await this.requireEngine();
    return engine.undo();
  }

  public async viewport(bounds: ViewportBounds, overlayReadingFrame?: number): Promise<EngineViewportResult> {
    const engine = await this.requireEngine();
    this.validateBounds(bounds);
    if (overlayReadingFrame !== undefined && ![1, 2, 3].includes(overlayReadingFrame)) {
      throw new RangeError('Expected overlay reading frame 1, 2, or 3');
    }

    const [bytes, overlayBytes]: readonly unknown[] = engine.update_viewport(
      bounds.startRow,
      bounds.endRow,
      bounds.startCol,
      bounds.endCol,
      overlayReadingFrame !== undefined,
      overlayReadingFrame ?? 1,
    );
    if (!(bytes instanceof Uint8Array) || !(overlayBytes instanceof Uint8Array)) {
      throw new TypeError('Expected two Uint8Arrays from the viewport engine');
    }

    const viewport = this.buildViewportResult(bytes, bounds);
    if (overlayReadingFrame !== undefined) {
      viewport.aminoAcidCodonOverlay = overlayBytes;
    }
    return viewport;
  }

  /** Builds a fixed-stride viewport result from the engine's returned bytes. */
  private buildViewportResult(bytes: Uint8Array, bounds: ViewportBounds): EngineViewportResult {
    const columns = bounds.endCol - bounds.startCol + 1;
    const rows = columns > 0 ? Math.floor(bytes.byteLength / columns) : 0;
    return {
      bytes,
      cols: columns,
      rows,
      startCol: bounds.startCol,
      startRow: bounds.startRow,
    };
  }

  /** Returns the initialized engine, initializing it first if necessary. */
  private async requireEngine(): Promise<MsaEngine> {
    await this.initialize();
    if (!this.engine) {
      throw new Error('Engine failed to initialize');
    }
    return this.engine;
  }

  /** Runs an engine operation and returns whether its revision changed. */
  private runRevisionTrackedOperation(engine: MsaEngine, operation: () => void): boolean {
    const beforeRevision = engine.get_revision();
    operation();
    return engine.get_revision() !== beforeRevision;
  }

  /** Converts a plain row-index list into the typed array the WASM API expects. */
  private toRowIndices(rows: number[]): Uint32Array {
    return new Uint32Array(rows);
  }

  /** Validates that viewport/translation bounds are safe, non-negative, and ordered. */
  private validateBounds(bounds: ViewportBounds): void {
    const values = [bounds.startRow, bounds.endRow, bounds.startCol, bounds.endCol];
    if (!values.every((value) => Number.isSafeInteger(value) && value >= 0)) {
      throw new Error('Viewport bounds must be non-negative safe integers');
    }
    if (bounds.startRow > bounds.endRow || bounds.startCol > bounds.endCol) {
      throw new Error('Viewport bounds must be ordered (start <= end)');
    }
  }
}

expose(new EngineWorker());
