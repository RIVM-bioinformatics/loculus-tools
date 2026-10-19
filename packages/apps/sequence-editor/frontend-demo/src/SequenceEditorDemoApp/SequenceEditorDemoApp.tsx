import { DependencyContainerUtil } from '@rivm-loculus-tools/common-frontend/utils/DependencyContainerUtil';
import { theme } from '@rivm-loculus-tools/common-frontend/theme';
import { SequenceEditorStandardConfigUtil } from '@rivm-loculus-tools/sequence-editor/utils/SequenceEditorStandardConfigUtil';
import {
  useCallback,
  useMemo,
} from 'react';
import type { DialogAction } from '@gen-epix/ui-core-components/components/Dialog';
import { FastaDataEventBusService } from '@rivm-loculus-tools/common-frontend/classes/services/FastaDataEventBusService';
import { ErrorUtil } from '@rivm-loculus-tools/common-frontend/utils/ErrorUtil';
import { UrlUtil } from '@rivm-loculus-tools/common-frontend/utils/UrlUtil';
import { useStore } from 'zustand';
import { CONFIG_TOKEN } from '@rivm-loculus-tools/common-frontend/constants/config.constants';
import { SequenceEditorApp } from '@rivm-loculus-tools/sequence-editor/components/app/App';
import { sequenceEditorStore } from '@rivm-loculus-tools/sequence-editor/stores/sequenceEditorStore';

export const SequenceEditorDemoApp = () => {
  const container = useMemo(() => DependencyContainerUtil.createContainer(), []);
  const setData = useStore(sequenceEditorStore, (state) => state.setData);

  const onClickLoadDemoData = useCallback(async () => {
    try {
      const fastaRes = await fetch('/sample-data/sarscov2_demo.fasta');
      const demoFastaText = await fastaRes.text();

      await setData(demoFastaText);
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
      ...SequenceEditorStandardConfigUtil.createConfig(),
      fastaImportExtraActions: extraFastaDataImportDialogLoaderActions,
      theme,
    };
  }, [extraFastaDataImportDialogLoaderActions]);

  // Note: do not run this in a useEffect, as it should be executed synchronously during component initialization
  container.register(CONFIG_TOKEN, { useValue: config });

  return (
    <SequenceEditorApp
      container={container}
    />
  );
};
