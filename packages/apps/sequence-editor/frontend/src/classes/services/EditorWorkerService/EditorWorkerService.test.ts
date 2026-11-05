// @vitest-environment node
import 'reflect-metadata';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const mockEngineWorkerProxy = {
  applyAlignedFasta: vi.fn<() => Promise<void>>(),
  exportGappedFasta: vi.fn<() => Promise<string>>(),
  load: vi.fn<() => Promise<number>>(),
  reset: vi.fn<() => Promise<void>>(),
};

vi.mock('comlink', () => ({
  wrap: vi.fn(() => mockEngineWorkerProxy),
}));

vi.mock('../../workers/EngineWorker?worker', () => ({
  default: class MockEngineWorker {},
}));

const { EditorWorkerService } = await import(/* webpackChunkName: "EditorWorkerService" */ './EditorWorkerService');

describe('EditorWorkerService', () => {
  it('clears isRealigning synchronously on reset so an immediate loadFasta is not rejected', async () => {
    const service = new EditorWorkerService();
    let resolveExport: (fasta: string) => void = () => undefined;
    mockEngineWorkerProxy.exportGappedFasta.mockReturnValueOnce(new Promise<string>((resolve) => {
      resolveExport = resolve;
    }));
    mockEngineWorkerProxy.reset.mockResolvedValueOnce(undefined);
    mockEngineWorkerProxy.load.mockResolvedValueOnce(1);

    const realignPromise = service.realign();

    // Trigger reset while realign is still awaiting exportGappedFasta
    const resetPromise = service.reset();
    const loadPromise = service.loadFasta('>seq1\nATGC');

    resolveExport('>seq1\nATGC');

    await expect(realignPromise).rejects.toMatchObject({ name: 'AbortError' });
    await expect(resetPromise).resolves.toBeUndefined();
    await expect(loadPromise).resolves.toBe(1);
    expect(mockEngineWorkerProxy.load).toHaveBeenCalledWith('>seq1\nATGC');
  });
});
