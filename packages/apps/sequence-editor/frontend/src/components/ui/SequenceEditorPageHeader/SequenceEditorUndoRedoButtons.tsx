import { container } from 'tsyringe';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import {
  IconButton,
  Tooltip,
} from '@mui/material';
import { useCallback } from 'react';
import { useStore } from 'zustand';

import { sequenceEditorStore } from '../../../stores/sequenceEditorStore';
import { SequenceEditorEventBusService } from '../../../classes/services/SequenceEditorEventBusService';

export const SequenceEditorUndoRedoButtons = () => {
  const undoDepth = useStore(sequenceEditorStore, (state) => state.meta?.undoDepth);
  const redoDepth = useStore(sequenceEditorStore, (state) => state.meta?.redoDepth);

  const onUndoButtonClick = useCallback(() => {
    container.resolve(SequenceEditorEventBusService).emit('onUndo');
  }, []);

  const onRedoButtonClick = useCallback(() => {
    container.resolve(SequenceEditorEventBusService).emit('onRedo');
  }, []);

  return (
    <>
      <Tooltip title={'Undo last action'}>
        <IconButton
          color={'inherit'}
          disabled={undoDepth === 0}
          onClick={onUndoButtonClick}
          size={'small'}
          sx={{ opacity: 0.85 }}
        >
          <UndoIcon fontSize={'small'} />
        </IconButton>
      </Tooltip>
      <Tooltip title={'Redo last action'}>
        <IconButton
          color={'inherit'}
          disabled={redoDepth === 0}
          onClick={onRedoButtonClick}
          size={'small'}
          sx={{ opacity: 0.85 }}
        >
          <RedoIcon fontSize={'small'} />
        </IconButton>
      </Tooltip>
    </>
  );
};
