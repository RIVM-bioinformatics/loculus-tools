import type {
  ChangeEvent,
  KeyboardEvent,
} from 'react';
import {
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {
  Box,
  FilledInput,
  IconButton,
  InputAdornment,
  styled,
  useTheme,
  useThemeProps,
} from '@mui/material';
import type {
  ComponentsOverrides,
  Theme,
} from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CloseIcon from '@mui/icons-material/Close';

export type SearchBarProps = {
  allowNavigation?: boolean;
  highlightedIndex?: null | number;
  numResults?: number;
  onHighlightedIndexChange?: (index: number) => void;
  onSearchQueryChange: (query: string) => void;
  searchQuery: string;
  truncated?: boolean;
};

export interface SearchBarTheme {
  buttonColor: string;
  styleOverrides?: ComponentsOverrides<Theme>['MuiFilledInput'];
}

const SearchBarFilledInput = styled(FilledInput, {
  name: 'RivmLoculusToolsCommonFrontendSearchBar',
  slot: 'Root',
})(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  height: theme.spacing(4),
}));

export const SearchBar = (inProps: SearchBarProps) => {
  const {
    allowNavigation,
    highlightedIndex,
    numResults = 0,
    onHighlightedIndexChange,
    onSearchQueryChange,
    searchQuery,
    truncated,
  } = useThemeProps({ name: 'RivmLoculusToolsCommonFrontendSearchBar', props: inProps });
  const theme = useTheme();
  const searchBarTheme = useMemo<SearchBarTheme>(() => ({
    ...{
      buttonColor: theme.palette.primary.main,
    } satisfies SearchBarTheme,
    ...(theme.components?.RivmLoculusToolsCommonFrontendSearchBar ?? {}),
  }), [theme]);


  const inputRef = useRef<HTMLInputElement>(null);
  const arrowUpButtonRef = useRef<HTMLButtonElement>(null);
  const arrowDownButtonRef = useRef<HTMLButtonElement>(null);

  const onTextInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const nextSearchText = event.target.value;
    onSearchQueryChange(nextSearchText);
  }, [onSearchQueryChange]);

  const onClearButtonClick = useCallback(() => {
    onSearchQueryChange('');
    inputRef.current?.focus();
  }, [onSearchQueryChange]);

  const onTextInputKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    // on enter press, highlight the first result and focus the down arrow button
    if (event.key === 'Enter') {
      if (!numResults) {
        return;
      }
      event.preventDefault();
      onHighlightedIndexChange?.(0);
      arrowDownButtonRef.current?.focus();
    }
  }, [numResults, onHighlightedIndexChange]);

  const onUpArrowButtonClick = useCallback(() => {
    // goto previous result
    if (!numResults) {
      return;
    }
    const newHighlightedIndex = highlightedIndex === null || highlightedIndex === undefined || Number.isNaN(highlightedIndex) || highlightedIndex <= 0 ? numResults - 1 : highlightedIndex - 1;

    onHighlightedIndexChange?.(newHighlightedIndex);
  }, [numResults, highlightedIndex, onHighlightedIndexChange]);

  const onDownArrowButtonClick = useCallback(() => {
    // goto next result
    if (!numResults) {
      return;
    }
    const newHighlightedIndex = highlightedIndex === null || highlightedIndex === undefined || Number.isNaN(highlightedIndex) || highlightedIndex >= numResults - 1 ? 0 : highlightedIndex + 1;
    onHighlightedIndexChange?.(newHighlightedIndex);
  }, [numResults, highlightedIndex, onHighlightedIndexChange]);

  const onGenericKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>) => {
    // arrow right, focus the next focusable element
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      const nextFocusableElement = event.currentTarget.nextElementSibling as HTMLElement;
      if (nextFocusableElement) {
        nextFocusableElement.focus();
      }
    }
    // arrow left, focus the previous focusable element
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (event.target === arrowUpButtonRef.current) {
        inputRef.current?.focus();
        return;
      }
      const previousFocusableElement = event.currentTarget.previousElementSibling as HTMLElement;
      if (previousFocusableElement) {
        previousFocusableElement.focus();
      }
    }
  }, []);

  const searchResultStatusText = useMemo(() => {
    if (!searchQuery) {
      return '';
    }
    if (searchQuery && (Number.isNaN(numResults) || numResults <= 0)) {
      return 'No results';
    } else if (highlightedIndex === null || highlightedIndex === undefined || Number.isNaN(highlightedIndex) || highlightedIndex < 0 || !allowNavigation) {
      return `${numResults}${truncated ? '+' : ''} results`;
    } else if (allowNavigation) {
      return `${highlightedIndex + 1}/${numResults}${truncated ? '+' : ''} results`;
    }
    return '';
  }, [searchQuery, numResults, highlightedIndex, allowNavigation, truncated]);


  return (
    <SearchBarFilledInput
      endAdornment={(
        <InputAdornment position={'end'}>
          {searchResultStatusText && (
            <Box
              aria-atomic={'true'}
              aria-live={'polite'}
              role={'status'}
              sx={{
                fontSize: '1rem',
              }}
            >
              {searchResultStatusText}
            </Box>
          )}
          {numResults > 0 && allowNavigation && (
            <>
              <IconButton
                aria-label={'Goto previous search result'}
                disabled={!numResults}
                edge={'end'}
                onClick={onUpArrowButtonClick}
                onKeyDown={onGenericKeyDown}
                ref={arrowUpButtonRef}
                sx={{ color: searchBarTheme.buttonColor }}
              >
                <KeyboardArrowUpIcon />
              </IconButton>
              <IconButton
                aria-label={'Goto next search result'}
                disabled={!numResults}
                edge={'end'}
                onClick={onDownArrowButtonClick}
                onKeyDown={onGenericKeyDown}
                ref={arrowDownButtonRef}
                sx={{ color: searchBarTheme.buttonColor }}
              >
                <KeyboardArrowDownIcon />
              </IconButton>
            </>
          )}
          {searchQuery && (
            <IconButton
              aria-label={'Clear'}
              edge={'end'}
              onClick={onClearButtonClick}
              onKeyDown={onGenericKeyDown}
            >
              <CloseIcon />
            </IconButton>
          )}
        </InputAdornment>
      )}
      fullWidth
      inputRef={inputRef}
      name={'Search'}
      onChange={onTextInputChange}
      onKeyDown={onTextInputKeyDown}
      placeholder={'Search'}
      size={'small'}
      slotProps={{
        input: {
          'aria-label': 'Search',
          sx: {
            '&::-webkit-search-cancel-button': {
              display: 'none',
            },
            fontSize: '1rem',
            height: theme.spacing(4),
            outline: 'none !important',
            paddingBottom: '0 !important',
            paddingTop: '0 !important',
          },
        },
      }}
      startAdornment={(
        <InputAdornment position={'start'}>
          <SearchIcon fontSize={'small'} />
        </InputAdornment>
      )}
      type={'search'}
      value={searchQuery}
    />
  );
};
