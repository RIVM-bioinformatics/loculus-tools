import { container } from 'tsyringe';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import {
  Button,
  styled,
} from '@mui/material';
import type {
  ComponentsOverrides,
  Theme,
} from '@mui/material/styles';
import { useCallback } from 'react';

import { FastaDataEventBusService } from '../../../classes/services/FastaDataEventBusService';

export type FastaPageHeaderImportButtonTheme = {
  styleOverrides?: ComponentsOverrides<Theme>['MuiButton'];
};

const FastaPageHeaderImportButtonComponent = styled(Button, {
  name: 'RivmLoculusToolsCommonFrontendFastaPageHeaderImportButton',
  slot: 'Root',
})({
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  backgroundColor: 'rgba(255, 255, 255, 0.15)',
  color: '#FFFFFF',
});

export const FastaPageHeaderImportButton = () => {
  const onImportDataButtonClick = useCallback(() => container.resolve(FastaDataEventBusService).emit('onShowImportDialog'), []);

  return (
    <FastaPageHeaderImportButtonComponent
      color={'inherit'}
      onClick={onImportDataButtonClick}
      size={'small'}
      startIcon={<FileUploadOutlinedIcon />}
      variant={'contained'}
    >
      {'Import Data'}
    </FastaPageHeaderImportButtonComponent>
  );
};
