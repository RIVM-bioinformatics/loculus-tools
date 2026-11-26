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
import ImportExportIcon from '@mui/icons-material/ImportExport';
import CodeIcon from '@mui/icons-material/Code';
import PublishIcon from '@mui/icons-material/Publish';
import { useStore } from 'zustand';
import { ButtonWithMenu } from '@rivm-loculus-tools/common-frontend/components/ui/ButtonWithMenu';
import type { ButtonWithMenuProps } from '@rivm-loculus-tools/common-frontend/components/ui/ButtonWithMenu';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { LoculusService } from '@rivm-loculus-tools/common-frontend/classes/services/LoculusService';
import { useConfig } from '@rivm-loculus-tools/common-frontend/hooks/useConfig';

import { sequenceEditorStore } from '../../../stores/sequenceEditorStore';
import { SequenceEditorEventBusService } from '../../../classes/services/SequenceEditorEventBusService';
import type { SequenceEditorConfig } from '../../../models/config.models';

export const SequenceEditorPageHeader = () => {
  const loculusService = useMemo(() => container.resolve(LoculusService), []);
  const urlService = useMemo(() => container.resolve(UrlService), []);
  const config = useConfig<SequenceEditorConfig>();

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

  const resetDataset = useStore(sequenceEditorStore, (state) => state.resetDataset);

  const sequenceCount = useStore(sequenceEditorStore, (state) => state.engineMeta?.sequenceCount ?? 0);
  const parsedMetadata = useStore(sequenceEditorStore, (state) => state.parsedMetadata);
  const hasFasta = useStore(sequenceEditorStore, (state) => !!state.rawFasta);

  const onReset = useCallback(() => {
    resetDataset();
  }, [resetDataset]);

  const onClickExportFasta = useCallback(() => {
    container.resolve(SequenceEditorEventBusService).emit('onExportUngappedFasta');
  }, []);

  const onClickExportGappedFasta = useCallback(() => {
    container.resolve(SequenceEditorEventBusService).emit('onExportGappedFasta');
  }, []);

  const onClickUploadToLoculus = useCallback(() => {
    container.resolve(SequenceEditorEventBusService).emit('onExportToLoculus');
  }, []);

  const onClickOpenInPhylogenyViewer = useCallback(() => {
    container.resolve(SequenceEditorEventBusService).emit('onOpenInPhylogenyViewer');
  }, []);

  const exportExportMenuItems: ButtonWithMenuProps['items'] = useMemo(() => {
    return [
      {
        disabled: !isAuthenticated || !hasFasta || !hasReturnParams || !parsedMetadata,
        icon: <PublishIcon fontSize={'small'} />,
        label: 'Export to loculus',
        onClick: onClickUploadToLoculus,
      },
      config.phylogenyViewerUrl && {
        disabled: !hasFasta,
        icon: <ImportExportIcon fontSize={'small'} />,
        label: 'Open in Phylogeny Viewer',
        onClick: onClickOpenInPhylogenyViewer,
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
    ].filter(Boolean) as ButtonWithMenuProps['items'];
  }, [isAuthenticated, hasFasta, hasReturnParams, parsedMetadata, onClickUploadToLoculus, config.phylogenyViewerUrl, onClickOpenInPhylogenyViewer, onClickExportFasta, onClickExportGappedFasta]);

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
