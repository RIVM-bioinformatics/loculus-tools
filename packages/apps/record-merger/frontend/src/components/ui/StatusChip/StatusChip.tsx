import {
  Box,
  Chip,
} from '@mui/material';

export type StatusChipProps = {
  hasWarning: boolean;
  label: string;
};

export const StatusChip = ({ hasWarning, label }: StatusChipProps) => {
  return (
    <Box sx={{ alignItems: 'center', display: 'flex', gap: 1, justifyContent: 'center' }}>
      <Chip
        color={hasWarning ? 'warning' : 'primary'}
        label={label}
        size={'small'}
        sx={{ fontSize: '0.7rem', height: 20 }}
        variant={'outlined'}
      />
    </Box>
  );
};
