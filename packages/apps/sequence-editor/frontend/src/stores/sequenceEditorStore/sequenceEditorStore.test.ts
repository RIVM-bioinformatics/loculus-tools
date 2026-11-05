// @vitest-environment node
import 'reflect-metadata';
import { container } from 'tsyringe';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { LOADING_STATUS } from '@rivm-loculus-tools/common-frontend/models/fasta.models';

import { EditorWorkerService } from '../../classes/services/EditorWorkerService';
import { SequenceEditorEventBusService } from '../../classes/services/SequenceEditorEventBusService';

const mockEditorWorkerService = {
  loadFasta: vi.fn<() => Promise<number>>(),
  reset: vi.fn<() => Promise<void>>(),
  setMessageHandler: vi.fn<(handler: (message: null | string) => void) => void>(),
};

const mockEventBusService = {
  emit: vi.fn(),
};

container.registerInstance(EditorWorkerService, mockEditorWorkerService as unknown as EditorWorkerService);
container.registerInstance(SequenceEditorEventBusService, mockEventBusService as unknown as SequenceEditorEventBusService);

const { sequenceEditorStore } = await import(/* webpackChunkName: "sequenceEditorStore" */ './sequenceEditorStore');
const registeredMessageHandler = mockEditorWorkerService.setMessageHandler.mock.calls[0]?.[0];

describe('sequenceEditorStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEditorWorkerService.loadFasta.mockResolvedValue(1);
    mockEditorWorkerService.reset.mockResolvedValue(undefined);
    sequenceEditorStore.getState().resetDataset();
    vi.clearAllMocks();
  });

  it('sets loadingStatus to ERROR and loadingError when initial loadFasta fails', async () => {
    sequenceEditorStore.getState().setLoadingStatus(LOADING_STATUS.LOADING);
    mockEditorWorkerService.loadFasta.mockRejectedValueOnce(new Error('InvalidAlphabet: Invalid character Z'));

    await expect(
      sequenceEditorStore.getState().setData('>seq1\nATGZ'),
    ).rejects.toThrow('InvalidAlphabet');

    const state = sequenceEditorStore.getState();
    expect(state.loadingStatus).toBe(LOADING_STATUS.ERROR);
    expect(state.loadingError).toContain('Invalid character');
  });

  it('keeps loadingStatus as SUCCESS and sets latestMessage when in-session paste fails FastaUtil.parseFasta, and clears it on next worker command', async () => {
    await sequenceEditorStore.getState().setData('>seq1\nATGC');
    expect(sequenceEditorStore.getState().loadingStatus).toBe(LOADING_STATUS.SUCCESS);

    await expect(
      sequenceEditorStore.getState().setData('not a fasta'),
    ).rejects.toThrow('FASTA sequence data appeared before its first header.');

    expect(sequenceEditorStore.getState().loadingStatus).toBe(LOADING_STATUS.SUCCESS);
    expect(sequenceEditorStore.getState().latestMessage).toBe('FASTA sequence data appeared before its first header.');

    registeredMessageHandler?.(null);
    expect(sequenceEditorStore.getState().latestMessage).toBeNull();
  });

  it('validates TSV metadata before invoking EditorWorkerService.loadFasta', async () => {
    await expect(
      sequenceEditorStore.getState().setData('>seq1\nATGC', '   '),
    ).rejects.toThrow();

    expect(mockEditorWorkerService.loadFasta).not.toHaveBeenCalled();
    expect(sequenceEditorStore.getState().loadingStatus).toBe(LOADING_STATUS.ERROR);
  });

  it('treats empty or whitespace-only FASTA as a no-op during an active session, while rejecting it on initial load', async () => {
    await expect(
      sequenceEditorStore.getState().setData('   \n  '),
    ).rejects.toThrow('The FASTA input is empty.');
    expect(sequenceEditorStore.getState().loadingStatus).toBe(LOADING_STATUS.ERROR);

    await sequenceEditorStore.getState().setData('>seq1\nATGC');
    vi.clearAllMocks();

    const result = await sequenceEditorStore.getState().setData('   \n\t  ');
    expect(mockEditorWorkerService.loadFasta).not.toHaveBeenCalled();
    expect(mockEventBusService.emit).not.toHaveBeenCalled();
    expect(result.fastaResult.sequences.map((s) => s.id)).toEqual(['seq1']);
    expect(sequenceEditorStore.getState().loadingStatus).toBe(LOADING_STATUS.SUCCESS);
    expect(sequenceEditorStore.getState().latestMessage).toBeNull();
  });

  it('recomputes expectedLength, isAligned, and invalidSequences across combinedSequences when prepending wider or shorter batches', async () => {
    await sequenceEditorStore.getState().setData('>existing\nATGC');
    expect(sequenceEditorStore.getState().parsedFasta?.isAligned).toBe(true);
    expect(sequenceEditorStore.getState().parsedFasta?.expectedLength).toBe(4);
    expect(sequenceEditorStore.getState().parsedFasta?.sequences[0]?.sequence).toBe('');

    await sequenceEditorStore.getState().setData('>prepended_wider\nATGCCC');

    const afterWider = sequenceEditorStore.getState().parsedFasta;
    expect(afterWider?.sequences.map((s) => s.id)).toEqual(['prepended_wider', 'existing']);
    expect(afterWider?.expectedLength).toBe(6);
    expect(afterWider?.isAligned).toBe(false);
    expect(afterWider?.invalidSequences).toEqual([{ id: 'existing', length: 4 }]);

    sequenceEditorStore.getState().resetDataset();
    await sequenceEditorStore.getState().setData('>wide1\nATGCCC\n>wide2\nGGGCCC');
    expect(sequenceEditorStore.getState().parsedFasta?.isAligned).toBe(true);
    expect(sequenceEditorStore.getState().parsedFasta?.expectedLength).toBe(6);

    await sequenceEditorStore.getState().setData('>prepended_shorter\nATGC');

    const afterShorter = sequenceEditorStore.getState().parsedFasta;
    expect(afterShorter?.sequences.map((s) => s.id)).toEqual(['prepended_shorter', 'wide1', 'wide2']);
    expect(afterShorter?.expectedLength).toBe(6);
    expect(afterShorter?.isAligned).toBe(false);
    expect(afterShorter?.invalidSequences).toEqual([{ id: 'prepended_shorter', length: 4 }]);
  });

  it('removes prepended sequences from the front on undo and restores them on redo via setMeta', async () => {
    await sequenceEditorStore.getState().setData('>existing1\nATGC\n>existing2\nCGTA');
    await sequenceEditorStore.getState().setData('>prepended1\nATGCCC');

    expect(sequenceEditorStore.getState().parsedFasta?.sequences.map((s) => s.id)).toEqual([
      'prepended1',
      'existing1',
      'existing2',
    ]);

    // Simulate Undo of the prepended batch (sequenceCount drops from 3 to 2)
    sequenceEditorStore.getState().setMeta({
      alignmentWidth: 4,
      redoDepth: 1,
      sequenceCount: 2,
      undoDepth: 0,
    });

    const afterUndo = sequenceEditorStore.getState().parsedFasta;
    expect(afterUndo?.sequences.map((s) => s.id)).toEqual(['existing1', 'existing2']);
    expect(afterUndo?.expectedLength).toBe(4);
    expect(afterUndo?.isAligned).toBe(true);
    expect(afterUndo?.invalidSequences).toBeUndefined();

    // Simulate Redo of the prepended batch (sequenceCount returns from 2 to 3)
    sequenceEditorStore.getState().setMeta({
      alignmentWidth: 6,
      redoDepth: 0,
      sequenceCount: 3,
      undoDepth: 1,
    });

    const afterRedo = sequenceEditorStore.getState().parsedFasta;
    expect(afterRedo?.sequences.map((s) => s.id)).toEqual(['prepended1', 'existing1', 'existing2']);
    expect(afterRedo?.expectedLength).toBe(6);
    expect(afterRedo?.isAligned).toBe(false);
    expect(afterRedo?.invalidSequences).toEqual([
      { id: 'existing1', length: 4 },
      { id: 'existing2', length: 4 },
    ]);
  });

  it('clears undone sequence batches when a subsequent edit resets redoDepth to 0', async () => {
    await sequenceEditorStore.getState().setData('>existing1\nATGC\n>existing2\nCGTA');
    await sequenceEditorStore.getState().setData('>prepended1\nATGCCC');

    // Undo prepend -> redoDepth is 1, sequenceCount drops to 2
    sequenceEditorStore.getState().setMeta({
      alignmentWidth: 4,
      redoDepth: 1,
      sequenceCount: 2,
      undoDepth: 0,
    });

    // Subsequent edit (e.g. mutate) keeps sequenceCount at 2 and resets redoDepth to 0
    sequenceEditorStore.getState().setMeta({
      alignmentWidth: 4,
      redoDepth: 0,
      sequenceCount: 2,
      undoDepth: 1,
    });

    // If sequenceCount later increases without setData, cleared batches are not reused and unique synthetic IDs are generated
    sequenceEditorStore.getState().setMeta({
      alignmentWidth: 4,
      redoDepth: 0,
      sequenceCount: 3,
      undoDepth: 2,
    });

    sequenceEditorStore.getState().setMeta({
      alignmentWidth: 4,
      redoDepth: 0,
      sequenceCount: 4,
      undoDepth: 3,
    });

    expect(sequenceEditorStore.getState().parsedFasta?.sequences.map((s) => s.id)).toEqual([
      '__synthetic_seq_1',
      '__synthetic_seq_0',
      'existing1',
      'existing2',
    ]);
  });

  it('resets the engine before loading the first batch of a new session, but not before prepends', async () => {
    await sequenceEditorStore.getState().setData('>seq1\nATGC');

    expect(mockEditorWorkerService.reset).toHaveBeenCalledTimes(1);
    expect(mockEditorWorkerService.loadFasta).toHaveBeenCalledTimes(1);
    expect(mockEditorWorkerService.reset.mock.invocationCallOrder[0]).toBeLessThan(
      mockEditorWorkerService.loadFasta.mock.invocationCallOrder[0] ?? 0,
    );

    vi.clearAllMocks();
    await sequenceEditorStore.getState().setData('>seq0\nATGC');

    expect(mockEditorWorkerService.reset).not.toHaveBeenCalled();
    expect(mockEditorWorkerService.loadFasta).toHaveBeenCalledTimes(1);
  });

  it('discards a load that completes after resetDataset was called', async () => {
    await sequenceEditorStore.getState().setData('>existing\nATGC');
    vi.clearAllMocks();

    let resolveLoad: (count: number) => void = () => undefined;
    mockEditorWorkerService.loadFasta.mockReturnValueOnce(new Promise<number>((resolve) => {
      resolveLoad = resolve;
    }));

    const pendingSetData = sequenceEditorStore.getState().setData('>pasted\nATGC');
    await vi.waitFor(() => {
      expect(mockEditorWorkerService.loadFasta).toHaveBeenCalledTimes(1);
    });
    sequenceEditorStore.getState().resetDataset();
    resolveLoad(2);

    await expect(pendingSetData).rejects.toMatchObject({ name: 'AbortError' });

    const state = sequenceEditorStore.getState();
    expect(state.parsedFasta).toBeNull();
    expect(state.rawFasta).toBe('');
    expect(mockEventBusService.emit).not.toHaveBeenCalled();
  });

  it('does not set an error status when a load superseded by resetDataset fails', async () => {
    await sequenceEditorStore.getState().setData('>existing\nATGC');
    vi.clearAllMocks();

    let rejectLoad: (error: Error) => void = () => undefined;
    mockEditorWorkerService.loadFasta.mockReturnValueOnce(new Promise<number>((_, reject) => {
      rejectLoad = reject;
    }));

    const pendingSetData = sequenceEditorStore.getState().setData('>pasted\nATGC');
    await vi.waitFor(() => {
      expect(mockEditorWorkerService.loadFasta).toHaveBeenCalledTimes(1);
    });
    sequenceEditorStore.getState().resetDataset();
    const loadingStatusAfterReset = sequenceEditorStore.getState().loadingStatus;
    rejectLoad(new Error('InvalidAlphabet: Invalid character Z'));

    await expect(pendingSetData).rejects.toMatchObject({ name: 'AbortError' });

    const state = sequenceEditorStore.getState();
    expect(state.loadingStatus).toBe(loadingStatusAfterReset);
    expect(state.loadingError).toBeNull();
    expect(state.latestMessage).toBeNull();
  });

  it('surfaces engine reset failures through latestMessage', async () => {
    mockEditorWorkerService.reset.mockRejectedValueOnce(new Error('Engine failed to initialize'));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    sequenceEditorStore.getState().resetDataset();

    await vi.waitFor(() => {
      expect(sequenceEditorStore.getState().latestMessage).toContain('Engine failed to initialize');
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('serializes overlapping setData calls so subsequent loads do not trigger an extra engine reset', async () => {
    let resolveFirstLoad: (count: number) => void = () => undefined;
    mockEditorWorkerService.loadFasta.mockReturnValueOnce(new Promise<number>((resolve) => {
      resolveFirstLoad = resolve;
    }));
    mockEditorWorkerService.loadFasta.mockResolvedValueOnce(2);

    const firstLoad = sequenceEditorStore.getState().setData('>seq1\nATGC');
    const secondLoad = sequenceEditorStore.getState().setData('>seq2\nATGC');

    await vi.waitFor(() => {
      expect(mockEditorWorkerService.reset).toHaveBeenCalledTimes(1);
      expect(mockEditorWorkerService.loadFasta).toHaveBeenCalledTimes(1);
    });

    // Resolve first load so second load can proceed
    resolveFirstLoad(1);

    await Promise.all([firstLoad, secondLoad]);

    // reset should ONLY have been called once (for the very first batch)
    expect(mockEditorWorkerService.reset).toHaveBeenCalledTimes(1);
    expect(mockEditorWorkerService.loadFasta).toHaveBeenCalledTimes(2);

    const state = sequenceEditorStore.getState();
    expect(state.parsedFasta?.sequences.map((s) => s.id)).toEqual(['seq2', 'seq1']);
  });

  it('aborts without invoking loadFasta when resetDataset is called while initial engine reset is pending', async () => {
    let resolveReset: () => void = () => undefined;
    mockEditorWorkerService.reset.mockReturnValueOnce(new Promise<void>((resolve) => {
      resolveReset = resolve;
    }));

    const pendingLoad = sequenceEditorStore.getState().setData('>seq1\nATGC');

    await vi.waitFor(() => {
      expect(mockEditorWorkerService.reset).toHaveBeenCalledTimes(1);
    });

    // Reset dataset while engine reset is in flight
    sequenceEditorStore.getState().resetDataset();
    resolveReset();

    await expect(pendingLoad).rejects.toMatchObject({ name: 'AbortError' });
    expect(mockEditorWorkerService.loadFasta).not.toHaveBeenCalled();
  });

  it('removes deleted rows at their exact indices and restores them on undo and re-deletes on redo', async () => {
    await sequenceEditorStore.getState().setData('>seq1\nATGC\n>seq2\nATGCCC\n>seq3\nCGTA');
    sequenceEditorStore.getState().setMeta({
      alignmentWidth: 6,
      redoDepth: 0,
      sequenceCount: 3,
      undoDepth: 0,
    });

    // Forward delete of middle row (seq2 at index 1)
    sequenceEditorStore.getState().recordDeletedRows([1]);
    sequenceEditorStore.getState().setMeta({
      alignmentWidth: 4,
      redoDepth: 0,
      sequenceCount: 2,
      undoDepth: 1,
    });

    const afterDelete = sequenceEditorStore.getState().parsedFasta;
    expect(afterDelete?.sequences.map((s) => s.id)).toEqual(['seq1', 'seq3']);
    expect(afterDelete?.isAligned).toBe(true);

    // Undo deleteRows -> restores seq2 at index 1 (no dummy seq_0)
    sequenceEditorStore.getState().setMeta({
      alignmentWidth: 6,
      redoDepth: 1,
      sequenceCount: 3,
      undoDepth: 0,
    });

    const afterUndo = sequenceEditorStore.getState().parsedFasta;
    expect(afterUndo?.sequences.map((s) => s.id)).toEqual(['seq1', 'seq2', 'seq3']);
    expect(afterUndo?.isAligned).toBe(false);

    // Redo deleteRows -> removes seq2 at index 1 again
    sequenceEditorStore.getState().setMeta({
      alignmentWidth: 4,
      redoDepth: 0,
      sequenceCount: 2,
      undoDepth: 1,
    });

    const afterRedo = sequenceEditorStore.getState().parsedFasta;
    expect(afterRedo?.sequences.map((s) => s.id)).toEqual(['seq1', 'seq3']);
    expect(afterRedo?.isAligned).toBe(true);
  });

  it('treats session as active when all rows have been deleted but rawFasta is present', async () => {
    await sequenceEditorStore.getState().setData('>seq1\nATGC');
    sequenceEditorStore.getState().recordDeletedRows([0]);
    sequenceEditorStore.getState().setMeta({
      alignmentWidth: 0,
      redoDepth: 0,
      sequenceCount: 0,
      undoDepth: 1,
    });

    expect(sequenceEditorStore.getState().parsedFasta?.sequences).toEqual([]);

    await expect(
      sequenceEditorStore.getState().setData('not a fasta'),
    ).rejects.toThrow('FASTA sequence data appeared before its first header.');

    expect(sequenceEditorStore.getState().loadingStatus).toBe(LOADING_STATUS.SUCCESS);
    expect(sequenceEditorStore.getState().latestMessage).toBe('FASTA sequence data appeared before its first header.');
  });

  it('preserves LIFO ordering across interleaved prepend and row deletion undo/redo cycles', async () => {
    await sequenceEditorStore.getState().setData('>seq1\nATGC\n>seq2\nCGTA');
    sequenceEditorStore.getState().setMeta({
      alignmentWidth: 4,
      redoDepth: 0,
      sequenceCount: 2,
      undoDepth: 0,
    });

    // 1. Prepend 'top' -> ['top', 'seq1', 'seq2']
    await sequenceEditorStore.getState().setData('>top\nTTTT');
    sequenceEditorStore.getState().setMeta({
      alignmentWidth: 4,
      redoDepth: 0,
      sequenceCount: 3,
      undoDepth: 1,
    });
    expect(sequenceEditorStore.getState().parsedFasta?.sequences.map((s) => s.id)).toEqual(['top', 'seq1', 'seq2']);

    // 2. Delete row 2 ('seq2') -> ['top', 'seq1']
    sequenceEditorStore.getState().recordDeletedRows([2]);
    sequenceEditorStore.getState().setMeta({
      alignmentWidth: 4,
      redoDepth: 0,
      sequenceCount: 2,
      undoDepth: 2,
    });
    expect(sequenceEditorStore.getState().parsedFasta?.sequences.map((s) => s.id)).toEqual(['top', 'seq1']);

    // 3. Undo delete -> ['top', 'seq1', 'seq2']
    sequenceEditorStore.getState().setMeta({
      alignmentWidth: 4,
      redoDepth: 1,
      sequenceCount: 3,
      undoDepth: 1,
    });
    expect(sequenceEditorStore.getState().parsedFasta?.sequences.map((s) => s.id)).toEqual(['top', 'seq1', 'seq2']);

    // 4. Undo prepend -> ['seq1', 'seq2']
    sequenceEditorStore.getState().setMeta({
      alignmentWidth: 4,
      redoDepth: 2,
      sequenceCount: 2,
      undoDepth: 0,
    });
    expect(sequenceEditorStore.getState().parsedFasta?.sequences.map((s) => s.id)).toEqual(['seq1', 'seq2']);

    // 5. Redo prepend -> ['top', 'seq1', 'seq2']
    sequenceEditorStore.getState().setMeta({
      alignmentWidth: 4,
      redoDepth: 1,
      sequenceCount: 3,
      undoDepth: 1,
    });
    expect(sequenceEditorStore.getState().parsedFasta?.sequences.map((s) => s.id)).toEqual(['top', 'seq1', 'seq2']);

    // 6. Redo delete -> ['top', 'seq1']
    sequenceEditorStore.getState().setMeta({
      alignmentWidth: 4,
      redoDepth: 0,
      sequenceCount: 2,
      undoDepth: 2,
    });
    expect(sequenceEditorStore.getState().parsedFasta?.sequences.map((s) => s.id)).toEqual(['top', 'seq1']);
  });
});
