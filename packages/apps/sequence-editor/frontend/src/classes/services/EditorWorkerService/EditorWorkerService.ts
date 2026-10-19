import type { Remote } from 'comlink';
import { wrap } from 'comlink';
import { MoveDirection } from '@rivm-loculus-tools/sequence-editor-wasm';
import { singleton } from 'tsyringe';

import type {
  EngineMeta,
  EngineSearchResult,
  EngineViewportResult,
  EngineWorkerApi,
  ViewportBounds,
} from '../../../models/editor.models';
import { EDITOR_DIRECTION } from '../../../models/editor.models';
import { EngineErrorUtil } from '../../../utils/EngineErrorUtil/EngineErrorUtil';
import { sequenceEditorStore } from '../../../stores/sequenceEditorStore';

@singleton()
export class EditorWorkerService {
  private commandQueue: Promise<void> = Promise.resolve();
  private readonly engineWorkerProxy: Remote<EngineWorkerApi>;

  public constructor() {
    const worker = new Worker(new URL('../../workers/EngineWorker', import.meta.url), {
      type: 'module',
    });
    this.engineWorkerProxy = wrap<EngineWorkerApi>(worker);
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

  public async moveHorizontal(row: number, cols: number[], direction: EDITOR_DIRECTION): Promise<void> {
    if (direction !== EDITOR_DIRECTION.LEFT && direction !== EDITOR_DIRECTION.RIGHT) {
      throw new Error('Invalid horizontal move direction');
    }
    return await this.runCommand(async () => {
      await this.engineWorkerProxy.moveHorizontal(row, cols, direction === EDITOR_DIRECTION.LEFT ? MoveDirection.Left : MoveDirection.Right);
    });
  }

  public async moveRowsDown(rows: number[]): Promise<void> {
    return await this.runCommand(async () => {
      await this.engineWorkerProxy.moveRowsDown(rows);
    });
  }

  public async moveRowsUp(rows: number[]): Promise<void> {
    return await this.runCommand(async () => {
      await this.engineWorkerProxy.moveRowsUp(rows);
    });
  }

  public async mutate(rows: number[], col: number, base: string): Promise<void> {
    return await this.runCommand(async () => {
      await this.engineWorkerProxy.mutate(rows, col, base);
    });
  }

  public async name(row: number): Promise<string> {
    return await this.runCommand(async () => {
      return await this.engineWorkerProxy.name(row);
    });
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
