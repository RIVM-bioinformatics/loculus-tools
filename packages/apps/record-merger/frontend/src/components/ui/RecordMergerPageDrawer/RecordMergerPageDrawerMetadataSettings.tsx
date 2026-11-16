import {
  useCallback,
  useMemo,
} from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { useStore } from 'zustand';

import { recordMergerStore } from '../../../stores/recordMergerStore';
import { StatusChip } from '../StatusChip';

export const RecordMergerPageDrawerMetadataSettings = () => {
  const parsedMetadata = useStore(recordMergerStore, (state) => state.parsedMetadata);
  const parsedFasta = useStore(recordMergerStore, (state) => state.parsedFasta);
  const matchKeyField = useStore(recordMergerStore, (state) => state.matchKeyField);
  const columnMatchCounts = useStore(recordMergerStore, (state) => state.columnMatchCounts);
  const setMatchKeyField = useStore(recordMergerStore, (state) => state.setMatchKeyField);

  const totalSequences = parsedFasta?.sequences?.length ?? 0;

  const sortedColumns = useMemo(() => {
    const columns = parsedMetadata?.columns ?? [];
    return [...columns].sort((a, b) => {
      const countA = columnMatchCounts[a] ?? 0;
      const countB = columnMatchCounts[b] ?? 0;
      if (countA !== countB) {
        return countB - countA;
      }
      return a.localeCompare(b);
    });
  }, [columnMatchCounts, parsedMetadata?.columns]);

  const onChangeMatchKey = useCallback((event: SelectChangeEvent) => {
    const value = event.target.value;
    setMatchKeyField(value || null);
  }, [setMatchKeyField]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <FormControl
        fullWidth
        size={'small'}
      >
        <InputLabel id={'match-key-select-label'}>
          {'Sequence ID matching column'}
        </InputLabel>
        <Select
          label={'Sequence ID matching column'}
          labelId={'match-key-select-label'}
          onChange={onChangeMatchKey}
          value={matchKeyField ?? ''}
        >
          {sortedColumns.map((col) => {
            const matches = columnMatchCounts[col] ?? 0;
            return (
              <MenuItem
                key={col}
                value={col}
              >
                {totalSequences > 0 ? `${col} (${matches}/${totalSequences})` : col}
              </MenuItem>
            );
          })}
        </Select>
      </FormControl>
      {matchKeyField && totalSequences > 0 && columnMatchCounts[matchKeyField] !== undefined && (
        <StatusChip
          hasWarning={columnMatchCounts[matchKeyField] === 0}
          label={`${columnMatchCounts[matchKeyField]}/${totalSequences} sequences matched`}
        />
      )}
    </Box>
  );
};
