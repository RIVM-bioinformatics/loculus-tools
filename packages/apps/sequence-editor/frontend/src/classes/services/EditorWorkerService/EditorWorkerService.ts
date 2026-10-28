import type { Remote } from 'comlink';
import { wrap } from 'comlink';
import { MoveDirection } from '@rivm-loculus-tools/sequence-editor-wasm';
import { singleton } from 'tsyringe';

import type {
  AlignerWorkerApi,
  EngineMeta,
  EngineSearchResult,
  EngineViewportResult,
  EngineWorkerApi,
  MoveRowsOptions,
  ViewportBounds,
} from '../../../models/editor.models';
import { EDITOR_DIRECTION } from '../../../models/editor.models';
import { EngineErrorUtil } from '../../../utils/EngineErrorUtil/EngineErrorUtil';
import { sequenceEditorStore } from '../../../stores/sequenceEditorStore';

@singleton()
export class EditorWorkerService {
  private activeAlignerWorker: null | Worker = null;
  private alignerReject: ((reason?: unknown) => void) | null = null;
  private commandQueue: Promise<void> = Promise.resolve();
  private readonly engineWorkerProxy: Remote<EngineWorkerApi>;
  private isRealigning = false;
  private realignAbortController: AbortController | null = null;

  public constructor() {
    const worker = new Worker(new URL('../../workers/EngineWorker', import.meta.url), {
      type: 'module',
    });
    this.engineWorkerProxy = wrap<EngineWorkerApi>(worker);
  }

  public cancelRealign(): void {
    if (this.realignAbortController) {
      this.realignAbortController.abort();
    }
    if (this.activeAlignerWorker) {
      this.activeAlignerWorker.terminate();
      this.activeAlignerWorker = null;
      const reject = this.alignerReject;
      this.alignerReject = null;
      if (reject) {
        reject(new DOMException('Alignment cancelled by user', 'AbortError'));
      }
    }
  }

  public async delete(rows: number[], col: number): Promise<void> {
    return await this.runCommand(async () => {
      await this.engineWorkerProxy.delete(rows, col);
    });
  }

  public async deleteColumn(col: number): Promise<void> {
    return await this.runCommand(async () => {
      await this.engineWorkerProxy.deleteColumn(col);
    });
  }

  public async exportGappedFasta(): Promise<string> {
    return await this.runCommand(async () => {
      return await this.engineWorkerProxy.exportGappedFasta();
    });
  }

  public async exportUngappedFasta(): Promise<string> {
    return await this.runCommand(async () => {
      return await this.engineWorkerProxy.exportUngappedFasta();
    });
  }

  public async getMetaData(): Promise<EngineMeta> {
    return await this.runCommand(async () => {
      return await this.engineWorkerProxy.meta();
    });
  }

  public async initialize(): Promise<void> {
    return await this.runCommand(async () => {
      return await this.engineWorkerProxy.initialize();
    });
  }

  public async insert(rows: number[], col: number): Promise<void> {
    return await this.runCommand(async () => {
      await this.engineWorkerProxy.insert(rows, col);
    });
  }

  public async loadFasta(fasta: string): Promise<void> {
    return this.runCommand(async () => {
      await this.engineWorkerProxy.load(fasta);
    });
  }

  public async moveHorizontal(rows: number[], cols: number[], direction: EDITOR_DIRECTION): Promise<void> {
    if (direction !== EDITOR_DIRECTION.LEFT && direction !== EDITOR_DIRECTION.RIGHT) {
      throw new Error('Invalid horizontal move direction');
    }
    return await this.runCommand(async () => {
      await this.engineWorkerProxy.moveHorizontal(rows, cols, direction === EDITOR_DIRECTION.LEFT ? MoveDirection.Left : MoveDirection.Right);
    });
  }

  public async moveRows(rows: number[], options: MoveRowsOptions): Promise<void> {
    return await this.runCommand(async () => {
      await this.engineWorkerProxy.moveRows(rows, options);
    });
  }

  public async moveRowsDown(rows: number[]): Promise<void> {
    return await this.runCommand(async () => {
      await this.engineWorkerProxy.moveRowsDown(rows);
    });
  }

  public async moveRowsGrouped(rows: number[], targetRow: number): Promise<void> {
    return await this.runCommand(async () => {
      await this.engineWorkerProxy.moveRowsGrouped(rows, targetRow);
    });
  }

  public async moveRowsRelative(rows: number[], delta: number): Promise<void> {
    return await this.runCommand(async () => {
      await this.engineWorkerProxy.moveRowsRelative(rows, delta);
    });
  }

  public async moveRowsToBottom(rows: number[]): Promise<void> {
    return await this.runCommand(async () => {
      await this.engineWorkerProxy.moveRowsToBottom(rows);
    });
  }

  public async moveRowsToTop(rows: number[]): Promise<void> {
    return await this.runCommand(async () => {
      await this.engineWorkerProxy.moveRowsToTop(rows);
    });
  }

  public async moveRowsUp(rows: number[]): Promise<void> {
    return await this.runCommand(async () => {
      await this.engineWorkerProxy.moveRowsUp(rows);
    });
  }

  public async mutate(rows: number[], cols: number[], base: string): Promise<void> {
    return await this.runCommand(async () => {
      await this.engineWorkerProxy.mutate(rows, cols, base);
    });
  }

  public async name(row: number): Promise<string> {
    return await this.runCommand(async () => {
      return await this.engineWorkerProxy.name(row);
    });
  }

  public async realign(signal?: AbortSignal): Promise<void> {
    if (this.isRealigning || this.activeAlignerWorker) {
      throw new Error('Alignment is already in progress');
    }

    if (signal?.aborted) {
      throw new DOMException('Alignment cancelled by user', 'AbortError');
    }

    this.isRealigning = true;
    const internalAbortController = new AbortController();
    this.realignAbortController = internalAbortController;

    const checkAborted = () => {
      if (internalAbortController.signal.aborted || signal?.aborted) {
        throw new DOMException('Alignment cancelled by user', 'AbortError');
      }
    };

    let worker: null | Worker = null;
    let onAbort: (() => void) | undefined;
    try {
      checkAborted();
      const fasta = await this.exportGappedFasta();
      checkAborted();

      worker = new Worker(new URL('../../workers/AlignerWorker/AlignerWorker', import.meta.url), {
        type: 'module',
      });
      this.activeAlignerWorker = worker;

      const alignerProxy = wrap<AlignerWorkerApi>(worker);
      const alignPromise = alignerProxy.align(fasta);

      const abortPromise = new Promise<never>((_, reject) => {
        this.alignerReject = reject;
        onAbort = () => {
          reject(new DOMException('Alignment cancelled by user', 'AbortError'));
        };
        signal?.addEventListener('abort', onAbort, { once: true });
        internalAbortController.signal.addEventListener('abort', onAbort, { once: true });
      });

      const alignedFasta = await Promise.race([alignPromise, abortPromise]);
      checkAborted();

      await this.runCommand(async () => {
        checkAborted();
        await this.engineWorkerProxy.applyAlignedFasta(alignedFasta);
      });
    } finally {
      if (signal && onAbort) {
        signal.removeEventListener('abort', onAbort);
      }
      if (onAbort) {
        internalAbortController.signal.removeEventListener('abort', onAbort);
      }
      if (worker) {
        worker.terminate();
      }
      if (this.activeAlignerWorker === worker) {
        this.activeAlignerWorker = null;
      }
      this.alignerReject = null;
      this.isRealigning = false;
      this.realignAbortController = null;
    }
  }

  public async redo(): Promise<void> {
    return await this.runCommand(async () => {
      await this.engineWorkerProxy.redo();
    });
  }

  public async search(query: string, checkRecordNames: boolean): Promise<EngineSearchResult> {
    return await this.runCommand(async () => {
      return await this.engineWorkerProxy.search(query, checkRecordNames);
    });
  }

  public async translate(bounds: ViewportBounds, readingFrame: number): Promise<EngineViewportResult> {
    return await this.runCommand(async () => {
      return await this.engineWorkerProxy.translate(bounds, readingFrame);
    });
  }

  public async undo(): Promise<void> {
    return await this.runCommand(async () => {
      await this.engineWorkerProxy.undo();
    });
  }

  public async viewport(bounds: ViewportBounds): Promise<EngineViewportResult> {
    return await this.runCommand(async () => {
      return await this.engineWorkerProxy.viewport(bounds);
    });
  }

  private async runCommand<T>(command: () => Promise<T>): Promise<T> {
    const queuedCommand = this.commandQueue.then(async (): Promise<T> => {
      const { setLatestMessage } = sequenceEditorStore.getState();
      try {
        const result = await command();
        if (sequenceEditorStore.getState().latestMessage) {
          setLatestMessage(null);
        }
        return result;
      } catch (error: unknown) {
        setLatestMessage(EngineErrorUtil.getEngineErrorMessage(error));
        console.error('COMMAND ERROR', error);
        throw error;
      }
    });

    this.commandQueue = queuedCommand.then(
      () => undefined,
      () => undefined,
    );

    return await queuedCommand;
  }
}
