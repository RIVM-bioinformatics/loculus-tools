import { wrap } from 'comlink';
import type { Remote } from 'comlink';

import type { EngineWorkerApi } from '../models';

let engineWorkerProxy: null | Remote<EngineWorkerApi> = null;

/**
 * Returns a lazily-created comlink proxy to the `EngineWorker` running in a
 * dedicated Web Worker. The proxy is cached for the lifetime of the page so
 * every caller shares a single worker and a single WASM instance.
 *
 * The returned proxy is fully typed: every method on `EngineWorkerApi` is
 * available as an async call across the worker boundary.
 */
export const createEngineWorker = (): Remote<EngineWorkerApi> => {
  if (!engineWorkerProxy) {
    const worker = new Worker(new URL('./engine.worker.ts', import.meta.url), {
      type: 'module',
    });
    engineWorkerProxy = wrap<EngineWorkerApi>(worker);
  }
  return engineWorkerProxy;
};
