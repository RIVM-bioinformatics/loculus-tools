import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import KeyboardOutlinedIcon from '@mui/icons-material/KeyboardOutlined';
import { useStore } from 'zustand';
import { PageCommonDrawer } from '@rivm-loculus-tools/common-frontend/components/ui/PageCommonDrawer';

import { sequenceEditorStore } from '../../../stores/sequenceEditorStore';
import {
  ALI_VIEW_CLUSTAL_X_AMINO_ACID_PALETTE,
  ALI_VIEW_DEFAULT_AMINO_ACID_PALETTE,
  ALI_VIEW_DEFAULT_NUCLEOTIDE_PALETTE,
  ALI_VIEW_FAST_NUCLEOTIDE_PALETTE,
  ALI_VIEW_SEA_VIEW_AMINO_ACID_PALETTE,
  ALI_VIEW_SEA_VIEW_NUCLEOTIDE_PALETTE,
  AMINO_ACID_SYMBOL_LABELS,
  AMINO_ACID_SYMBOLS,
  NUCLEOTIDE_SYMBOL_LABELS,
  NUCLEOTIDE_SYMBOLS,
} from '../../../constants';
import type {
  AminoAcidPalette,
  NucleotidePalette,
} from '../../../models/palette.models';
import { CUSTOM_PALETTE_NAME } from '../../../models/palette.models';
import { PaletteUtil } from '../../../utils/PaletteUtil';

import { SequenceEditorPageDrawerColorForm } from './SequenceEditorPageDrawerColorForm';
import { SequenceEditorPageDrawerKeyboardShortcuts } from './SequenceEditorPageDrawerKeyboardShortcuts';

enum ACCORDIONS {
  COLORS = 'COLORS',
  KEYBOARD_SHORTCUTS = 'KEYBOARD_SHORTCUTS',
  METADATA = 'METADATA',
}

export const SequenceEditorPageDrawer = () => {
  const parsedMetadata = useStore(sequenceEditorStore, (state) => state.parsedMetadata);
  const aminoAcidPalette = useStore(sequenceEditorStore, (state) => state.aminoAcidPalette);
  const customAminoAcidPalette = useStore(sequenceEditorStore, (state) => state.customAminoAcidPalette);
  const customNucleotidePalette = useStore(sequenceEditorStore, (state) => state.customNucleotidePalette);
  const nucleotidePalette = useStore(sequenceEditorStore, (state) => state.nucleotidePalette);
  const setAminoAcidPalette = useStore(sequenceEditorStore, (state) => state.setAminoAcidPalette);
  const setCustomAminoAcidPalette = useStore(sequenceEditorStore, (state) => state.setCustomAminoAcidPalette);
  const setCustomNucleotidePalette = useStore(sequenceEditorStore, (state) => state.setCustomNucleotidePalette);
  const setNucleotidePalette = useStore(sequenceEditorStore, (state) => state.setNucleotidePalette);
  const meta = useStore(sequenceEditorStore, (state) => state.meta);
  const [expandedAccordions, setExpandedAccordions] = useState<ACCORDIONS[]>([]);

  const toggleAccordion = useCallback((panel: ACCORDIONS) => {
    setExpandedAccordions((prev) =>
      prev.includes(panel) ? prev.filter((p) => p !== panel) : [...prev, panel]);
  }, []);

  const collapseAccordion = useCallback((panel: ACCORDIONS) => {
    setExpandedAccordions((prev) => prev.filter((p) => p !== panel));
  }, []);

  const onColorsAccordionChange = useCallback(() => toggleAccordion(ACCORDIONS.COLORS), [toggleAccordion]);
  const onMetaDataAccordionChange = useCallback(() => toggleAccordion(ACCORDIONS.METADATA), [toggleAccordion]);
  const onKeyboardShortcutsAccordionChange = useCallback(() => toggleAccordion(ACCORDIONS.KEYBOARD_SHORTCUTS), [toggleAccordion]);

  useEffect(() => {
    if (!parsedMetadata) {
      collapseAccordion(ACCORDIONS.METADATA);
    }
  }, [collapseAccordion, parsedMetadata]);

  const onNucleotidePaletteChange = useCallback((palette: NucleotidePalette) => {
    setNucleotidePalette(palette);
    if (palette.name === CUSTOM_PALETTE_NAME) {
      setCustomNucleotidePalette(palette);
    }
  }, [setCustomNucleotidePalette, setNucleotidePalette]);

  const onAminoAcidPaletteChange = useCallback((palette: AminoAcidPalette) => {
    setAminoAcidPalette(palette);
    if (palette.name === CUSTOM_PALETTE_NAME) {
      setCustomAminoAcidPalette(palette);
    }
  }, [setAminoAcidPalette, setCustomAminoAcidPalette]);

  const nucleotidePalettes = useMemo(() => {
    return [
      ALI_VIEW_DEFAULT_NUCLEOTIDE_PALETTE,
      ALI_VIEW_FAST_NUCLEOTIDE_PALETTE,
      ALI_VIEW_SEA_VIEW_NUCLEOTIDE_PALETTE,
    ];
  }, []);

  const aminoAcidPalettes = useMemo(() => {
    return [
      ALI_VIEW_DEFAULT_AMINO_ACID_PALETTE,
      ALI_VIEW_SEA_VIEW_AMINO_ACID_PALETTE,
      ALI_VIEW_CLUSTAL_X_AMINO_ACID_PALETTE,
    ];
  }, []);


  return (
    <PageCommonDrawer>
      {/* Header with Close and Data Load trigger */}
      <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 1.5, p: 2 }}>
        {meta && (
          <>
            <Typography
              sx={{ fontWeight: 600 }}
              variant={'body2'}
            >
              {'Alignment dimensions'}
            </Typography>
            <Typography
              sx={{ fontWeight: 400 }}
              variant={'body2'}
            >
              {`${meta.sequenceCount} sequences x ${meta.alignmentWidth} bases`}
            </Typography>
          </>
        )}
      </Box>
      <Box sx={{ pb: 3 }}>
        <Accordion
          disableGutters
          elevation={0}
          expanded={expandedAccordions.includes(ACCORDIONS.KEYBOARD_SHORTCUTS)}
          onChange={onKeyboardShortcutsAccordionChange}
          sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
              <KeyboardOutlinedIcon
                color={'primary'}
                fontSize={'small'}
              />
              <Typography
                sx={{ fontWeight: 600 }}
                variant={'body2'}
              >
                {'Keyboard shortcuts'}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            <SequenceEditorPageDrawerKeyboardShortcuts />
          </AccordionDetails>
        </Accordion>
        <Accordion
          disableGutters
          elevation={0}
          expanded={expandedAccordions.includes(ACCORDIONS.COLORS)}
          onChange={onColorsAccordionChange}
          sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
              <PaletteOutlinedIcon
                color={'primary'}
                fontSize={'small'}
              />
              <Typography
                sx={{ fontWeight: 600 }}
                variant={'body2'}
              >
                {'Colors'}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pb: 2, pt: 0, px: 2 }}>
            <SequenceEditorPageDrawerColorForm
              currentPalette={nucleotidePalette}
              customPalette={customNucleotidePalette}
              exportFileName={'nucleotide-palette.json'}
              label={'Nucleotide colors'}
              onPaletteChange={onNucleotidePaletteChange}
              palettes={nucleotidePalettes}
              parsePalette={PaletteUtil.parseNucleotidePalette}
              symbolLabels={NUCLEOTIDE_SYMBOL_LABELS}
              symbols={NUCLEOTIDE_SYMBOLS}
            />
            <SequenceEditorPageDrawerColorForm
              currentPalette={aminoAcidPalette}
              customPalette={customAminoAcidPalette}
              exportFileName={'amino-acid-palette.json'}
              label={'Amino-acid colors'}
              onPaletteChange={onAminoAcidPaletteChange}
              palettes={aminoAcidPalettes}
              parsePalette={PaletteUtil.parseAminoAcidPalette}
              symbolLabels={AMINO_ACID_SYMBOL_LABELS}
              symbols={AMINO_ACID_SYMBOLS}
            />
          </AccordionDetails>
        </Accordion>
        <Accordion
          disabled={!parsedMetadata}
          disableGutters
          elevation={0}
          expanded={expandedAccordions.includes(ACCORDIONS.METADATA)}
          onChange={onMetaDataAccordionChange}
          sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
              <TuneOutlinedIcon
                color={'primary'}
                fontSize={'small'}
              />
              <Typography
                sx={{ fontWeight: 600 }}
                variant={'body2'}
              >
                {'Metadata'}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pb: 2, pt: 0, px: 2 }}>
            {'Metadata'}
          </AccordionDetails>
        </Accordion>
      </Box>
    </PageCommonDrawer>
  );
};
