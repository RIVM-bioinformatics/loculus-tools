import type { ChangeEvent } from 'react';
import { useCallback } from 'react';
import {
  Box,
  Typography,
} from '@mui/material';

import type { PaletteEntry } from '../../models';

import { ColorInput } from './ColorInput';

interface ColorRowProps {
  entry: PaletteEntry;
  onChange: (symbol: string, field: keyof PaletteEntry, value: string) => void;
  symbol: string;
}

export const ColorRow = ({
  entry,
  onChange,
  symbol,
}: ColorRowProps) => {
  const onForegroundChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    onChange(symbol, 'foreground', event.target.value);
  }, [onChange, symbol]);

  const onBackgroundChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    onChange(symbol, 'background', event.target.value);
  }, [onChange, symbol]);

  return (
    <Box
      sx={{ alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', gap: 1, justifyContent: 'space-between', py: 0.75 }}
    >
      <Typography
        component={'span'}
        sx={{ fontFamily: 'monospace', fontWeight: 700, minWidth: 20 }}
      >
        {symbol === '-' ? 'gap' : symbol}
      </Typography>
      <ColorInput
        label={'Foreground'}
        onChange={onForegroundChange}
        value={entry.foreground}
      />
      <ColorInput
        label={'Background'}
        onChange={onBackgroundChange}
        value={entry.background}
      />
    </Box>
  );
};
