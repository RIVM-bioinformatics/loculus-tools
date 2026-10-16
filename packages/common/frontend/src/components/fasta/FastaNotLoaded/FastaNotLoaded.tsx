import {
  Box,
  Button,
  Typography,
} from '@mui/material';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import type { ReactNode } from 'react';
import { useCallback } from 'react';

import { FastaDataEventBusService } from '../../../classes/services/FastaDataEventBusService';

export type FastaNotLoadedProps = {
  description: ReactNode;
  icon: ReactNode;
  title: ReactNode;
};

export const FastaNotLoaded = ({ description, icon, title }: FastaNotLoadedProps) => {
  const onClickLoadData = useCallback(() => {
    FastaDataEventBusService.getInstance().emit('onShowImportDialog');
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
      {icon}
      <Typography
        color={'text.secondary'}
        sx={{ fontWeight: 600 }}
        variant={'h6'}
      >
        {title}
      </Typography>
      <Typography
        color={'text.secondary'}
        sx={{ maxWidth: 450, textAlign: 'center' }}
        variant={'body2'}
      >
        {description}
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
