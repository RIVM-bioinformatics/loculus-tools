import { FastaPageHeaderCenterComponent } from '@rivm-loculus-tools/frontend-common/components/FastaPageHeaderCenterComponent';
import { FastaPageHeaderImportButton } from '@rivm-loculus-tools/frontend-common/components/FastaPageHeaderImportButton';
import { FastaPageHeaderResetButton } from '@rivm-loculus-tools/frontend-common/components/FastaPageHeaderResetButton';
import { PageCommonHeader } from '@rivm-loculus-tools/frontend-common/components/page';
import { PageHeaderDocumentationButton } from '@rivm-loculus-tools/frontend-common/components/PageHeaderDocumentationButton';
import { useCallback } from 'react';
import { useStore } from 'zustand';
import BiotechOutlinedIcon from '@mui/icons-material/BiotechOutlined';

import { sequenceEditorStore } from '../../../stores/sequenceEditorStore';

export const SequenceEditorPageHeader = () => {
  const resetDataset = useStore(sequenceEditorStore, (state) => state.resetDataset);

  const onReset = useCallback(() => {
    resetDataset();
  }, [resetDataset]);

  return (
    <PageCommonHeader
      centerComponent={<FastaPageHeaderCenterComponent store={sequenceEditorStore} />}
      icon={<BiotechOutlinedIcon sx={{ fontSize: 24 }} />}
      rightComponent={(
        <>
          <FastaPageHeaderImportButton />
          <FastaPageHeaderResetButton onReset={onReset} />
          <PageHeaderDocumentationButton />
        </>
      )}
      title={'Sequence Editor'}
    />
  );
};
