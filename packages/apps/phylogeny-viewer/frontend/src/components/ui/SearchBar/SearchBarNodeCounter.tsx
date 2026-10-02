import { useStore } from 'zustand';
import { Chip } from '@mui/material';

import { phylogenyViewerStore } from '../../../stores/phylogenyViewerStore';

export const SearchBarNodeCounter = () => {
  const highlightedIds = useStore(phylogenyViewerStore, (state) => state.highlightedIds);

  return (
    <Chip
      color={highlightedIds.length > 0 ? 'primary' : 'default'}
      label={`${highlightedIds.length} node${highlightedIds.length === 1 ? '' : 's'}`}
      size={'small'}
      sx={{
        margin: 0,
        padding: 0,
      }}
    />
  );
};
