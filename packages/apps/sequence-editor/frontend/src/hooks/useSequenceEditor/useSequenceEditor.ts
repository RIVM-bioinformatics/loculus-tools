import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
} from 'react';

import type { EngineClient } from '../../engine/useEngineWorker';
import type { Meta } from '../../engine/protocol';
import {
  editorReducer,
  initialEditorState,
} from '../../models/editor';
import {
  datasetFilename,
  downloadText,
  preflightFasta,
} from '../../utils/fasta';
import type { EditorCommand } from '../../utils/keyboard';
import {
  columnsForBlock,
  mutationRows,
  rowsForBlock,
  selectionBlockForMove,
} from '../../utils/selection';

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
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

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
    mutateRange: mutateRangeEngine,
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

  const refreshMetadata = useCallback(async (): Promise<Meta | null> => {
    if (!ready) {
      return null;
    }
    const metadata = await fetchMetadata();
    dispatch({ type: 'setMetadata', value: metadata });
    return metadata;
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

  const mutateRange = useCallback(
    async (rows: number[], startCol: number, endCol: number, base: string) => runCommand(
      'Applying selection edit',
      async () => {
        await mutateRangeEngine(rows, startCol, endCol, base);
        await refreshMetadata();
      },
      { dirty: true, status: 'Selection edit applied.', updateRevision: true },
    ),
    [mutateRangeEngine, refreshMetadata, runCommand],
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
    async (col: number) => {
      let nextMetadata: Meta | null = null;
      await runCommand(
        'Deleting alignment column',
        async () => {
          await deleteAlignmentColumn(col);
          nextMetadata = await refreshMetadata();
        },
        { dirty: true, status: 'Alignment column deleted.', updateRevision: true },
      );
      const current = stateRef.current;
      const dimensions = nextMetadata ?? current.metadata;
      if (dimensions) {
        dispatch({
          type: 'setActiveCell',
          value: {
            col: Math.min(current.activeCell.col, Math.max(0, dimensions.width - 1)),
            row: Math.min(current.activeCell.row, Math.max(0, dimensions.sequences - 1)),
          },
        });
      }
    },
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

  const executeCommand = useCallback(async (command: EditorCommand): Promise<void> => {
    const current = stateRef.current;
    const metadata = current.metadata;
    if (!metadata || metadata.sequences === 0 || current.busy) {
      return;
    }

    const active = current.activeCell;
    const rows = mutationRows(active.row, current.selectedRows);
    const selectedColumns = columnsForBlock(active, current.selectionBlock);
    const selectionStartCol = selectedColumns[0] ?? active.col;
    const selectionEndCol = selectedColumns[selectedColumns.length - 1] ?? active.col;
    const selectionRows = current.selectionBlock
      ? rowsForBlock(active.row, current.selectionBlock, metadata.sequences)
      : rows;
    let rowDelta = 0;
    let columnDelta = 0;
    if (command.type === 'move') {
      if (command.direction === 'down') {
        rowDelta = 1;
      } else if (command.direction === 'up') {
        rowDelta = -1;
      } else if (command.direction === 'right') {
        columnDelta = 1;
      } else if (command.direction === 'left') {
        columnDelta = -1;
      }
    }
    const boundedCell = (row: number, col: number) => ({
      col: Math.max(0, Math.min(Math.max(0, metadata.width - 1), col)),
      row: Math.max(0, Math.min(metadata.sequences - 1, row)),
    });

    switch (command.type) {
      case 'backspace':
        if (active.col === 0) {
          dispatch({ type: 'setAnnouncement', value: 'Already at the first column.' });
          return;
        }
        await deleteBasesCommand(rows, active.col - 1);
        dispatch({ type: 'setActiveCell', value: { col: active.col - 1, row: active.row } });
        return;
      case 'deleteGap':
        if (current.selectionBlock) {
          await mutateRange(selectionRows, selectionStartCol, selectionEndCol, '-');
        } else {
          await mutate(rows, active.col, '-');
          dispatch({ type: 'setActiveCell', value: boundedCell(active.row, active.col + 1) });
        }
        return;
      case 'end':
        dispatch({ type: 'setActiveCell', value: { col: Math.max(0, metadata.width - 1), row: active.row } });
        dispatch({ type: 'setSelectionBlock', value: null });
        return;
      case 'home':
        dispatch({ type: 'setActiveCell', value: { col: 0, row: active.row } });
        dispatch({ type: 'setSelectionBlock', value: null });
        return;
      case 'insert':
        await insert(selectionRows, selectionStartCol);
        if (current.selectionBlock) {
          dispatch({
            type: 'setSelectionBlock',
            value: {
              endCol: current.selectionBlock.endCol + 1,
              endRow: current.selectionBlock.endRow,
              startCol: current.selectionBlock.startCol + 1,
              startRow: current.selectionBlock.startRow,
            },
          });
          dispatch({ type: 'setActiveCell', value: boundedCell(active.row, active.col + 1) });
        } else {
          dispatch({ type: 'setActiveCell', value: boundedCell(active.row, selectionStartCol + 1) });
        }
        return;
      case 'move': {
        const next = boundedCell(active.row + rowDelta, active.col + columnDelta);
        dispatch({ type: 'setActiveCell', value: next });
        if (command.extend && (command.direction === 'left' || command.direction === 'right')) {
          dispatch({
            type: 'setSelectionBlock',
            value: selectionBlockForMove(active.col, next.col, current.selectionBlock),
          });
        } else {
          dispatch({ type: 'setSelectionBlock', value: null });
        }
        return;
      }
      case 'moveHorizontal': {
        const cols = columnsForBlock(active, current.selectionBlock);
        await moveHorizontal(active.row, cols, command.direction === 'left' ? 'Left' : 'Right');
        dispatch({
          type: 'setActiveCell',
          value: boundedCell(active.row, active.col + (command.direction === 'left' ? -1 : 1)),
        });
        return;
      }
      case 'mutate':
        if (current.selectionBlock) {
          await mutateRange(selectionRows, selectionStartCol, selectionEndCol, command.base);
        } else {
          await mutate(rows, active.col, command.base);
          dispatch({ type: 'setActiveCell', value: boundedCell(active.row, active.col + 1) });
        }
        return;
      case 'pageDown':
        dispatch({ type: 'setActiveCell', value: boundedCell(active.row + 10, active.col) });
        dispatch({ type: 'setSelectionBlock', value: null });
        return;
      case 'pageUp':
        dispatch({ type: 'setActiveCell', value: boundedCell(active.row - 10, active.col) });
        dispatch({ type: 'setSelectionBlock', value: null });
        return;
      case 'redo':
        await redo();
        return;
      case 'undo':
        await undo();
        return;
      default:
        return;
    }
  }, [deleteBasesCommand, insert, moveHorizontal, mutate, mutateRange, redo, undo]);

  return {
    clearError: () => dispatch({ type: 'setError', value: null }),
    delete: deleteBasesCommand,
    deleteColumn,
    executeCommand,
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
    setSelectionAnchorRow: (value: null | number) => dispatch({ type: 'setSelectionAnchorRow', value }),
    setSelectionBlock: (value: { endCol: number; startCol: number } | null) => dispatch({ type: 'setSelectionBlock', value }),
    state,
    undo,
  };
};
