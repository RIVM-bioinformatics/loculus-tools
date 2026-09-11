import type { ChangeEvent } from 'react';
import { useCallback } from 'react';
import {
  Box,
  IconButton,
  InputAdornment,
  TextField,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { useStore } from 'zustand';

import { uiStore } from '../../../stores/uiStore';

import { SearchBarNodeCounter } from './SearchBarNodeCounter';


export const SearchBar = () => {
  const searchQuery = useStore(uiStore, (state) => state.searchQuery);
  const setSearchQuery = useStore(uiStore, (state) => state.setSearchQuery);

  const onChangeQuery = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  }, [setSearchQuery]);

  const onClickClear = useCallback(() => {
    setSearchQuery('');
  }, [setSearchQuery]);

  return (
    <Box
      sx={{
        display: 'grid',
        gap: 1,
        gridTemplateColumns: searchQuery ? 'auto max-content' : 'auto',
      }}
    >
      <TextField
        aria-label={'Search'}
        onChange={onChangeQuery}
        placeholder={'Search'}
        size={'medium'}
        slotProps={{
          input: {
            endAdornment: searchQuery ? (
              <>
                <InputAdornment position={'end'}>
                  <IconButton
                    onClick={onClickClear}
                    size={'small'}
                  >
                    <ClearIcon fontSize={'small'} />
                  </IconButton>
                </InputAdornment>
                <SearchBarNodeCounter />
              </>
            ) : null,
            startAdornment: (
              <InputAdornment position={'start'}>
                <SearchIcon
                  color={'action'}
                  fontSize={'small'}
                  sx={{ marginLeft: 1 }}
                />
              </InputAdornment>
            ),
          },
        }}
        value={searchQuery}
        variant={'standard'}
      />
    </Box>
  );
};
