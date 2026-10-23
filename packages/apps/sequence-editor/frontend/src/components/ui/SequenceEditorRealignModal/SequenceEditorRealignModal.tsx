import {
  Backdrop,
  Box,
  Button,
  CircularProgress,
  Paper,
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
    <Backdrop
      open={isRealigning}
      sx={{
        backdropFilter: 'blur(2px)',
        zIndex: (t) => t.zIndex.drawer + 2,
      }}
    >
      <Paper
        elevation={8}
        sx={{
          alignItems: 'center',
          borderRadius: 2,
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
          <Typography variant={'h6'}>
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
      </Paper>
    </Backdrop>
  );
};
