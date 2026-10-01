/// <reference lib="webworker" />
import { expose } from 'comlink';
import type { MoveDirection } from '@rivm-loculus-tools/sequence-editor-wasm';
import init, { MsaEngine } from '@rivm-loculus-tools/sequence-editor-wasm';

import type {
  EngineMeta,
  EngineSearchResult,
  EngineViewportResult,
  EngineWorkerApi,
  ViewportBounds,
} from '../../../models';

/**
 * MSA engine Web Worker.
 *
 * This worker is the **single owner** of the `MsaEngine` WASM instance and its
 * linear memory for the lifetime of the page. All Rust calls happen here, off
 * the main thread, so FASTA parsing, structural mutations, and undo/redo
 * snapshots never stall the React render loop.
 *
 * The class is exposed to the main thread through comlink, so every public
 * method is proxied as an asynchronous call across the worker boundary.
 */
export class EngineWorker implements EngineWorkerApi {
  private engine: MsaEngine | null = null;
  private initialization: null | Promise<void> = null;

  public async delete(rows: number[], column: number): Promise<void> {
    const engine = await this.requireEngine();
    this.throwIfError(engine.delete_at_subset(this.toRowIndices(rows), column));
  }

  public async deleteColumn(column: number): Promise<void> {
    const engine = await this.requireEngine();
    this.throwIfError(engine.delete_column(column));
  }

  public async exportFasta(): Promise<string> {
    const engine = await this.requireEngine();
    return engine.export_fasta();
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

  public async insert(rows: number[], column: number): Promise<void> {
    const engine = await this.requireEngine();
    this.throwIfError(engine.insert_at_subset(this.toRowIndices(rows), column));
  }

  public async load(fastaContent: string): Promise<number> {
    const engine = await this.requireEngine();
    return engine.load_fasta(fastaContent);
  }

  public async meta(): Promise<EngineMeta> {
    const engine = await this.requireEngine();
    return {
      alignmentWidth: engine.get_alignment_width(),
      redoDepth: engine.redo_depth(),
      sequenceCount: engine.get_sequence_count(),
      undoDepth: engine.undo_depth(),
    };
  }

  public async moveHorizontal(row: number, columns: number[], direction: MoveDirection): Promise<void> {
    const engine = await this.requireEngine();
    this.throwIfError(engine.move_horizontal(row, this.toRowIndices(columns), direction));
  }

  public async moveRowsDown(rows: number[]): Promise<void> {
    const engine = await this.requireEngine();
    this.throwIfError(engine.move_rows_down(this.toRowIndices(rows)));
  }

  public async moveRowsUp(rows: number[]): Promise<void> {
    const engine = await this.requireEngine();
    this.throwIfError(engine.move_rows_up(this.toRowIndices(rows)));
  }

  public async mutate(rows: number[], column: number, base: string): Promise<void> {
    const engine = await this.requireEngine();
    this.throwIfError(engine.mutate_base_subset(this.toRowIndices(rows), column, base.charCodeAt(0)));
  }

  public async mutateRange(rows: number[], startColumn: number, endColumn: number, base: string): Promise<void> {
    const engine = await this.requireEngine();
    this.throwIfError(engine.mutate_base_range(this.toRowIndices(rows), startColumn, endColumn, base.charCodeAt(0)));
  }

  public async name(row: number): Promise<string> {
    const engine = await this.requireEngine();
    return engine.get_name(row);
  }

  public async redo(): Promise<boolean> {
    const engine = await this.requireEngine();
    return engine.redo();
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

  public async viewport(bounds: ViewportBounds): Promise<EngineViewportResult> {
    const engine = await this.requireEngine();
    this.validateBounds(bounds);
    const bytes = engine.update_viewport(
      bounds.startRow,
      bounds.endRow,
      bounds.startCol,
      bounds.endCol,
    );
    return this.buildViewportResult(bytes, bounds);
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

  /** Throws when the engine returns a non-empty error code. */
  private throwIfError(errorCode: string): void {
    if (errorCode) {
      throw new Error(errorCode);
    }
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
