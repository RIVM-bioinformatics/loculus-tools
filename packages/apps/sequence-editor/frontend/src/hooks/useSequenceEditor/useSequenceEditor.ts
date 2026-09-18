import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
} from 'react';

import type { EngineClient } from '../../engine/useEngineWorker';
import {
  editorReducer,
  initialEditorState,
} from '../../models/editor';
import {
  datasetFilename,
  downloadText,
  preflightFasta,
} from '../../utils/fasta';

const ENGINE_ERROR_MESSAGES = new Map<string, string>([
  ['DeleteNotGap', 'Delete failed: the selected position is not a gap.'],
  ['MoveNoGapTarget', 'Move failed: the target position must be a gap.'],
  ['MoveNotIupac', 'Move failed: only nucleotide or gap characters can move.'],
  ['MutateNotIupac', 'Edit failed: use a nucleotide, IUPAC ambiguity code, or gap.'],
]);

const getErrorCode = (error: unknown): null | string => {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : null;
  }
  return null;
};

const getErrorMessage = (error: unknown): string => {
  const code = getErrorCode(error);
  const mappedMessage = code ? ENGINE_ERROR_MESSAGES.get(code) : undefined;
  if (mappedMessage) {
    return mappedMessage;
  }
  return error instanceof Error ? error.message : 'The sequence-editor command failed.';
};

interface CommandOptions {
  dirty: boolean;
  status?: string;
  updateRevision: boolean;
}

export const useSequenceEditor = (engine: EngineClient) => {
  const [state, dispatch] = useReducer(editorReducer, initialEditorState);
  const commandQueueRef = useRef<Promise<void>>(Promise.resolve());

  const {
    delete: deleteBases,
    deleteColumn: deleteAlignmentColumn,
    error: engineError,
    exportFasta: exportEngineFasta,
    insert: insertGaps,
    load: loadEngine,
    meta: fetchMetadata,
    moveHorizontal: moveHorizontalEngine,
    moveRowsDown: moveRowsDownEngine,
    moveRowsUp: moveRowsUpEngine,
    mutate: mutateEngine,
    ready,
    redo: redoEngine,
    search: searchEngine,
    undo: undoEngine,
  } = engine;

  const runCommand = useCallback(
    async <T,>(label: string, operation: () => Promise<T>, options: CommandOptions): Promise<T> => {
      const execute = async (): Promise<T> => {
        dispatch({ label, type: 'setBusy' });
        try {
          const result = await operation();
          dispatch({
            dirty: options.dirty,
            status: options.status,
            type: 'commandSucceeded',
            updateRevision: options.updateRevision,
          });
          return result;
        } catch (error: unknown) {
          dispatch({ message: getErrorMessage(error), type: 'commandFailed' });
          throw error;
        }
      };

      const queued = commandQueueRef.current.then(execute, execute);
      commandQueueRef.current = queued.then(
        () => undefined,
        () => undefined,
      );
      return queued;
    },
    [],
  );

  const refreshMetadata = useCallback(async (): Promise<void> => {
    if (!ready) {
      return;
    }
    const metadata = await fetchMetadata();
    dispatch({ type: 'setMetadata', value: metadata });
  }, [fetchMetadata, ready]);

  useEffect(() => {
    if (ready) {
      void refreshMetadata().catch((error: unknown) => {
        dispatch({ message: getErrorMessage(error), type: 'commandFailed' });
      });
    }
  }, [ready, refreshMetadata]);

  useEffect(() => {
    if (engineError) {
      dispatch({ message: engineError, type: 'commandFailed' });
    }
  }, [engineError]);

  const loadFasta = useCallback(
    async (fasta: string, label: string): Promise<void> => {
      let preflight;
      try {
        preflight = preflightFasta(fasta);
      } catch (error: unknown) {
        const message = getErrorMessage(error);
        dispatch({ message, type: 'commandFailed' });
        throw error;
      }

      await runCommand(
        'Loading alignment',
        async () => {
          await loadEngine(fasta);
          const metadata = await fetchMetadata();
          dispatch({ label, metadata, type: 'resetForDataset' });
        },
        {
          dirty: false,
          status: `Loaded ${preflight.records.length} sequence${preflight.records.length === 1 ? '' : 's'}.`,
          updateRevision: true,
        },
      );
    },
    [fetchMetadata, loadEngine, runCommand],
  );

  const exportFasta = useCallback(async (): Promise<void> => {
    await runCommand(
      'Preparing FASTA export',
      async () => {
        const fasta = await exportEngineFasta();
        downloadText(fasta, datasetFilename(state.datasetLabel));
      },
      { dirty: false, status: 'FASTA exported.', updateRevision: false },
    );
  }, [exportEngineFasta, runCommand, state.datasetLabel]);

  const undo = useCallback(async (): Promise<void> => {
    const changed = await runCommand(
      'Undoing last edit',
      async () => {
        const result = await undoEngine();
        await refreshMetadata();
        return result;
      },
      { dirty: true, status: 'Undo complete.', updateRevision: true },
    );
    dispatch({ type: 'setStatus', value: changed ? 'Undo complete.' : 'Nothing to undo.' });
  }, [refreshMetadata, runCommand, undoEngine]);

  const redo = useCallback(async (): Promise<void> => {
    const changed = await runCommand(
      'Redoing last edit',
      async () => {
        const result = await redoEngine();
        await refreshMetadata();
        return result;
      },
      { dirty: true, status: 'Redo complete.', updateRevision: true },
    );
    dispatch({ type: 'setStatus', value: changed ? 'Redo complete.' : 'Nothing to redo.' });
  }, [redoEngine, refreshMetadata, runCommand]);

  const mutate = useCallback(
    async (rows: number[], col: number, base: string) => runCommand(
      'Applying edit',
      async () => {
        await mutateEngine(rows, col, base);
        await refreshMetadata();
      },
      { dirty: true, status: 'Edit applied.', updateRevision: true },
    ),
    [mutateEngine, refreshMetadata, runCommand],
  );

  const insert = useCallback(
    async (rows: number[], col: number) => runCommand(
      'Inserting gaps',
      async () => {
        await insertGaps(rows, col);
        await refreshMetadata();
      },
      { dirty: true, status: 'Gaps inserted.', updateRevision: true },
    ),
    [insertGaps, refreshMetadata, runCommand],
  );

  const deleteBasesCommand = useCallback(
    async (rows: number[], col: number) => runCommand(
      'Deleting gaps',
      async () => {
        await deleteBases(rows, col);
        await refreshMetadata();
      },
      { dirty: true, status: 'Gaps deleted.', updateRevision: true },
    ),
    [deleteBases, refreshMetadata, runCommand],
  );

  const deleteColumn = useCallback(
    async (col: number) => runCommand(
      'Deleting alignment column',
      async () => {
        await deleteAlignmentColumn(col);
        await refreshMetadata();
      },
      { dirty: true, status: 'Alignment column deleted.', updateRevision: true },
    ),
    [deleteAlignmentColumn, refreshMetadata, runCommand],
  );

  const moveHorizontal = useCallback(
    async (row: number, cols: number[], direction: 'Left' | 'Right') => runCommand(
      'Moving bases',
      async () => {
        await moveHorizontalEngine(row, cols, direction);
        await refreshMetadata();
      },
      { dirty: true, status: 'Bases moved.', updateRevision: true },
    ),
    [moveHorizontalEngine, refreshMetadata, runCommand],
  );

  const moveRowsUp = useCallback(
    async (rows: number[]) => runCommand(
      'Moving rows',
      async () => {
        await moveRowsUpEngine(rows);
        await refreshMetadata();
      },
      { dirty: true, status: 'Rows moved.', updateRevision: true },
    ),
    [moveRowsUpEngine, refreshMetadata, runCommand],
  );

  const moveRowsDown = useCallback(
    async (rows: number[]) => runCommand(
      'Moving rows',
      async () => {
        await moveRowsDownEngine(rows);
        await refreshMetadata();
      },
      { dirty: true, status: 'Rows moved.', updateRevision: true },
    ),
    [moveRowsDownEngine, refreshMetadata, runCommand],
  );

  const search = useCallback(
    async (query: string, includeRecordNames: boolean): Promise<void> => {
      try {
        const results = await searchEngine(query, includeRecordNames);
        dispatch({ type: 'setSearchResults', value: results });
      } catch (error: unknown) {
        dispatch({ message: getErrorMessage(error), type: 'commandFailed' });
      }
    },
    [searchEngine],
  );

  return {
    clearError: () => dispatch({ type: 'setError', value: null }),
    delete: deleteBasesCommand,
    deleteColumn,
    exportFasta,
    insert,
    loadFasta,
    moveHorizontal,
    moveRowsDown,
    moveRowsUp,
    mutate,
    redo,
    refreshMetadata,
    search,
    setActiveCell: (row: number, col: number) => dispatch({ type: 'setActiveCell', value: { col, row } }),
    setDatasetLabel: (value: string) => dispatch({ type: 'setDatasetLabel', value }),
    setDialog: (value: 'import' | 'none') => dispatch({ type: 'setDialog', value }),
    setPanel: (value: 'none' | 'settings') => dispatch({ type: 'setPanel', value }),
    setSelectedRows: (value: number[]) => dispatch({ type: 'setSelectedRows', value }),
    setSelectionBlock: (value: { endCol: number; startCol: number } | null) => dispatch({ type: 'setSelectionBlock', value }),
    state,
    undo,
  };
};
