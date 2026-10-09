import { Chip } from '@mui/material';

export type SearchBarNodeCounterProps = {
  numResults?: number;
};

export const SearchBarNodeCounter = ({ numResults }: SearchBarNodeCounterProps) => {
  if (isNaN(numResults)) {
    return null;
  }

  return (
    <Chip
      color={numResults > 0 ? 'primary' : 'default'}
      label={`${numResults} node${numResults === 1 ? '' : 's'}`}
      size={'small'}
      sx={{
        margin: 0,
        padding: 0,
      }}
    />
  );
};
