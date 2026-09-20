import type { ChangeEvent } from 'react';
import { useCallback } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreOutlinedIcon from '@mui/icons-material/ExpandMoreOutlined';
import RestartAltOutlinedIcon from '@mui/icons-material/RestartAltOutlined';

import {
  AMINO_ACID_SYMBOLS,
  NUCLEOTIDE_SYMBOLS,
  type AminoAcidSymbol,
  type NucleotideSymbol,
  type PaletteEntry,
  type PaletteModel,
} from '../../models';

interface ColorSettingsPanelProps {
  onChange: (palette: PaletteModel) => void;
  onReset: () => void;
  palette: PaletteModel;
}

const ColorInput = ({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  value: string;
}) => (
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

const ColorRow = ({
  entry,
  onChange,
  symbol,
}: {
  entry: PaletteEntry;
  onChange: (field: keyof PaletteEntry, value: string) => void;
  symbol: string;
}) => (
  <Box
    sx={{ alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', gap: 1, justifyContent: 'space-between', py: 0.75 }}
  >
    <Typography
      component={'span'}
      sx={{ fontFamily: 'monospace', fontWeight: 700, minWidth: 20 }}
    >
      {symbol}
    </Typography>
    <ColorInput
      label={'Foreground'}
      onChange={(event) => onChange('foreground', event.target.value)}
      value={entry.foreground}
    />
    <ColorInput
      label={'Background'}
      onChange={(event) => onChange('background', event.target.value)}
      value={entry.background}
    />
  </Box>
);

export const ColorSettingsPanel = ({
  onChange,
  onReset,
  palette,
}: ColorSettingsPanelProps) => {
  const updateNucleotide = useCallback((symbol: NucleotideSymbol, field: keyof PaletteEntry, value: string) => {
    onChange({
      ...palette,
      nucleotide: {
        ...palette.nucleotide,
        [symbol]: { ...palette.nucleotide[symbol], [field]: value },
      },
    });
  }, [onChange, palette]);

  const updateAminoAcid = useCallback((symbol: AminoAcidSymbol, field: keyof PaletteEntry, value: string) => {
    onChange({
      ...palette,
      aminoAcid: {
        ...palette.aminoAcid,
        [symbol]: { ...palette.aminoAcid[symbol], [field]: value },
      },
    });
  }, [onChange, palette]);

  return (
    <Stack spacing={1.5}>
      <Box>
        <Typography variant={'subtitle1'}>
          {'View / Colors'}
        </Typography>
        <Typography
          color={'text.secondary'}
          variant={'body2'}
        >
          {'AliView Default'}
        </Typography>
      </Box>
      <Stack>
        {NUCLEOTIDE_SYMBOLS.map((symbol) => (
          <ColorRow
            entry={palette.nucleotide[symbol]}
            key={symbol}
            onChange={(field, value) => updateNucleotide(symbol, field, value)}
            symbol={symbol === '-' ? 'gap' : symbol}
          />
        ))}
      </Stack>
      <Button
        onClick={onReset}
        startIcon={<RestartAltOutlinedIcon />}
        variant={'outlined'}
      >
        {'Reset to AliView Default'}
      </Button>
      <Divider />
      <Accordion disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreOutlinedIcon />}>
          <Typography variant={'subtitle2'}>
            {'Amino-acid colors (future display)'}
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 0 }}>
          {AMINO_ACID_SYMBOLS.map((symbol) => (
            <ColorRow
              entry={palette.aminoAcid[symbol]}
              key={symbol}
              onChange={(field, value) => updateAminoAcid(symbol, field, value)}
              symbol={symbol === '-' ? 'gap' : symbol}
            />
          ))}
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
};
