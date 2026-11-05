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
});
