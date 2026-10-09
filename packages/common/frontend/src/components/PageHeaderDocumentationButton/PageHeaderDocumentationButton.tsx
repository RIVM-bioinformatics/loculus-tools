import { useCallback } from 'react';
import {
  IconButton,
  Tooltip,
} from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutlineOutlined';

export const PageHeaderDocumentationButton = () => {
  const onDocumentationButtonClick = useCallback(() => {
    window.open('https://github.com/RIVM-bioinformatics/loculus-tools', '_blank');
  }, []);

  return (
    <Tooltip title={'Documentation & Specifications'}>
      <IconButton
        color={'inherit'}
        onClick={onDocumentationButtonClick}
        size={'small'}
        sx={{ opacity: 0.85 }}
      >
        <HelpOutlineIcon fontSize={'small'} />
      </IconButton>
    </Tooltip>
  );
};
