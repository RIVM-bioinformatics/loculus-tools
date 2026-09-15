import {
  Box,
  Button,
  Typography,
} from '@mui/material';
import ForestOutlinedIcon from '@mui/icons-material/ForestOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import { useCallback } from 'react';

import { EventBusService } from '../../../classes/services/EventBusService';

export const TreeNotLoaded = () => {
  const onClickLoadData = useCallback(() => {
    EventBusService.getInstance().emit('onShowImportDialog');
  }, []);

  return (
    <Box
      sx={{
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        height: '100%',
        justifyContent: 'center',
        p: 3,
        width: '100%',
      }}
    >
      <ForestOutlinedIcon sx={{ color: 'text.disabled', fontSize: 72 }} />
      <Typography
        color={'text.secondary'}
        sx={{ fontWeight: 600 }}
        variant={'h6'}
      >
        {'No Phylogenetic Tree Loaded'}
      </Typography>
      <Typography
        color={'text.secondary'}
        sx={{ maxWidth: 450, textAlign: 'center' }}
        variant={'body2'}
      >
        {'Load an aligned FASTA sequence file to automatically compute and render an interactive phylogenetic tree.'}
      </Typography>
      <Button
        color={'primary'}
        onClick={onClickLoadData}
        startIcon={<FileUploadOutlinedIcon />}
        sx={{ mt: 1 }}
        variant={'contained'}
      >
        {'Load Data'}
      </Button>
    </Box>
  );
};
