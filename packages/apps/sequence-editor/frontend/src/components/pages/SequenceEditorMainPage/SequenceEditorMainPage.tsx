import { useStore } from 'zustand';
import {
  useCallback,
  useMemo,
} from 'react';
import { FastaDataEventBusService } from '@rivm-loculus-tools/frontend-common/classes/services/FastaDataEventBusService';
import { ErrorUtil } from '@rivm-loculus-tools/frontend-common/utils/ErrorUtil';
import { UrlUtil } from '@rivm-loculus-tools/frontend-common/utils/UrlUtil';
import type { DialogAction } from '@gen-epix/ui-core-components/components/Dialog';
import { FastaDataImportDialogLoader } from '@rivm-loculus-tools/frontend-common/components/FastaDataImportDialogLoader';
import { CALCULATION_STATUS } from '@rivm-loculus-tools/frontend-common/models/fasta';
import { BackdropSpinner } from '@gen-epix/ui-core-components/components/BackdropSpinner';
import { FastaNotLoaded } from '@rivm-loculus-tools/frontend-common/components/FastaNotLoaded';
import BiotechOutlinedIcon from '@mui/icons-material/BiotechOutlined';

import { sequenceEditorStore } from '../../../stores/sequenceEditorStore';
import { SequenceEditor } from '../../ui/SequenceEditor';
import { SequenceEditorPage } from '../../ui/SequenceEditorPage';


export const SequenceEditorMainPage = () => {
  const calculationStatus = useStore(sequenceEditorStore, (state) => state.calculationStatus);
  const setData = useStore(sequenceEditorStore, (state) => state.setData);
  const rawFasta = useStore(sequenceEditorStore, (state) => state.rawFasta);

  const onClickLoadDemoData = useCallback(async () => {
    try {
      const fastaRes = await fetch('/sample-data/sarscov2_demo.fasta');
      const demoFastaText = await fastaRes.text();

      await setData(demoFastaText);
      FastaDataEventBusService.getInstance().emit('onCloseImportDialog');
    } catch (err: unknown) {
      FastaDataEventBusService.getInstance().emit('onCloseImportDialog');
      const errorMessage = `Failed to load demo dataset: ${ErrorUtil.getErrorMessage(err, 'Unknown error')}`;
      FastaDataEventBusService.getInstance().emit('onShowImportDialog', errorMessage);
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
    <SequenceEditorPage
      isNoInteraction={false}
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
        open={calculationStatus === CALCULATION_STATUS.LOADING}
      />
    </SequenceEditorPage>
  );
};
