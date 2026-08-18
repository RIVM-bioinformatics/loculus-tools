import React from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { useTreeViewStore } from '../../stores/treeViewStore';
import { useDatasetStore } from '../../stores/datasetStore';
import { useMetadataStore } from '../../stores/metadataStore';

export const SearchFilter: React.FC = () => {
  const searchQuery = useTreeViewStore((state) => state.searchQuery);
  const setSearchQuery = useTreeViewStore((state) => state.setSearchQuery);
  const highlightedIds = useTreeViewStore((state) => state.highlightedIds);

  const parsedFasta = useDatasetStore((state) => state.parsedFasta);
  const parsedMetadata = useDatasetStore((state) => state.parsedMetadata);
  const matchKeyColumn = useMetadataStore((state) => state.matchKeyColumn);

  const allSequenceIds = (parsedFasta?.sequences || []).map((s) => s.id);
  const metadataRecords = parsedMetadata?.records || [];

  const handleQueryChange = (query: string) => {
    setSearchQuery(query, allSequenceIds, metadataRecords, matchKeyColumn);
  };

  const handleClear = () => {
    setSearchQuery('', allSequenceIds, metadataRecords, matchKeyColumn);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
        Search & Highlight Tree Nodes:
      </Typography>

      <TextField
        size="small"
        placeholder="Search accession, host, country..."
        value={searchQuery}
        onChange={(e) => handleQueryChange(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
            endAdornment: searchQuery ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={handleClear}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          },
        }}
      />

      {searchQuery && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            Matches found:
          </Typography>
          <Chip
            size="small"
            color={highlightedIds.length > 0 ? 'error' : 'default'}
            label={`${highlightedIds.length} node${highlightedIds.length === 1 ? '' : 's'}`}
          />
        </Box>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', mt: 0.5 }}>
        Matching leaves are highlighted with a prominent red outline on the canvas.
      </Typography>
    </Box>
  );
};
