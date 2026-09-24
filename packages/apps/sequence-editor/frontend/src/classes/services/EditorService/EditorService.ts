import { SubscribableAbstract } from '@gen-epix/ui-core/classes/abstracts/SubscribableAbstract';
import { HmrUtil } from '@gen-epix/ui-core/utils/HmrUtil';
import type { Remote } from 'comlink';
import { wrap } from 'comlink';
import { Subject } from '@gen-epix/ui-core/classes/Subject';

import type {
  EngineMeta,
  EngineSearchResult,
  EngineViewportResult,
  EngineWorkerApi,
  MoveDirection,
  ViewportBounds,
} from '../../../models';
import { getEngineErrorMessage } from '../../../utils/engineErrors';
import type { FastaPreflightResult } from '../../../utils/FastaUtil';
import { FastaUtil } from '../../../utils/FastaUtil';

export type EditorServiceDimensions = {
  height: number;
  width: number;
};

export type EditorServiceSubjectData = {
  errorMessage?: string;
  meta?: EngineMeta | null;
  viewport?: EngineViewportResult | null;
};

export class EditorService extends SubscribableAbstract<EditorServiceSubjectData> {
  private static __instance: EditorService;
  private commandQueue: Promise<void> = Promise.resolve();
  private readonly engineWorkerProxy: Remote<EngineWorkerApi>;
  private viewportBounds: null | ViewportBounds = null;

  private constructor() {
    super(new Subject<EditorServiceSubjectData>({}));
    const worker = new Worker(new URL('../../workers/EngineWorker', import.meta.url), {
      type: 'module',
    });
    this.engineWorkerProxy = wrap<EngineWorkerApi>(worker);
  }

  public static getInstance(): EditorService {
    EditorService.__instance = HmrUtil.getHmrSingleton('EditorService', EditorService.__instance, () => new EditorService());
    return EditorService.__instance;
  }

  public async delete(rows: number[], col: number): Promise<void> {
    return await this.runCommand(async () => {
      await this.engineWorkerProxy.delete(rows, col);
    }, true);
  }

  public async deleteColumn(col: number): Promise<void> {
    return await this.runCommand(async () => {
      await this.engineWorkerProxy.deleteColumn(col);
    }, true);
  }

  public async exportFasta(): Promise<string> {
    return await this.runCommand(async () => {
      return await this.engineWorkerProxy.exportFasta();
    }, false);
  }

  public async getMetaData(): Promise<EngineMeta> {
    return await this.runCommand(async () => {
      return await this.engineWorkerProxy.meta();
    }, true);
  }

  public async initialize(): Promise<void> {
    return await this.runCommand(async () => {
      return await this.engineWorkerProxy.initialize();
    }, true);
  }

  public async insert(rows: number[], col: number): Promise<void> {
    return await this.runCommand(async () => {
      await this.engineWorkerProxy.insert(rows, col);
    }, true);
  }

  public async loadFasta(fasta: string): Promise<FastaPreflightResult> {
    return this.runCommand(async () => {
      const preflight = FastaUtil.preflightFasta(fasta);
      await this.engineWorkerProxy.load(fasta);
      return preflight;
    }, true);
  }

  public async moveHorizontal(row: number, cols: number[], direction: MoveDirection): Promise<void> {
    return await this.runCommand(async () => {
      await this.engineWorkerProxy.moveHorizontal(row, cols, direction);
    }, true);
  }

  public async moveRowsDown(rows: number[]): Promise<void> {
    return await this.runCommand(async () => {
      await this.engineWorkerProxy.moveRowsDown(rows);
    }, true);
  }

  public async moveRowsUp(rows: number[]): Promise<void> {
    return await this.runCommand(async () => {
      await this.engineWorkerProxy.moveRowsUp(rows);
    }, true);
  }

  public async mutate(rows: number[], col: number, base: string): Promise<void> {
    return await this.runCommand(async () => {
      await this.engineWorkerProxy.mutate(rows, col, base);
    }, true);
  }

  public async mutateRange(rows: number[], startCol: number, endCol: number, base: string): Promise<void> {
    return await this.runCommand(async () => {
      await this.engineWorkerProxy.mutateRange(rows, startCol, endCol, base);
    }, true);
  }

  public async name(row: number): Promise<void> {
    return await this.runCommand(async () => {
      await this.engineWorkerProxy.name(row);
    }, true);
  }

  public async redo(): Promise<void> {
    return await this.runCommand(async () => {
      await this.engineWorkerProxy.redo();
    }, true);
  }

  public async search(query: string, checkRecordNames: boolean): Promise<EngineSearchResult> {
    return await this.runCommand(async () => {
      return await this.engineWorkerProxy.search(query, checkRecordNames);
    }, false);
  }

  public async translate(bounds: ViewportBounds, readingFrame: number): Promise<EngineViewportResult> {
    return await this.runCommand(async () => {
      return await this.engineWorkerProxy.translate(bounds, readingFrame);
    }, false);
  }

  public async undo(): Promise<void> {
    return await this.runCommand(async () => {
      await this.engineWorkerProxy.undo();
    }, true);
  }

  public async updateBounds(viewportBounds: ViewportBounds): Promise<void> {
    this.viewportBounds = viewportBounds;
    if (viewportBounds) {
      const viewport = await this.viewport(viewportBounds);
      this.next({
        viewport,
      });
    }
  }

  public async viewport(bounds: ViewportBounds): Promise<EngineViewportResult> {
    return await this.runCommand(async () => {
      return await this.engineWorkerProxy.viewport(bounds);
    }, false);
  }

  private async runCommand<T>(command: () => Promise<T>, emitViewPort: boolean): Promise<T> {
    const queuedCommand = this.commandQueue.then(async (): Promise<T> => {
      try {
        const commandResult = await command();
        if (emitViewPort) {
          let viewport: EngineViewportResult | null = null;
          let meta: EngineMeta | null = null;

          if (this.viewportBounds) {
            try {
              viewport = await this.engineWorkerProxy.viewport(this.viewportBounds);
            } catch (error: unknown) {
              console.log('VIEWPORT ERROR', error);
            }
          }
          try {
            meta = await this.engineWorkerProxy.meta();
          } catch (error: unknown) {
            console.log('META ERROR', error);
          }
          console.log('emitting nex', meta, viewport);
          this.next({
            meta,
            viewport,
          });
        }
        return commandResult;
      } catch (error: unknown) {
        console.log('COMMAND ERROR', error);
        this.next({
          errorMessage: getEngineErrorMessage(error),
        });
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
