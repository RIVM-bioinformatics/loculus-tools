import { useStore } from 'zustand';
import { FastaDataImportDialogLoader } from '@rivm-loculus-tools/common-frontend/components/fasta/FastaDataImportDialogLoader';
import { BackdropSpinner } from '@gen-epix/ui-core-components/components/BackdropSpinner';
import { FastaNotLoaded } from '@rivm-loculus-tools/common-frontend/components/fasta/FastaNotLoaded';
import BiotechOutlinedIcon from '@mui/icons-material/BiotechOutlined';
import { LOADING_STATUS } from '@rivm-loculus-tools/common-frontend/models/fasta.models';
import { PageCommon } from '@rivm-loculus-tools/common-frontend/components/ui/PageCommon';
import { useConfig } from '@rivm-loculus-tools/common-frontend/hooks/useConfig';

import { sequenceEditorStore } from '../../stores/sequenceEditorStore';
import { SequenceEditor } from '../../components/ui/SequenceEditor';
import type { SequenceEditorConfig } from '../../models/config.models';


export const SequenceEditorMainPage = () => {
  const config = useConfig<SequenceEditorConfig>();
  const loadingStatus = useStore(sequenceEditorStore, (state) => state.loadingStatus);
  const rawFasta = useStore(sequenceEditorStore, (state) => state.rawFasta);

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
        extraActions={config?.fastaImportExtraActions}
        store={sequenceEditorStore}
      />
      <BackdropSpinner
        label={`Computing phylogenetic tree`}
        open={loadingStatus === LOADING_STATUS.LOADING}
      />
    </PageCommon>
  );
};
