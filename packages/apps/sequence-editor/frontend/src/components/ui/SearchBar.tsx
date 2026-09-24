import type {
  ChangeEvent,
  KeyboardEvent,
  SyntheticEvent,
} from 'react';
import {
  useCallback,
  useState,
} from 'react';
import {
  Box,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ChevronLeftOutlinedIcon from '@mui/icons-material/ChevronLeftOutlined';
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import ClearOutlinedIcon from '@mui/icons-material/ClearOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';

import type { SearchResult } from '../../models';

interface SearchBarProps {
  currentHit: number;
  disabled: boolean;
  onNavigate: (change: number) => void;
  onSearch: (query: string, includeRecordNames: boolean) => Promise<null | SearchResult>;
  results: null | SearchResult;
}

export const SearchBar = ({
  currentHit,
  disabled,
  onNavigate,
  onSearch,
  results,
}: SearchBarProps) => {
  const [includeRecordNames, setIncludeRecordNames] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const submit = useCallback(async () => {
    setSearching(true);
    try {
      await onSearch(query, includeRecordNames);
    } finally {
      setSearching(false);
    }
  }, [includeRecordNames, onSearch, query]);

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void submit();
    }
  }, [submit]);

  const onChangeQuery = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  }, []);

  const onClear = useCallback(() => {
    setQuery('');
    void onSearch('', includeRecordNames);
  }, [includeRecordNames, onSearch]);

  const onSubmit = useCallback((event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  }, [submit]);

  const onClickSearch = useCallback(() => {
    void submit();
  }, [submit]);

  const onToggleRecordNames = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setIncludeRecordNames(event.target.checked);
  }, []);

  const onPrevious = useCallback(() => {
    onNavigate(-1);
  }, [onNavigate]);

  const onNext = useCallback(() => {
    onNavigate(1);
  }, [onNavigate]);

  const matchCount = results?.positions.length ?? 0;
  const hasResults = matchCount > 0;
  let resultLabel = 'No search';
  if (searching) {
    resultLabel = 'Searching...';
  } else if (hasResults) {
    resultLabel = `${currentHit + 1} / ${matchCount}${results?.truncated ? '+' : ''}`;
  } else if (query) {
    resultLabel = '0 matches';
  }

  return (
    <Box
      component={'form'}
      onSubmit={onSubmit}
      sx={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 1, width: '100%' }}
    >
      <TextField
        aria-label={'Search alignment'}
        disabled={disabled || searching}
        onChange={onChangeQuery}
        onKeyDown={onKeyDown}
        placeholder={'Search bases or record names'}
        size={'small'}
        slotProps={{
          input: {
            endAdornment: query && (
              <InputAdornment position={'end'}>
                <Tooltip title={'Clear search'}>
                  <IconButton
                    aria-label={'Clear search'}
                    edge={'end'}
                    onClick={onClear}
                    size={'small'}
                  >
                    <ClearOutlinedIcon fontSize={'small'} />
                  </IconButton>
                </Tooltip>
              </InputAdornment>
            ),
            startAdornment: (
              <InputAdornment position={'start'}>
                <SearchOutlinedIcon fontSize={'small'} />
              </InputAdornment>
            ),
          },
        }}
        sx={{ flex: '1 1 260px', minWidth: 180 }}
        value={query}
      />
      <Tooltip title={'Search'}>
        <span>
          <IconButton
            aria-label={'Search'}
            color={'primary'}
            disabled={disabled || searching}
            onClick={onClickSearch}
            type={'button'}
          >
            {searching ? <CircularProgress size={22} /> : <SearchOutlinedIcon />}
          </IconButton>
        </span>
      </Tooltip>
      <FormControlLabel
        control={(
          <Checkbox
            checked={includeRecordNames}
            disabled={disabled || searching}
            onChange={onToggleRecordNames}
            size={'small'}
          />
        )}
        label={'Names'}
        sx={{ mr: 0, whiteSpace: 'nowrap' }}
      />
      <Typography
        aria-live={'polite'}
        color={'text.secondary'}
        sx={{ minWidth: 60, textAlign: 'center' }}
        variant={'body2'}
      >
        {resultLabel}
      </Typography>
      <Tooltip title={'Previous match'}>
        <span>
          <IconButton
            aria-label={'Previous match'}
            disabled={disabled || searching || !hasResults}
            onClick={onPrevious}
            size={'small'}
          >
            <ChevronLeftOutlinedIcon />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={'Next match'}>
        <span>
          <IconButton
            aria-label={'Next match'}
            disabled={disabled || searching || !hasResults}
            onClick={onNext}
            size={'small'}
          >
            <ChevronRightOutlinedIcon />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
};
