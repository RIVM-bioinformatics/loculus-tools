import { useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
} from '@mui/material';
import MergeTypeIcon from '@mui/icons-material/MergeType';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useStore } from 'zustand';

import { PIPELINE_STATUS } from '../../../models/pipeline.models';
import { recordMergerStore } from '../../../stores/recordMergerStore';
import { PipelineParameterFields } from '../PipelineParameterFields';
import { StatusChip } from '../StatusChip';

export const RecordMergerPageDrawerPipelineSettings = () => {
  const alignmentResult = useStore(recordMergerStore, (state) => state.alignmentResult);
  const consensusResult = useStore(recordMergerStore, (state) => state.consensusResult);
  const pipelineStatus = useStore(recordMergerStore, (state) => state.pipelineStatus);
  const pipelineError = useStore(recordMergerStore, (state) => state.pipelineError);
  const selectedSequenceIds = useStore(recordMergerStore, (state) => state.selectedSequenceIds);
  const parsedReferenceFasta = useStore(recordMergerStore, (state) => state.parsedReferenceFasta);
  const runAlignment = useStore(recordMergerStore, (state) => state.runAlignment);
  const runConsensus = useStore(recordMergerStore, (state) => state.runConsensus);

  const isRunning =
    pipelineStatus === PIPELINE_STATUS.ALIGNING ||
    pipelineStatus === PIPELINE_STATUS.SORTING_INDEXING ||
    pipelineStatus === PIPELINE_STATUS.CALLING_CONSENSUS;

  const canAlign = selectedSequenceIds.length > 0 && Boolean(parsedReferenceFasta?.sequences?.length);
  const canCallConsensus = Boolean(alignmentResult);

  const onClickRunAlignment = useCallback(async () => {
    await runAlignment();
  }, [runAlignment]);

  const onClickRunConsensus = useCallback(async () => {
    await runConsensus();
  }, [runConsensus]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <PipelineParameterFields layout={'column'} />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Button
          color={'primary'}
          disabled={!canAlign || isRunning}
          fullWidth
          onClick={onClickRunAlignment}
          startIcon={isRunning ? (
            <CircularProgress
              color={'inherit'}
              size={18}
            />
          ) : <PlayArrowIcon />}
          sx={{ py: 0.9 }}
          variant={'contained'}
        >
          {alignmentResult ? 'Re-run Alignment' : 'Run Alignment'}
        </Button>
        <Button
          color={'secondary'}
          disabled={!canCallConsensus || isRunning}
          fullWidth
          onClick={onClickRunConsensus}
          startIcon={<MergeTypeIcon />}
          sx={{ py: 0.9 }}
          variant={'outlined'}
        >
          {'Call Consensus'}
        </Button>
      </Box>
      {pipelineStatus === PIPELINE_STATUS.ERROR && pipelineError && (
        <Alert severity={'error'}>
          {pipelineError}
        </Alert>
      )}
      {alignmentResult && (
        <StatusChip
          hasWarning={alignmentResult.executionTimeMs > 10000}
          label={`Aligned ${alignmentResult.selectedIds.length} records in ${alignmentResult.executionTimeMs} ms`}
        />
      )}
      {consensusResult && (
        <StatusChip
          hasWarning={consensusResult.executionTimeMs > 10000}
          label={`Consensus called in ${consensusResult.executionTimeMs} ms`}
        />
      )}
    </Box>
  );
};
