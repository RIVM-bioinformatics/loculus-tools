/// <reference lib="webworker" />
import { expose } from 'comlink';
import init, { align_fasta } from '@rivm-loculus-tools/sequence-editor-wasm';

import type { AlignerWorkerApi } from '../../../models/editor.models';

/**
 * Ephemeral worker dedicated to MAFFT sequence (re-)alignment.
 *
 * Runs off-thread so that heavy progressive alignment never stalls the main
 * thread or the primary stateful EngineWorker. If alignment is cancelled by the
 * user, this worker is terminated via `worker.terminate()`, instantly killing
 * the running WebAssembly thread and reclaiming its memory.
 */
export class AlignerWorker implements AlignerWorkerApi {
  private initialization: null | Promise<void> = null;

  public async align(fastaContent: string): Promise<string> {
    await this.ensureInitialized();
    return align_fasta(fastaContent);
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialization) {
      this.initialization = (async () => {
        await init(undefined);
      })();
      this.initialization.catch(() => {
        this.initialization = null;
      });
    }
    await this.initialization;
  }
}

expose(new AlignerWorker());
