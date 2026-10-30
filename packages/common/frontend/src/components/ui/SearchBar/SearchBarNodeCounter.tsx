import type { ChipOwnProps } from '@mui/material';
import {
  Chip,
  useThemeProps,
} from '@mui/material';

export type SearchBarNodeCounterProps = {
  hasResultsChipColor?: ChipOwnProps['color'];
  noResultsChipColor?: ChipOwnProps['color'];
  numResults?: number;
};

// Theme type for the SearchBarNodeCounter component. Placeholder for future theme-specific properties.
export type SearchBarNodeCounterTheme = object;


export const SearchBarNodeCounter = (inProps: SearchBarNodeCounterProps) => {
  const {
    hasResultsChipColor = 'primary',
    noResultsChipColor = 'default',
    numResults,
  } = useThemeProps({ name: 'RivmLoculusToolsCommonFrontendSearchBarNodeCounter', props: inProps });
  if (numResults === undefined || Number.isNaN(numResults)) {
    return null;
  }

  return (
    <Chip
      color={numResults > 0 ? hasResultsChipColor : noResultsChipColor}
      label={`${numResults} node${numResults === 1 ? '' : 's'}`}
      size={'small'}
      sx={{
        margin: 0,
        padding: 0,
      }}
    />
  );
};
