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

type CommandResultWithAbortSignal<T> = { abortSignal?: AbortSignal } & Promise<T>;

@singleton()
export class EditorWorkerService {
  private activeAlignerWorker: null | Worker = null;
  private alignerReject: ((reason?: unknown) => void) | null = null;
  private commandQueue: Promise<void> = Promise.resolve();
  private engineWorkerProxyInstance: null | Remote<EngineWorkerApi> = null;
  private isRealigning = false;
  private realignAbortController: AbortController | null = null;
  private readonly workerReady: Promise<void>;

  private get engineWorkerProxy(): Remote<EngineWorkerApi> {
    const workerProxy = this.engineWorkerProxyInstance;
    if (!workerProxy) {
      throw new Error('Engine worker is not initialized');
    }
    return workerProxy;
  }

  public constructor() {
    this.workerReady = import(
      /* webpackChunkName: 'sequence-editor-engine-worker' */
      '../../workers/EngineWorker?worker'
    ).then(({ default: EngineWorker }) => {
      this.engineWorkerProxyInstance = wrap<EngineWorkerApi>(new EngineWorker());
    });
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

  public delete(rows: number[], col: number, abortSignal?: AbortSignal): CommandResultWithAbortSignal<void> {
    return this.runCommand(async () => {
      await this.engineWorkerProxy.delete(rows, col);
    }, abortSignal);
  }

  public deleteColumn(col: number, abortSignal?: AbortSignal): CommandResultWithAbortSignal<void> {
    return this.runCommand(async () => {
      await this.engineWorkerProxy.deleteColumn(col);
    }, abortSignal);
  }

  public deleteRows(rows: number[], abortSignal?: AbortSignal): CommandResultWithAbortSignal<void> {
    return this.runCommand(async () => {
      await this.engineWorkerProxy.deleteRows(rows);
    }, abortSignal);
  }

  public exportGappedFasta(abortSignal?: AbortSignal): CommandResultWithAbortSignal<string> {
    return this.runCommand(async () => {
      return await this.engineWorkerProxy.exportGappedFasta();
    }, abortSignal);
  }

  public exportUngappedFasta(abortSignal?: AbortSignal): CommandResultWithAbortSignal<string> {
    return this.runCommand(async () => {
      return await this.engineWorkerProxy.exportUngappedFasta();
    }, abortSignal);
  }

  public getMetaData(abortSignal?: AbortSignal): CommandResultWithAbortSignal<EngineMeta> {
    return this.runCommand(async () => {
      return await this.engineWorkerProxy.meta();
    }, abortSignal);
  }

  public initialize(abortSignal?: AbortSignal): CommandResultWithAbortSignal<void> {
    return this.runCommand(async () => {
      return await this.engineWorkerProxy.initialize();
    }, abortSignal);
  }

  public insert(rows: number[], col: number, abortSignal?: AbortSignal): CommandResultWithAbortSignal<void> {
    return this.runCommand(async () => {
      await this.engineWorkerProxy.insert(rows, col);
    }, abortSignal);
  }

  public loadFasta(fasta: string, abortSignal?: AbortSignal): CommandResultWithAbortSignal<void> {
    return this.runCommand(async () => {
      await this.engineWorkerProxy.load(fasta);
    }, abortSignal);
  }

  public moveHorizontal(rows: number[], cols: number[], direction: EDITOR_DIRECTION, abortSignal?: AbortSignal): CommandResultWithAbortSignal<void> {
    if (direction !== EDITOR_DIRECTION.LEFT && direction !== EDITOR_DIRECTION.RIGHT) {
      throw new Error('Invalid horizontal move direction');
    }
    return this.runCommand(async () => {
      await this.engineWorkerProxy.moveHorizontal(rows, cols, direction === EDITOR_DIRECTION.LEFT ? MoveDirection.Left : MoveDirection.Right);
    }, abortSignal);
  }

  public moveRows(rows: number[], options: MoveRowsOptions, abortSignal?: AbortSignal): CommandResultWithAbortSignal<void> {
    return this.runCommand(async () => {
      await this.engineWorkerProxy.moveRows(rows, options);
    }, abortSignal);
  }

  public moveRowsDown(rows: number[], abortSignal?: AbortSignal): CommandResultWithAbortSignal<void> {
    return this.runCommand(async () => {
      await this.engineWorkerProxy.moveRowsDown(rows);
    }, abortSignal);
  }

  public moveRowsGrouped(rows: number[], targetRow: number, abortSignal?: AbortSignal): CommandResultWithAbortSignal<void> {
    return this.runCommand(async () => {
      await this.engineWorkerProxy.moveRowsGrouped(rows, targetRow);
    }, abortSignal);
  }

  public moveRowsRelative(rows: number[], delta: number, abortSignal?: AbortSignal): CommandResultWithAbortSignal<void> {
    return this.runCommand(async () => {
      await this.engineWorkerProxy.moveRowsRelative(rows, delta);
    }, abortSignal);
  }

  public moveRowsToBottom(rows: number[], abortSignal?: AbortSignal): CommandResultWithAbortSignal<void> {
    return this.runCommand(async () => {
      await this.engineWorkerProxy.moveRowsToBottom(rows);
    }, abortSignal);
  }

  public moveRowsToTop(rows: number[], abortSignal?: AbortSignal): CommandResultWithAbortSignal<void> {
    return this.runCommand(async () => {
      await this.engineWorkerProxy.moveRowsToTop(rows);
    }, abortSignal);
  }

  public moveRowsUp(rows: number[], abortSignal?: AbortSignal): CommandResultWithAbortSignal<void> {
    return this.runCommand(async () => {
      await this.engineWorkerProxy.moveRowsUp(rows);
    }, abortSignal);
  }

  public mutate(rows: number[], cols: number[], base: string, abortSignal?: AbortSignal): CommandResultWithAbortSignal<void> {
    return this.runCommand(async () => {
      await this.engineWorkerProxy.mutate(rows, cols, base);
    }, abortSignal);
  }

  public name(row: number, abortSignal?: AbortSignal): CommandResultWithAbortSignal<string> {
    return this.runCommand(async () => {
      return await this.engineWorkerProxy.name(row);
    }, abortSignal);
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
      }, internalAbortController.signal);
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

  public redo(abortSignal?: AbortSignal): CommandResultWithAbortSignal<void> {
    return this.runCommand(async () => {
      await this.engineWorkerProxy.redo();
    }, abortSignal);
  }

  public reset(abortSignal?: AbortSignal): CommandResultWithAbortSignal<void> {
    return this.runCommand(async () => {
      await this.engineWorkerProxy.reset();
    }, abortSignal);
  }

  public search(query: string, checkRecordNames: boolean, abortSignal?: AbortSignal): CommandResultWithAbortSignal<EngineSearchResult> {
    return this.runCommand(async () => {
      return await this.engineWorkerProxy.search(query, checkRecordNames);
    }, abortSignal);
  }

  public translate(bounds: ViewportBounds, readingFrame: number, abortSignal?: AbortSignal): CommandResultWithAbortSignal<EngineViewportResult> {
    return this.runCommand(async () => {
      return await this.engineWorkerProxy.translate(bounds, readingFrame);
    }, abortSignal);
  }

  public undo(abortSignal?: AbortSignal): CommandResultWithAbortSignal<void> {
    return this.runCommand(async () => {
      await this.engineWorkerProxy.undo();
    }, abortSignal);
  }

  public viewport(bounds: ViewportBounds, abortSignal?: AbortSignal): CommandResultWithAbortSignal<EngineViewportResult> {
    return this.runCommand(async () => {
      return await this.engineWorkerProxy.viewport(bounds);
    }, abortSignal);
  }

  private runCommand<T>(command: () => Promise<T>, abortSignal?: AbortSignal): CommandResultWithAbortSignal<T> {
    const queuedCommand = this.commandQueue.then(async (): Promise<T> => {
      const { setLatestMessage } = sequenceEditorStore.getState();
      try {
        if (abortSignal?.aborted) {
          throw new DOMException('Command cancelled', 'AbortError');
        }
        await this.workerReady;
        if (abortSignal?.aborted) {
          throw new DOMException('Command cancelled', 'AbortError');
        }
        const result = await command();
        if (abortSignal?.aborted) {
          throw new DOMException('Command cancelled', 'AbortError');
        }
        if (sequenceEditorStore.getState().latestMessage) {
          setLatestMessage(null);
        }
        return result;
      } catch (error: unknown) {
        if (!abortSignal?.aborted) {
          setLatestMessage(EngineErrorUtil.getEngineErrorMessage(error));
          console.error('COMMAND ERROR', error);
        }
        throw error;
      }
    });

    this.commandQueue = queuedCommand.then(
      () => undefined,
      () => undefined,
    );

    return Object.assign(queuedCommand, { abortSignal });
  }
}
