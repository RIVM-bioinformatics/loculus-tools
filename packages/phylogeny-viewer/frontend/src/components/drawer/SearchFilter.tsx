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

import { useTreeViewStore } from '../../stores/treeViewStore';
import { useDatasetStore } from '../../stores/datasetStore';
import { useMetadataStore } from '../../stores/metadataStore';

export const SearchFilter = () => {
  const searchQuery = useTreeViewStore((state) => state.searchQuery);
  const setSearchQuery = useTreeViewStore((state) => state.setSearchQuery);
  const highlightedIds = useTreeViewStore((state) => state.highlightedIds);

  const parsedFasta = useDatasetStore((state) => state.parsedFasta);
  const parsedMetadata = useDatasetStore((state) => state.parsedMetadata);
  const matchKeyColumn = useMetadataStore((state) => state.matchKeyColumn);

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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography
        color={'text.secondary'}
        sx={{ fontWeight: 700 }}
        variant={'caption'}
      >
        {'Search & Highlight Tree Nodes:'}
      </Typography>
      <TextField
        onChange={onChangeQuery}
        placeholder={'Search accession, host, country...'}
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
      />
      {searchQuery && (
        <Box sx={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
          <Typography
            color={'text.secondary'}
            variant={'caption'}
          >
            {'Matches found:'}
          </Typography>
          <Chip
            color={highlightedIds.length > 0 ? 'error' : 'default'}
            label={`${highlightedIds.length} node${highlightedIds.length === 1 ? '' : 's'}`}
            size={'small'}
          />
        </Box>
      )}
      <Typography
        color={'text.secondary'}
        sx={{ fontStyle: 'italic', mt: 0.5 }}
        variant={'caption'}
      >
        {'Matching leaves are highlighted with a prominent red outline on the canvas.'}
      </Typography>
    </Box>
  );
};
