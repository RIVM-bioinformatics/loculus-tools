import type { ChangeEvent } from 'react';
import {
  Box,
  Typography,
} from '@mui/material';

interface ColorInputProps {
  label: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  value: string;
}

export const ColorInput = ({
  label,
  onChange,
  value,
}: ColorInputProps) => (
  <Box
    component={'label'}
    sx={{ alignItems: 'center', display: 'flex', gap: 0.75 }}
  >
    <Box
      aria-label={label}
      component={'input'}
      onChange={onChange}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        cursor: 'pointer',
        height: 28,
        p: 0.25,
        width: 40,
      }}
      type={'color'}
      value={value}
    />
    <Typography
      color={'text.secondary'}
      component={'span'}
      sx={{ fontSize: '0.72rem' }}
    >
      {label}
    </Typography>
  </Box>
);
