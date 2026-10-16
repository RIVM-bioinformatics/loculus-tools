import { container } from 'tsyringe';
import { FastaPageHeaderCenterComponent } from '@rivm-loculus-tools/common-frontend/components/fasta/FastaPageHeaderCenterComponent';
import { FastaPageHeaderImportButton } from '@rivm-loculus-tools/common-frontend/components/fasta/FastaPageHeaderImportButton';
import { FastaPageHeaderResetButton } from '@rivm-loculus-tools/common-frontend/components/fasta/FastaPageHeaderResetButton';
import { PageCommonHeader } from '@rivm-loculus-tools/common-frontend/components/ui/PageCommonHeader';
import { useCallback } from 'react';
import { useStore } from 'zustand';
import BiotechOutlinedIcon from '@mui/icons-material/BiotechOutlined';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import {
  IconButton,
  Tooltip,
} from '@mui/material';
import { PageHeaderDocumentationButton } from '@rivm-loculus-tools/common-frontend/components/ui/PageHeaderDocumentationButton';

import { sequenceEditorStore } from '../../../stores/sequenceEditorStore';
import { SequenceEditorEventBusService } from '../../../classes/services/SequenceEditorEventBusService';

export const SequenceEditorPageHeader = () => {
  const resetDataset = useStore(sequenceEditorStore, (state) => state.resetDataset);
  const meta = useStore(sequenceEditorStore, (state) => state.meta);

  const onReset = useCallback(() => {
    resetDataset();
  }, [resetDataset]);

  const onUndoButtonClick = useCallback(() => {
    container.resolve(SequenceEditorEventBusService).emit('onUndo');
  }, []);

  const onRedoButtonClick = useCallback(() => {
    container.resolve(SequenceEditorEventBusService).emit('onRedo');
  }, []);

  return (
    <PageCommonHeader
      centerComponent={<FastaPageHeaderCenterComponent store={sequenceEditorStore} />}
      icon={<BiotechOutlinedIcon sx={{ fontSize: 24 }} />}
      rightComponent={(
        <>
          <FastaPageHeaderImportButton />
          <Tooltip title={'Undo last action'}>
            <IconButton
              color={'inherit'}
              disabled={meta?.undoDepth === 0}
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
              disabled={meta?.redoDepth === 0}
              onClick={onRedoButtonClick}
              size={'small'}
              sx={{ opacity: 0.85 }}
            >
              <RedoIcon fontSize={'small'} />
            </IconButton>
          </Tooltip>
          <FastaPageHeaderResetButton onReset={onReset} />
          <PageHeaderDocumentationButton />
        </>
      )}
      title={'Sequence Editor'}
    />
  );
};
