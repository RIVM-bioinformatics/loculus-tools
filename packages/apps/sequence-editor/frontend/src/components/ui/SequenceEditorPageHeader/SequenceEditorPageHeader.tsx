import { container } from 'tsyringe';
import { FastaPageHeaderCenterComponent } from '@rivm-loculus-tools/common-frontend/components/fasta/FastaPageHeaderCenterComponent';
import { FastaPageHeaderImportButton } from '@rivm-loculus-tools/common-frontend/components/fasta/FastaPageHeaderImportButton';
import { FastaPageHeaderResetButton } from '@rivm-loculus-tools/common-frontend/components/fasta/FastaPageHeaderResetButton';
import { PageCommonHeader } from '@rivm-loculus-tools/common-frontend/components/ui/PageCommonHeader';
import {
  useCallback,
  useMemo,
} from 'react';
import CodeIcon from '@mui/icons-material/Code';
import PublishIcon from '@mui/icons-material/Publish';
import { useStore } from 'zustand';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import {
  IconButton,
  Tooltip,
} from '@mui/material';
import { ButtonWithMenu } from '@rivm-loculus-tools/common-frontend/components/ui/ButtonWithMenu';
import type { ButtonWithMenuProps } from '@rivm-loculus-tools/common-frontend/components/ui/ButtonWithMenu';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';

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

  const onClickExportFasta = useCallback(() => {
    container.resolve(SequenceEditorEventBusService).emit('onExportUngappedFasta');
  }, []);

  const onClickExportGappedFasta = useCallback(() => {
    container.resolve(SequenceEditorEventBusService).emit('onExportGappedFasta');
  }, []);

  const onClickUploadToLoculus = useCallback(() => {
    alert('Not implemented');
  }, []);

  const exportExportMenuItems: ButtonWithMenuProps['items'] = useMemo(() => [
    {
      icon: <PublishIcon fontSize={'small'} />,
      label: 'Export to loculus',
      onClick: onClickUploadToLoculus,
    },
    {
      icon: <CodeIcon fontSize={'small'} />,
      label: 'Save as Ungapped Fasta (.fasta)',
      onClick: onClickExportFasta,
    },
    {
      icon: <CodeIcon fontSize={'small'} />,
      label: 'Save as Gapped Fasta (.fasta)',
      onClick: onClickExportGappedFasta,
    },
  ], [onClickExportFasta, onClickExportGappedFasta, onClickUploadToLoculus]);

  return (
    <PageCommonHeader
      centerComponent={<FastaPageHeaderCenterComponent store={sequenceEditorStore} />}
      rightComponent={(
        <>
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
          <FastaPageHeaderImportButton />
          <ButtonWithMenu
            items={exportExportMenuItems}
            label={'Export'}
            startIcon={<FileDownloadOutlinedIcon />}
          />
        </>
      )}
      title={'Sequence Editor'}
    />
  );
};
