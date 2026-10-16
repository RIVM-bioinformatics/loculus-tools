import { container } from 'tsyringe';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import { Button } from '@mui/material';
import { useCallback } from 'react';

import { FastaDataEventBusService } from '../../../classes/services/FastaDataEventBusService';

export const FastaPageHeaderImportButton = () => {
  const onImportDataButtonClick = useCallback(() => container.resolve(FastaDataEventBusService).emit('onShowImportDialog'), []);

  return (
    <Button
      color={'inherit'}
      onClick={onImportDataButtonClick}
      size={'small'}
      startIcon={<FileUploadOutlinedIcon />}
      sx={{
        '&:hover': {
          backgroundColor: 'rgba(255, 255, 255, 0.25)',
        },
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        color: '#FFFFFF',
      }}
      variant={'contained'}
    >
      {'Import Data'}
    </Button>
  );
};
