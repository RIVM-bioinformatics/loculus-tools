import { container } from 'tsyringe';
import { FastaPageHeaderCenterComponent } from '@rivm-loculus-tools/common-frontend/components/fasta/FastaPageHeaderCenterComponent';
import { FastaPageHeaderImportButton } from '@rivm-loculus-tools/common-frontend/components/fasta/FastaPageHeaderImportButton';
import { FastaPageHeaderResetButton } from '@rivm-loculus-tools/common-frontend/components/fasta/FastaPageHeaderResetButton';
import { PageCommonHeader } from '@rivm-loculus-tools/common-frontend/components/ui/PageCommonHeader';
import {
  useCallback,
  useMemo,
  useSyncExternalStore,
} from 'react';
import { UrlService } from '@rivm-loculus-tools/common-frontend/classes/services/UrlService';
import CodeIcon from '@mui/icons-material/Code';
import PublishIcon from '@mui/icons-material/Publish';
import { useStore } from 'zustand';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import {
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import { ButtonWithMenu } from '@rivm-loculus-tools/common-frontend/components/ui/ButtonWithMenu';
import type { ButtonWithMenuProps } from '@rivm-loculus-tools/common-frontend/components/ui/ButtonWithMenu';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { LoculusService } from '@rivm-loculus-tools/common-frontend/classes/services/LoculusService';

import { sequenceEditorStore } from '../../../stores/sequenceEditorStore';
import { SequenceEditorEventBusService } from '../../../classes/services/SequenceEditorEventBusService';

import { SequenceEditorUndoRedoButtons } from './SequenceEditorUndoRedoButtons';

export const SequenceEditorPageHeader = () => {
  const loculusService = useMemo(() => container.resolve(LoculusService), []);
  const urlService = useMemo(() => container.resolve(UrlService), []);

  const isAuthenticated = useSyncExternalStore(
    useCallback((onStoreChange) => loculusService.subscribe(onStoreChange), [loculusService]),
    useCallback(() => loculusService.data.authenticated, [loculusService]),
    () => false,
  );

  const hasReturnParams = useSyncExternalStore(
    useCallback((onStoreChange) => urlService.subscribe(onStoreChange), [urlService]),
    useCallback(() => urlService.hasReturnParams(), [urlService]),
    () => false,
  );

  const isRealigning = useStore(sequenceEditorStore, (state) => state.isRealigning);
  const resetDataset = useStore(sequenceEditorStore, (state) => state.resetDataset);

  const sequenceCount = useStore(sequenceEditorStore, (state) => state.engineMeta?.sequenceCount ?? 0);
  const parsedMetadata = useStore(sequenceEditorStore, (state) => state.parsedMetadata);
  const hasFasta = useStore(sequenceEditorStore, (state) => !!state.rawFasta);

  const onReset = useCallback(() => {
    resetDataset();
  }, [resetDataset]);

  const onRealignButtonClick = useCallback(() => {
    if (isRealigning) {
      return;
    }
    container.resolve(SequenceEditorEventBusService).emit('onRealign');
  }, [isRealigning]);

  const onClickExportFasta = useCallback(() => {
    container.resolve(SequenceEditorEventBusService).emit('onExportUngappedFasta');
  }, []);

  const onClickExportGappedFasta = useCallback(() => {
    container.resolve(SequenceEditorEventBusService).emit('onExportGappedFasta');
  }, []);

  const onClickUploadToLoculus = useCallback(() => {
    container.resolve(SequenceEditorEventBusService).emit('onExportToLoculus');
  }, []);

  const exportExportMenuItems: ButtonWithMenuProps['items'] = useMemo(() => [
    {
      disabled: !isAuthenticated || !hasFasta || !hasReturnParams || !parsedMetadata,
      icon: <PublishIcon fontSize={'small'} />,
      label: 'Export to loculus',
      onClick: onClickUploadToLoculus,
    },
    {
      disabled: !hasFasta,
      icon: <CodeIcon fontSize={'small'} />,
      label: 'Save as Ungapped Fasta (.fasta)',
      onClick: onClickExportFasta,
    },
    {
      disabled: !hasFasta,
      icon: <CodeIcon fontSize={'small'} />,
      label: 'Save as Gapped Fasta (.fasta)',
      onClick: onClickExportGappedFasta,
    },
  ], [isAuthenticated, hasFasta, hasReturnParams, parsedMetadata, onClickUploadToLoculus, onClickExportFasta, onClickExportGappedFasta]);

  const metaDataCount = parsedMetadata?.records?.length || 0;

  return (
    <PageCommonHeader
      centerComponent={(
        <FastaPageHeaderCenterComponent
          metaDataCount={metaDataCount}
          sequenceCount={sequenceCount}
        />
      )}
      rightComponent={(
        <>
          <SequenceEditorUndoRedoButtons />
          <Tooltip title={isRealigning ? 'Re-aligning sequences...' : 'Re-align all sequences (MAFFT FFT-NS-1)'}>
            <span>
              <IconButton
                aria-label={isRealigning ? 'Re-aligning sequences...' : 'Re-align all sequences (MAFFT FFT-NS-1)'}
                color={'inherit'}
                disabled={isRealigning || (sequenceCount ?? 0) < 2}
                onClick={onRealignButtonClick}
                size={'small'}
                sx={{ opacity: 0.85 }}
              >
                {isRealigning ? (
                  <CircularProgress
                    color={'inherit'}
                    size={18}
                  />
                ) : (
                  <AutoFixHighIcon fontSize={'small'} />
                )}
              </IconButton>
            </span>
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
