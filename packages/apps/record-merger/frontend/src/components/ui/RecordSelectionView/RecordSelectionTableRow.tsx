import type { MouseEvent } from 'react';
import { useCallback } from 'react';
import {
  Checkbox,
  TableCell,
  TableRow,
  Typography,
} from '@mui/material';
import type { FastaSequence } from '@rivm-loculus-tools/common-frontend/models/fasta.models';
import type { MetadataRecord } from '@rivm-loculus-tools/common-frontend/models/metadata.models';

export type RecordSelectionTableRowProps = {
  isSelected: boolean;
  metadataColumns: string[];
  metadataRecord?: MetadataRecord;
  onToggle: (id: string) => void;
  sequence: FastaSequence;
};

export const RecordSelectionTableRow = ({
  isSelected,
  metadataColumns,
  metadataRecord,
  onToggle,
  sequence,
}: RecordSelectionTableRowProps) => {
  const onRowClick = useCallback(() => {
    onToggle(sequence.id);
  }, [onToggle, sequence.id]);

  const onCheckboxClick = useCallback((event: MouseEvent) => {
    event.stopPropagation();
  }, []);

  const onCheckboxChange = useCallback(() => {
    onToggle(sequence.id);
  }, [onToggle, sequence.id]);

  return (
    <TableRow
      hover
      onClick={onRowClick}
      selected={isSelected}
      sx={{ cursor: 'pointer' }}
    >
      <TableCell padding={'checkbox'}>
        <Checkbox
          checked={isSelected}
          onChange={onCheckboxChange}
          onClick={onCheckboxClick}
          size={'small'}
          slotProps={{ input: { 'aria-label': `Select ${sequence.id}` } }}
        />
      </TableCell>
      <TableCell>
        <Typography
          sx={{ fontFamily: 'monospace', fontWeight: 600 }}
          variant={'body2'}
        >
          {sequence.id}
        </Typography>
      </TableCell>
      <TableCell align={'right'}>
        <Typography
          sx={{ fontFamily: 'monospace' }}
          variant={'body2'}
        >
          {sequence.length.toLocaleString()}
        </Typography>
      </TableCell>
      <TableCell sx={{ maxWidth: 260 }}>
        <Typography
          color={'text.secondary'}
          noWrap
          title={sequence.header}
          variant={'caption'}
        >
          {sequence.header}
        </Typography>
      </TableCell>
      {metadataColumns.map((col) => (
        <TableCell key={col}>
          <Typography
            noWrap
            sx={{ maxWidth: 180 }}
            variant={'body2'}
          >
            {metadataRecord?.[col] || '—'}
          </Typography>
        </TableCell>
      ))}
    </TableRow>
  );
};
