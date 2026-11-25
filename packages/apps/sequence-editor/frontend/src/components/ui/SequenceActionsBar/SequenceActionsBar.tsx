import {
  Box,
  Divider,
  IconButton,
  styled,
  Tooltip,
} from '@mui/material';
import { useCallback } from 'react';

import TranslateIcon from '../../../assets/icons/TranslateIcon.svg?react';

type IconButtonWithActiveStateProps = {
  active?: boolean;
};

const IconButtonWithActiveState = styled(IconButton, {
  name: 'IconButtonWithActiveState',
  shouldForwardProp: (prop) => prop !== 'active',
  slot: 'Root',
})<IconButtonWithActiveStateProps>(({ active, theme }) => ({
  ...(active && {
    border: `1px dashed ${theme.palette.primary.main}`,
    boxShadow: `inset 0 0 3px ${theme.palette.primary.main}`,
  }),
}));

export const SequenceActionsBar = () => {
  const onTranslateIconClick = useCallback(() => {
    // Handle translate icon click
  }, []);

  return (
    <Box
      sx={{
        alignItems: 'center',
        display: 'flex',
        gap: 1,
        marginX: 1,
      }}
    >
      <Tooltip title={'Translates nucleotide sequence to Amino Acids'}>
        <IconButtonWithActiveState
          active
          aria-label={'Translates nucleotide sequence to Amino Acids'}
          color={'primary'}
          onClick={onTranslateIconClick}
          size={'small'}
        >
          <TranslateIcon />
        </IconButtonWithActiveState>
      </Tooltip>
      <Divider
        flexItem
        orientation={'vertical'}
        variant={'middle'}
      />
    </Box>
  );
};
