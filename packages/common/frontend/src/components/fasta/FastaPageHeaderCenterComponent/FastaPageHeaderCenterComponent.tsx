import {
  Box,
  Chip,
  styled,
} from '@mui/material';
import type {
  ComponentsOverrides,
  Theme,
} from '@mui/material/styles';


export type FastaPageHeaderCenterComponentProps = {
  metaDataCount: number;
  sequenceCount: number;
};

export type FastaPageHeaderCenterComponentTheme = {
  styleOverrides?: ComponentsOverrides<Theme>['MuiChip'];
};

const FastaPageHeaderCenterChip = styled(Chip, {
  name: 'RivmLoculusToolsCommonFrontendFastaPageHeaderCenterComponent',
  slot: 'Root',
})({
  backgroundColor: 'rgba(255, 255, 255, 0.2)',
  color: '#FFFFFF',
  fontSize: '0.75rem',
  fontWeight: 600,
});

export const FastaPageHeaderCenterComponent = ({ metaDataCount, sequenceCount }: FastaPageHeaderCenterComponentProps) => {

  return (
    <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
      {sequenceCount > 0 && (
        <FastaPageHeaderCenterChip
          label={`${sequenceCount} Sequences`}
          size={'small'}
        />
      )}
      {metaDataCount > 0 && (
        <FastaPageHeaderCenterChip
          label={`${metaDataCount} Metadata Records`}
          size={'small'}
        />
      )}
    </Box>
  );
};
