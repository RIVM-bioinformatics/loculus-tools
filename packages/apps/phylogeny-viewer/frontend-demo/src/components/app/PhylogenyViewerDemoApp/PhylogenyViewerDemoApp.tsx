import { DependencyContainerUtil } from '@rivm-loculus-tools/common-frontend/utils/DependencyContainerUtil';
import { PhylogenyViewerApp } from '@rivm-loculus-tools/phylogeny-viewer/components/app/PhylogenyViewerApp';
import { theme } from '@rivm-loculus-tools/common-frontend/theme';
import { PhylogenyViewerStandardConfigUtil } from '@rivm-loculus-tools/phylogeny-viewer/utils/PhylogenyViewerStandardConfigUtil';
import {
  useCallback,
  useMemo,
} from 'react';
import type { DialogAction } from '@gen-epix/ui-core-components/components/Dialog';
import { FastaDataEventBusService } from '@rivm-loculus-tools/common-frontend/classes/services/FastaDataEventBusService';
import { ErrorUtil } from '@rivm-loculus-tools/common-frontend/utils/ErrorUtil';
import { UrlUtil } from '@rivm-loculus-tools/common-frontend/utils/UrlUtil';
import { phylogenyViewerStore } from '@rivm-loculus-tools/phylogeny-viewer/stores/phylogenyViewerStore';
import { useStore } from 'zustand';
import { CONFIG_TOKEN } from '@rivm-loculus-tools/common-frontend/constants/config.constants';

export const PhylogenyViewerDemoApp = () => {
  const setData = useStore(phylogenyViewerStore, (state) => state.setData);
  const container = useMemo(() => DependencyContainerUtil.createContainer(), []);

  const onClickLoadDemoData = useCallback(async () => {
    try {
      const [fastaRes, metaRes] = await Promise.all([
        fetch('/sample-data/sarscov2_aligned.fasta'),
        fetch('/sample-data/sarscov2_metadata.tsv'),
      ]);
      const demoFastaText = await fastaRes.text();
      const demoMetadataText = await metaRes.text();

      await setData(demoFastaText, demoMetadataText, 'country');
      container.resolve(FastaDataEventBusService).emit('onCloseImportDialog');
    } catch (err: unknown) {
      container.resolve(FastaDataEventBusService).emit('onCloseImportDialog');
      const errorMessage = `Failed to load demo dataset: ${ErrorUtil.getErrorMessage(err, 'Unknown error')}`;
      container.resolve(FastaDataEventBusService).emit('onShowImportDialog', errorMessage);
    } finally {
      UrlUtil.clearSearchParams();
    }
  }, [container, setData]);

  const extraFastaDataImportDialogLoaderActions = useMemo<DialogAction[]>(() => [
    {
      autoFocus: true,
      color: 'secondary',
      label: 'Demo (SARS-CoV-2)',
      onClick: onClickLoadDemoData,
      variant: 'contained',
    },
  ], [onClickLoadDemoData]);


  const config = useMemo(() => {
    return {
      ...PhylogenyViewerStandardConfigUtil.createConfig(),
      fastaImportExtraActions: extraFastaDataImportDialogLoaderActions,
      theme,
    };
  }, [extraFastaDataImportDialogLoaderActions]);

  // Note: do not run this in a useEffect, as it should be executed synchronously during component initialization
  container.register(CONFIG_TOKEN, { useValue: config });

  return (
    <PhylogenyViewerApp
      container={container}
    />
  );
};
