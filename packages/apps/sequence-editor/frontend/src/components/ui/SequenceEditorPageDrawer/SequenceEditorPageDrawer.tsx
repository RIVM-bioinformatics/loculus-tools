import {
  useCallback,
  useEffect,
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
import InvertColorsIcon from '@mui/icons-material/InvertColors';
import { useStore } from 'zustand';
import { PageCommonDrawer } from '@rivm-loculus-tools/frontend-common/components/page';

import { sequenceEditorStore } from '../../../stores/sequenceEditorStore';

enum ACCORDIONS {
  AMINO_ACID_COLORS = 'AMINO_ACID_COLORS',
  COLORS = 'COLORS',
  METADATA = 'METADATA',
}

export const SequenceEditorPageDrawer = () => {
  const parsedMetadata = useStore(sequenceEditorStore, (state) => state.parsedMetadata);
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
  const onAminoAcidColorsAccordionChange = useCallback(() => toggleAccordion(ACCORDIONS.AMINO_ACID_COLORS), [toggleAccordion]);
  const onMetaDataAccordionChange = useCallback(() => toggleAccordion(ACCORDIONS.METADATA), [toggleAccordion]);

  useEffect(() => {
    if (!parsedMetadata) {
      collapseAccordion(ACCORDIONS.METADATA);
    }
  }, [collapseAccordion, parsedMetadata]);


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
      {/* Accordions */}
      <Box sx={{ pb: 3 }}>
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
            {'Colors'}
          </AccordionDetails>
        </Accordion>
        <Accordion
          disableGutters
          elevation={0}
          expanded={expandedAccordions.includes(ACCORDIONS.AMINO_ACID_COLORS)}
          onChange={onAminoAcidColorsAccordionChange}
          sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
              <InvertColorsIcon
                color={'primary'}
                fontSize={'small'}
              />
              <Typography
                sx={{ fontWeight: 600 }}
                variant={'body2'}
              >
                {'Amino-acid colors'}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pb: 2, pt: 0, px: 2 }}>
            {'Amino-acid colors'}
          </AccordionDetails>
        </Accordion>
        {/* 3. Metadata & Styling */}
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
