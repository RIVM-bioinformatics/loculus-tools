import { useMemo } from 'react';
import { Box } from '@mui/material';
import { BackdropSpinner } from '@gen-epix/ui-core-components/components/BackdropSpinner';
import MergeTypeOutlinedIcon from '@mui/icons-material/MergeTypeOutlined';
import { useStore } from 'zustand';
import { FastaNotLoaded } from '@rivm-loculus-tools/common-frontend/components/fasta/FastaNotLoaded';
import { PageCommon } from '@rivm-loculus-tools/common-frontend/components/ui/PageCommon';
import { useConfig } from '@rivm-loculus-tools/common-frontend/hooks/useConfig';
import { LOADING_STATUS } from '@rivm-loculus-tools/common-frontend/models/fasta.models';

import { AlignmentInspectView } from '../../components/ui/AlignmentInspectView';
import { MergeReviewView } from '../../components/ui/MergeReviewView';
import { RecordMergerImportDialogLoader } from '../../components/ui/RecordMergerImportDialogLoader';
import { RecordMergerWorkflowStepper } from '../../components/ui/RecordMergerWorkflowStepper';
import { RecordSelectionView } from '../../components/ui/RecordSelectionView';
import { UploadCombinedRecordView } from '../../components/ui/UploadCombinedRecordView';
import type { RecordMergerConfig } from '../../models/config.models';
import { PIPELINE_STATUS } from '../../models/pipeline.models';
import { recordMergerStore } from '../../stores/recordMergerStore';

export const RecordMergerPageMainPage = () => {
  const config = useConfig<RecordMergerConfig>();
  const parsedFasta = useStore(recordMergerStore, (state) => state.parsedFasta);
  const parsedReferenceFasta = useStore(recordMergerStore, (state) => state.parsedReferenceFasta);
  const activeStep = useStore(recordMergerStore, (state) => state.activeStep);
  const pipelineStatus = useStore(recordMergerStore, (state) => state.pipelineStatus);
  const alignmentResult = useStore(recordMergerStore, (state) => state.alignmentResult);
  const consensusResult = useStore(recordMergerStore, (state) => state.consensusResult);
  const loadingStatus = useStore(recordMergerStore, (state) => state.loadingStatus);

  const hasDataset =
    Boolean(parsedFasta?.sequences?.length) &&
    Boolean(parsedReferenceFasta?.sequences?.length);

  const isPipelineRunning =
    pipelineStatus === PIPELINE_STATUS.ALIGNING ||
    pipelineStatus === PIPELINE_STATUS.SORTING_INDEXING ||
    pipelineStatus === PIPELINE_STATUS.CALLING_CONSENSUS;

  const isLoading = isPipelineRunning || loadingStatus === LOADING_STATUS.LOADING;

  const spinnerLabel = useMemo(() => {
    if (loadingStatus === LOADING_STATUS.LOADING) {
      return 'Loading FASTA records and reference sequence...';
    }
    if (pipelineStatus === PIPELINE_STATUS.ALIGNING) {
      return 'Aligning selected records to reference (minimap2)...';
    }
    if (pipelineStatus === PIPELINE_STATUS.SORTING_INDEXING) {
      return 'Sorting and indexing alignment (samtools)...';
    }
    if (pipelineStatus === PIPELINE_STATUS.CALLING_CONSENSUS) {
      return 'Calling consensus sequence (samtools consensus)...';
    }
    return 'Processing...';
  }, [loadingStatus, pipelineStatus]);

  return (
    <PageCommon
      isNoInteraction={false}
      title={'Record Merger'}
    >
      {!hasDataset && (
        <FastaNotLoaded
          description={'Load one or more FASTA sequence files alongside a reference sequence to select records, inspect alignments in JBrowse2, review the consensus merge, and upload the combined record.'}
          icon={<MergeTypeOutlinedIcon sx={{ color: 'text.disabled', fontSize: 72 }} />}
          title={'No Records Loaded'}
        />
      )}
      {hasDataset && (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <RecordMergerWorkflowStepper />
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {activeStep === 'SELECT_RECORDS' && (
              <RecordSelectionView />
            )}
            {activeStep === 'INSPECT_ALIGNMENT' && alignmentResult && (
              <AlignmentInspectView alignmentResult={alignmentResult} />
            )}
            {activeStep === 'REVIEW_MERGE' && alignmentResult && consensusResult && (
              <MergeReviewView
                alignmentResult={alignmentResult}
                consensusResult={consensusResult}
              />
            )}
            {activeStep === 'UPLOAD_COMBINED' && consensusResult && (
              <UploadCombinedRecordView consensusResult={consensusResult} />
            )}
            {((activeStep === 'INSPECT_ALIGNMENT' && !alignmentResult) ||
              (activeStep === 'REVIEW_MERGE' && (!alignmentResult || !consensusResult)) ||
              (activeStep === 'UPLOAD_COMBINED' && !consensusResult)) && (
              <RecordSelectionView />
            )}
          </Box>
        </Box>
      )}
      <RecordMergerImportDialogLoader extraActions={config.fastaImportExtraActions} />
      <BackdropSpinner
        label={spinnerLabel}
        open={isLoading}
      />
    </PageCommon>
  );
};
