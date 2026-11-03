import {
  Box,
  Chip,
  styled,
} from '@mui/material';
import type {
  ComponentsOverrides,
  Theme,
} from '@mui/material/styles';
import type { StoreApi } from 'zustand';
import { useStore } from 'zustand';

import type { FastaDataStore } from '../../../stores/fastaDataStore';


export type FastaPageHeaderCenterComponentProps = {
  store: StoreApi<FastaDataStore>;
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

export const FastaPageHeaderCenterComponent = ({ store }: FastaPageHeaderCenterComponentProps) => {
  const parsedFasta = useStore(store, (state) => state.parsedFasta);
  const parsedMetadata = useStore(store, (state) => state.parsedMetadata);

  const seqCount = parsedFasta?.sequences?.length || 0;
  const metaCount = parsedMetadata?.records?.length || 0;

  return (
    <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
      {seqCount > 0 && (
        <FastaPageHeaderCenterChip
          label={`${seqCount} Sequences`}
          size={'small'}
        />
      )}
      {metaCount > 0 && (
        <FastaPageHeaderCenterChip
          label={`${metaCount} Metadata Records`}
          size={'small'}
        />
      )}
    </Box>
  );
};
