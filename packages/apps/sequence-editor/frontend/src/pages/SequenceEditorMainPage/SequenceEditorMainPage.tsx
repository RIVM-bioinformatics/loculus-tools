import { container } from 'tsyringe';
import { useStore } from 'zustand';
import {
  useCallback,
  useMemo,
} from 'react';
import { FastaDataEventBusService } from '@rivm-loculus-tools/common-frontend/classes/services/FastaDataEventBusService';
import { ErrorUtil } from '@rivm-loculus-tools/common-frontend/utils/ErrorUtil';
import { UrlUtil } from '@rivm-loculus-tools/common-frontend/utils/UrlUtil';
import type { DialogAction } from '@gen-epix/ui-core-components/components/Dialog';
import { FastaDataImportDialogLoader } from '@rivm-loculus-tools/common-frontend/components/fasta/FastaDataImportDialogLoader';
import { BackdropSpinner } from '@gen-epix/ui-core-components/components/BackdropSpinner';
import { FastaNotLoaded } from '@rivm-loculus-tools/common-frontend/components/fasta/FastaNotLoaded';
import BiotechOutlinedIcon from '@mui/icons-material/BiotechOutlined';
import { LOADING_STATUS } from '@rivm-loculus-tools/common-frontend/models/fasta.models';
import { PageCommon } from '@rivm-loculus-tools/common-frontend/components/ui/PageCommon';

import { sequenceEditorStore } from '../../stores/sequenceEditorStore';
import { SequenceEditor } from '../../components/ui/SequenceEditor';


export const SequenceEditorMainPage = () => {
  const loadingStatus = useStore(sequenceEditorStore, (state) => state.loadingStatus);
  const setData = useStore(sequenceEditorStore, (state) => state.setData);
  const rawFasta = useStore(sequenceEditorStore, (state) => state.rawFasta);

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
  }, [setData]);

  const extraFastaDataImportDialogLoaderActions = useMemo<DialogAction[]>(() => [
    {
      autoFocus: true,
      color: 'secondary',
      label: 'Demo (SARS-CoV-2)',
      onClick: onClickLoadDemoData,
      variant: 'contained',
    },
  ], [onClickLoadDemoData]);

  return (
    <PageCommon
      isNoInteraction={false}
      title={'Sequence Editor'}
    >
      {rawFasta && (
        <SequenceEditor />
      )}
      {!rawFasta && (
        <FastaNotLoaded
          description={'Load a FASTA sequence file to enable the editor.'}
          icon={<BiotechOutlinedIcon sx={{ color: 'text.disabled', fontSize: 72 }} />}
          title={'No FASTA Sequence Loaded'}
        />
      )}
      <FastaDataImportDialogLoader
        extraActions={extraFastaDataImportDialogLoaderActions}
        store={sequenceEditorStore}
      />
      <BackdropSpinner
        label={`Computing phylogenetic tree`}
        open={loadingStatus === LOADING_STATUS.LOADING}
      />
    </PageCommon>
  );
};
