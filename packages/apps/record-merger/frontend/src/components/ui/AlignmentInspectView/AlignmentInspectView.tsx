import { useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useStore } from 'zustand';
import { DownloadUtil } from '@gen-epix/ui-core/utils/DownloadUtil';

import type { AlignmentResult } from '../../../models/pipeline.models';
import { PIPELINE_STATUS } from '../../../models/pipeline.models';
import { recordMergerStore } from '../../../stores/recordMergerStore';
import { JBrowseAlignmentView } from '../JBrowseAlignmentView';
import { PipelineParameterFields } from '../PipelineParameterFields';

export type AlignmentInspectViewProps = {
  alignmentResult: AlignmentResult;
};

export const AlignmentInspectView = ({ alignmentResult }: AlignmentInspectViewProps) => {
  const pipelineStatus = useStore(recordMergerStore, (state) => state.pipelineStatus);
  const pipelineError = useStore(recordMergerStore, (state) => state.pipelineError);
  const setActiveStep = useStore(recordMergerStore, (state) => state.setActiveStep);
  const runAlignment = useStore(recordMergerStore, (state) => state.runAlignment);
  const runConsensus = useStore(recordMergerStore, (state) => state.runConsensus);

  const isRunning =
    pipelineStatus === PIPELINE_STATUS.ALIGNING ||
    pipelineStatus === PIPELINE_STATUS.SORTING_INDEXING ||
    pipelineStatus === PIPELINE_STATUS.CALLING_CONSENSUS;

  const onClickBackToSelection = useCallback(() => {
    setActiveStep('SELECT_RECORDS');
  }, [setActiveStep]);

  const onClickDownloadBam = useCallback(() => {
    DownloadUtil.createDownloadUrl(alignmentResult.bamBlobUrl, 'aligned.sorted.bam');
  }, [alignmentResult.bamBlobUrl]);

  const onClickRerunAlignment = useCallback(async () => {
    await runAlignment();
  }, [runAlignment]);

  const onClickRunConsensus = useCallback(async () => {
    await runConsensus();
  }, [runConsensus]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        height: '100%',
        overflow: 'auto',
        p: 2,
      }}
    >
      {/* Top Action & Alignment Summary Bar */}
      <Paper
        sx={{
          alignItems: { md: 'center', xs: 'flex-start' },
          borderRadius: 2,
          display: 'flex',
          flexDirection: { md: 'row', xs: 'column' },
          gap: 1.5,
          justifyContent: 'space-between',
          p: 2,
        }}
        variant={'outlined'}
      >
        <Box sx={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button
            onClick={onClickBackToSelection}
            size={'small'}
            startIcon={<ArrowBackIcon />}
            variant={'outlined'}
          >
            {'Back to Selection'}
          </Button>
          <Chip
            color={'primary'}
            label={`${alignmentResult.selectedIds.length} Records Aligned`}
            size={'small'}
          />
          <Chip
            label={`Reference: ${alignmentResult.referenceId} (${alignmentResult.referenceLength.toLocaleString()} bp)`}
            size={'small'}
            variant={'outlined'}
          />
          <Chip
            label={`Preset: ${alignmentResult.preset}`}
            size={'small'}
            variant={'outlined'}
          />
          <Chip
            label={`Aligned in ${alignmentResult.executionTimeMs} ms`}
            size={'small'}
            variant={'outlined'}
          />
        </Box>
        <Box sx={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button
            onClick={onClickDownloadBam}
            size={'small'}
            startIcon={<FileDownloadOutlinedIcon />}
            variant={'outlined'}
          >
            {'Download Sorted BAM'}
          </Button>
          <Button
            disabled={isRunning}
            onClick={onClickRerunAlignment}
            size={'small'}
            startIcon={<RefreshIcon />}
            variant={'outlined'}
          >
            {'Re-run Alignment'}
          </Button>
          <Button
            color={'primary'}
            disabled={isRunning}
            endIcon={isRunning ? (
              <CircularProgress
                color={'inherit'}
                size={16}
              />
            ) : <ArrowForwardIcon />}
            onClick={onClickRunConsensus}
            size={'small'}
            variant={'contained'}
          >
            {'Call Consensus & Review Merge'}
          </Button>
        </Box>
      </Paper>
      {pipelineStatus === PIPELINE_STATUS.ERROR && pipelineError && (
        <Alert severity={'error'}>
          {pipelineError}
        </Alert>
      )}
      {/* Consensus Parameters Preview / Tuning Strip */}
      <Paper
        sx={{
          borderRadius: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          p: 2,
        }}
        variant={'outlined'}
      >
        <Box sx={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
          <Typography
            sx={{ fontWeight: 700 }}
            variant={'subtitle2'}
          >
            {'Alignment & Consensus Parameters'}
          </Typography>
          <Typography
            color={'text.secondary'}
            variant={'caption'}
          >
            {'Inspect the read alignments below, adjust consensus calling options if needed, then proceed to review the merge.'}
          </Typography>
        </Box>
        <PipelineParameterFields layout={'row'} />
      </Paper>
      {/* Interactive JBrowse2 Linear Genome View */}
      <JBrowseAlignmentView alignmentResult={alignmentResult} />
    </Box>
  );
};
