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
    <Box>
      <TextField
        aria-label={'Search'}
        fullWidth
        label={(
          <Box sx={{ alignItems: 'center', display: 'flex' }}>
            <SearchIcon
              color={'primary'}
              sx={{ paddingLeft: 1 }}
            />
            <Box
              component={'span'}
              sx={{
                marginLeft: 1,
              }}
            >
              {'Search'}
            </Box>
          </Box>
        )}
        onChange={onChangeQuery}
        slotProps={{
          input: {
            disableUnderline: true,
            endAdornment: searchQuery ? (
              <>
                <InputAdornment position={'end'}>
                  <IconButton
                    onClick={onClickClear}
                    size={'small'}
                  >
                    <ClearIcon fontSize={'small'} />
                  </IconButton>
                  <SearchBarNodeCounter />
                </InputAdornment>
              </>
            ) : null,
          },
        }}
        value={searchQuery}
        variant={'filled'}
      />
    </Box>
  );
};
