import {
  useCallback,
  useMemo,
} from 'react';
import {
  Box,
  Button,
  Paper,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useStore } from 'zustand';

import type { RecordMergerStep } from '../../../models/pipeline.models';
import { recordMergerStore } from '../../../stores/recordMergerStore';

type StepItem = {
  completed: boolean;
  disabled: boolean;
  id: RecordMergerStep;
  label: string;
};

export const RecordMergerWorkflowStepper = () => {
  const activeStep = useStore(recordMergerStore, (state) => state.activeStep);
  const alignmentResult = useStore(recordMergerStore, (state) => state.alignmentResult);
  const consensusResult = useStore(recordMergerStore, (state) => state.consensusResult);
  const setActiveStep = useStore(recordMergerStore, (state) => state.setActiveStep);

  const steps: StepItem[] = useMemo(() => [
    {
      completed: Boolean(alignmentResult),
      disabled: false,
      id: 'SELECT_RECORDS',
      label: '1. Select Records',
    },
    {
      completed: Boolean(consensusResult),
      disabled: !alignmentResult,
      id: 'INSPECT_ALIGNMENT',
      label: '2. Inspect Alignment',
    },
    {
      completed: false,
      disabled: !alignmentResult || !consensusResult,
      id: 'REVIEW_MERGE',
      label: '3. Review Merge',
    },
    {
      completed: false,
      disabled: !consensusResult,
      id: 'UPLOAD_COMBINED',
      label: '4. Upload Combined Record',
    },
  ], [alignmentResult, consensusResult]);

  const onSelectSelectRecords = useCallback(() => {
    setActiveStep('SELECT_RECORDS');
  }, [setActiveStep]);

  const onSelectInspectAlignment = useCallback(() => {
    setActiveStep('INSPECT_ALIGNMENT');
  }, [setActiveStep]);

  const onSelectReviewMerge = useCallback(() => {
    setActiveStep('REVIEW_MERGE');
  }, [setActiveStep]);

  const onSelectUploadCombined = useCallback(() => {
    setActiveStep('UPLOAD_COMBINED');
  }, [setActiveStep]);

  const clickHandlers: Record<RecordMergerStep, () => void> = useMemo(() => ({
    INSPECT_ALIGNMENT: onSelectInspectAlignment,
    REVIEW_MERGE: onSelectReviewMerge,
    SELECT_RECORDS: onSelectSelectRecords,
    UPLOAD_COMBINED: onSelectUploadCombined,
  }), [onSelectInspectAlignment, onSelectReviewMerge, onSelectSelectRecords, onSelectUploadCombined]);

  return (
    <Paper
      square
      sx={{
        alignItems: 'center',
        borderBottom: '1px solid',
        borderColor: 'divider',
        borderLeft: 0,
        borderRight: 0,
        borderTop: 0,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 0.75,
        px: 2,
        py: 1,
      }}
      variant={'outlined'}
    >
      {steps.map((step, index) => {
        const isActive = activeStep === step.id;
        return (
          <Box
            key={step.id}
            sx={{ alignItems: 'center', display: 'flex', gap: 0.75 }}
          >
            <Button
              color={isActive ? 'primary' : 'inherit'}
              disabled={step.disabled}
              onClick={clickHandlers[step.id]}
              size={'small'}
              startIcon={step.completed && !isActive ? (
                <CheckCircleIcon
                  color={'success'}
                  fontSize={'small'}
                />
              ) : undefined}
              sx={{
                fontWeight: isActive ? 700 : 500,
                textTransform: 'none',
              }}
              variant={isActive ? 'contained' : 'text'}
            >
              {step.label}
            </Button>
            {index < steps.length - 1 && (
              <ChevronRightIcon
                fontSize={'small'}
                sx={{ color: 'text.disabled' }}
              />
            )}
          </Box>
        );
      })}
    </Paper>
  );
};
