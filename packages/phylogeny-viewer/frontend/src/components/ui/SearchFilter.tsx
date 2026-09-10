import type { ChangeEvent } from 'react';
import {
  useCallback,
  useMemo,
} from 'react';
import {
  Box,
  Chip,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { useStore } from 'zustand';

import { datasetStore } from '../../stores/datasetStore';
import { metadataStore } from '../../stores/metadataStore';
import { treeViewStore } from '../../stores/treeViewStore';


export const SearchFilter = () => {
  const searchQuery = useStore(treeViewStore, (state) => state.searchQuery);
  const setSearchQuery = useStore(treeViewStore, (state) => state.setSearchQuery);
  const highlightedIds = useStore(treeViewStore, (state) => state.highlightedIds);

  const parsedFasta = useStore(datasetStore, (state) => state.parsedFasta);
  const parsedMetadata = useStore(datasetStore, (state) => state.parsedMetadata);
  const matchKeyColumn = useStore(metadataStore, (state) => state.matchKeyColumn);

  const allSequenceIds = useMemo(
    () => (parsedFasta?.sequences ?? []).map((sequence) => sequence.id),
    [parsedFasta],
  );
  const metadataRecords = useMemo(() => parsedMetadata?.records ?? [], [parsedMetadata]);

  const onChangeQuery = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value, allSequenceIds, metadataRecords, matchKeyColumn);
  }, [allSequenceIds, matchKeyColumn, metadataRecords, setSearchQuery]);

  const onClickClear = useCallback(() => {
    setSearchQuery('', allSequenceIds, metadataRecords, matchKeyColumn);
  }, [allSequenceIds, matchKeyColumn, metadataRecords, setSearchQuery]);

  return (
    <Box
      sx={{
        display: 'grid',
        gap: 1,
        gridTemplateColumns: searchQuery ? 'auto max-content' : 'auto',
      }}
    >
      <TextField
        label={'Search'}
        onChange={onChangeQuery}
        placeholder={'Metadata search query...'}
        size={'small'}
        slotProps={{
          input: {
            endAdornment: searchQuery ? (
              <InputAdornment position={'end'}>
                <IconButton
                  onClick={onClickClear}
                  size={'small'}
                >
                  <ClearIcon fontSize={'small'} />
                </IconButton>
              </InputAdornment>
            ) : null,
            startAdornment: (
              <InputAdornment position={'start'}>
                <SearchIcon
                  color={'action'}
                  fontSize={'small'}
                />
              </InputAdornment>
            ),
          },
        }}
        value={searchQuery}
        variant={'filled'}
      />
      {searchQuery && (
        <Box sx={{ alignItems: 'center', display: 'flex', gap: 1, justifyContent: 'space-between', padding: 1 }}>
          <Typography
            color={'text.secondary'}
            variant={'caption'}
          >
            {'Matches found'}
          </Typography>
          <Chip
            color={highlightedIds.length > 0 ? 'error' : 'default'}
            label={`${highlightedIds.length} node${highlightedIds.length === 1 ? '' : 's'}`}
            size={'small'}
          />
        </Box>
      )}
    </Box>
  );
};
