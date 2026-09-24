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
} from '../../models';
import type {
  AminoAcidSymbol,
  NucleotideSymbol,
  PaletteEntry,
  PaletteModel,
} from '../../models';

import { ColorRow } from './ColorRow';

interface ColorSettingsPanelProps {
  onChange: (palette: PaletteModel) => void;
  onReset: () => void;
  palette: PaletteModel;
}

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

  const onNucleotideChange = useCallback((symbol: string, field: keyof PaletteEntry, value: string) => {
    updateNucleotide(symbol as NucleotideSymbol, field, value);
  }, [updateNucleotide]);

  const onAminoAcidChange = useCallback((symbol: string, field: keyof PaletteEntry, value: string) => {
    updateAminoAcid(symbol as AminoAcidSymbol, field, value);
  }, [updateAminoAcid]);

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
            onChange={onNucleotideChange}
            symbol={symbol}
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
              onChange={onAminoAcidChange}
              symbol={symbol}
            />
          ))}
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
};
