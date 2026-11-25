// @vitest-environment node
import 'reflect-metadata';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { EngineMeta } from '../../../models/editor.models';

import { EditorWorkerService } from './EditorWorkerService';

const mockState = vi.hoisted(() => ({
  alignerApi: {
    align: vi.fn<(fasta: string) => Promise<string>>(),
  },
  engineApi: {
    applyAlignedFasta: vi.fn<(fasta: string, expectedRevision?: number) => Promise<boolean>>(),
    exportGappedFasta: vi.fn<() => Promise<string>>(),
    meta: vi.fn<() => Promise<EngineMeta>>(),
  },
  workerInstances: [] as Array<{ terminate: ReturnType<typeof vi.fn> }>,
}));

vi.mock('../../workers/EngineWorker?worker', () => ({
  default: class MockEngineWorker {},
}));

vi.mock('comlink', () => ({
  wrap: vi.fn((worker: unknown) => {
    if (worker && typeof worker === 'object' && 'isAlignerWorker' in worker) {
      return mockState.alignerApi;
    }
    return mockState.engineApi;
  }),
}));

vi.mock('@rivm-loculus-tools/sequence-editor-wasm', () => ({}));

describe('EditorWorkerService.realign', () => {
  beforeEach(() => {
    mockState.workerInstances = [];
    mockState.engineApi.exportGappedFasta.mockResolvedValue('>s1\nATGC\n>s2\nAT-C\n');
    mockState.engineApi.meta.mockResolvedValue({
      alignmentWidth: 4,
      redoDepth: 0,
      revision: 7,
      sequenceCount: 2,
      undoDepth: 0,
    });
    mockState.alignerApi.align.mockResolvedValue('>s1\nATGC\n>s2\nATGC\n');
    mockState.engineApi.applyAlignedFasta.mockResolvedValue(true);

    vi.stubGlobal(
      'Worker',
      class MockAlignerWorker {
        public readonly isAlignerWorker = true;
        public readonly terminate = vi.fn();

        public constructor() {
          mockState.workerInstances.push(this);
        }
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('returns the committed result if cancellation arrives after applyAlignedFasta was dispatched', async () => {
    const service = new EditorWorkerService();
    let resolveApply: ((changed: boolean) => void) | undefined;
    mockState.engineApi.applyAlignedFasta.mockImplementation(
      async () => new Promise<boolean>((resolve) => {
        resolveApply = resolve;
      }),
    );

    const realignPromise = service.realign();

    await vi.waitFor(() => {
      expect(mockState.engineApi.applyAlignedFasta).toHaveBeenCalledWith('>s1\nATGC\n>s2\nATGC\n', 7);
    });

    service.cancelRealign();
    resolveApply?.(true);

    await expect(realignPromise).resolves.toBe(true);
    expect(mockState.workerInstances[0]?.terminate).toHaveBeenCalled();
  });

  it('rejects with AbortError when cancelled before applyAlignedFasta is dispatched', async () => {
    const service = new EditorWorkerService();
    let resolveAlign: ((fasta: string) => void) | undefined;
    mockState.alignerApi.align.mockImplementation(
      async () => new Promise<string>((resolve) => {
        resolveAlign = resolve;
      }),
    );

    const realignPromise = service.realign();

    await vi.waitFor(() => {
      expect(mockState.alignerApi.align).toHaveBeenCalledTimes(1);
    });

    service.cancelRealign();
    resolveAlign?.('>s1\nATGC\n>s2\nATGC\n');

    await expect(realignPromise).rejects.toMatchObject({ name: 'AbortError' });
    expect(mockState.engineApi.applyAlignedFasta).not.toHaveBeenCalled();
  });
});
