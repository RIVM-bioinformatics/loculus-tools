import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  Typography,
} from '@mui/material';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { useCallback } from 'react';
import { useStore } from 'zustand';
import { container } from 'tsyringe';

import { sequenceEditorStore } from '../../../stores/sequenceEditorStore';
import { SequenceEditorEventBusService } from '../../../classes/services/SequenceEditorEventBusService';

export const SequenceEditorRealignModal = () => {
  const isRealigning = useStore(sequenceEditorStore, (state) => state.isRealigning);

  const onCancelClick = useCallback(() => {
    container.resolve(SequenceEditorEventBusService).emit('onCancelRealign');
  }, []);

  return (
    <Dialog
      aria-labelledby={'sequence-editor-realign-title'}
      aria-modal={'true'}
      open={isRealigning}
      slotProps={{
        backdrop: {
          sx: {
            backdropFilter: 'blur(2px)',
          },
        },
      }}
    >
      <DialogContent
        sx={{
          alignItems: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          maxWidth: 480,
          p: 3,
          textAlign: 'center',
        }}
      >
        <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
          <AutoFixHighIcon color={'primary'} />
          <Typography
            id={'sequence-editor-realign-title'}
            variant={'h6'}
          >
            {'Sequence Re-alignment'}
          </Typography>
        </Box>
        <CircularProgress
          color={'primary'}
          size={36}
        />
        <Typography
          color={'text.secondary'}
          variant={'body2'}
        >
          {'Sequence (re-)alignment in progress using MAFFT (progressive alignment with FFT-NS-1). This may take a while depending on the amount of sequences.'}
        </Typography>
        <Button
          color={'primary'}
          onClick={onCancelClick}
          sx={{ mt: 1 }}
          variant={'outlined'}
        >
          {'Cancel'}
        </Button>
      </DialogContent>
    </Dialog>
  );
};
