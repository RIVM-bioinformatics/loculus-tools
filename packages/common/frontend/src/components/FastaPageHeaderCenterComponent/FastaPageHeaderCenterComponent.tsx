import {
  Box,
  Chip,
} from '@mui/material';
import type { StoreApi } from 'zustand';
import { useStore } from 'zustand';

import type { FastaDataStore } from '../../stores/fastaDataStore';


export type FastaPageHeaderCenterComponentProps = {
  store: StoreApi<FastaDataStore>;
};

export const FastaPageHeaderCenterComponent = ({ store }: FastaPageHeaderCenterComponentProps) => {
  const parsedFasta = useStore(store, (state) => state.parsedFasta);
  const parsedMetadata = useStore(store, (state) => state.parsedMetadata);

  const seqCount = parsedFasta?.sequences?.length || 0;
  const metaCount = parsedMetadata?.records?.length || 0;

  return (
    <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
      {seqCount > 0 && (
        <Chip
          label={`${seqCount} Sequences`}
          size={'small'}
          sx={{
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            color: '#FFFFFF',
            fontSize: '0.75rem',
            fontWeight: 600,
          }}
        />
      )}
      {metaCount > 0 && (
        <Chip
          label={`${metaCount} Metadata Records`}
          size={'small'}
          sx={{
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            color: '#FFFFFF',
            fontSize: '0.75rem',
            fontWeight: 600,
          }}
        />
      )}
    </Box>
  );
};
