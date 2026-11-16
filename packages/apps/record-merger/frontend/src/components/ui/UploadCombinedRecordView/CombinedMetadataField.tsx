import type { ChangeEvent } from 'react';
import { useCallback } from 'react';
import { TextField } from '@mui/material';

export type CombinedMetadataFieldProps = {
  column: string;
  onChangeValue: (column: string, value: string) => void;
  sourceValues: string[];
  value: string;
};

export const CombinedMetadataField = ({
  column,
  onChangeValue,
  sourceValues,
  value,
}: CombinedMetadataFieldProps) => {
  const onFieldChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    onChangeValue(column, event.target.value);
  }, [column, onChangeValue]);

  const helperText = sourceValues.length > 1
    ? `Source values: ${sourceValues.slice(0, 4).join(', ')}${sourceValues.length > 4 ? '...' : ''}`
    : undefined;

  return (
    <TextField
      fullWidth
      helperText={helperText}
      label={column}
      onChange={onFieldChange}
      size={'small'}
      value={value}
    />
  );
};
