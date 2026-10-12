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
  Button,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CalculateOutlinedIcon from '@mui/icons-material/CalculateOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import { useStore } from 'zustand';
import { PageCommonDrawer } from '@rivm-loculus-tools/frontend-common/components/page';
import { FastaDataEventBusService } from '@rivm-loculus-tools/frontend-common/classes/services/FastaDataEventBusService';

import { phylogenyViewerStore } from '../../../stores/phylogenyViewerStore';

import { PhylogenyViewerPageDrawerCalculationSettings } from './PhylogenyViewerPageDrawerCalculationSettings';
import { PhylogenyViewerPageDrawerMetadataStyling } from './PhylogenyViewerPageDrawerMetadataStyling';
import { PhylogenyViewerPageDrawerViewSettings } from './PhylogenyViewerPageDrawerViewSettings';

enum ACCORDIONS {
  CALCULATION = 'CALCULATION',
  METADATA = 'METADATA',
  VIEW = 'VIEW',
}

export const PhylogenyViewerPageDrawer = () => {
  const parsedMetadata = useStore(phylogenyViewerStore, (state) => state.parsedMetadata);
  const [expandedAccordions, setExpandedAccordions] = useState<ACCORDIONS[]>([]);

  const toggleAccordion = useCallback((panel: ACCORDIONS) => {
    setExpandedAccordions((prev) =>
      prev.includes(panel) ? prev.filter((p) => p !== panel) : [...prev, panel]);
  }, []);

  const collapseAccordion = useCallback((panel: ACCORDIONS) => {
    setExpandedAccordions((prev) => prev.filter((p) => p !== panel));
  }, []);

  const onClickLoadData = useCallback(() => FastaDataEventBusService.getInstance().emit('onShowImportDialog'), []);
  const onCalculationAccordionChange = useCallback(() => toggleAccordion(ACCORDIONS.CALCULATION), [toggleAccordion]);
  const onViewAccordionChange = useCallback(() => toggleAccordion(ACCORDIONS.VIEW), [toggleAccordion]);
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
        <Button
          color={'primary'}
          fullWidth
          onClick={onClickLoadData}
          startIcon={<FileUploadOutlinedIcon />}
          sx={{ py: 0.75 }}
          variant={'outlined'}
        >
          {'Load / Replace Data'}
        </Button>
      </Box>
      {/* Accordions */}
      <Box sx={{ pb: 3 }}>
        {/* 1. Tree Calculation */}
        <Accordion
          disableGutters
          elevation={0}
          expanded={expandedAccordions.includes(ACCORDIONS.CALCULATION)}
          onChange={onCalculationAccordionChange}
          sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
              <CalculateOutlinedIcon
                color={'primary'}
                fontSize={'small'}
              />
              <Typography
                sx={{ fontWeight: 600 }}
                variant={'body2'}
              >
                {'Tree calculation'}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pb: 2, pt: 0, px: 2 }}>
            <PhylogenyViewerPageDrawerCalculationSettings />
          </AccordionDetails>
        </Accordion>
        {/* 2. View & Layout */}
        <Accordion
          disableGutters
          elevation={0}
          expanded={expandedAccordions.includes(ACCORDIONS.VIEW)}
          onChange={onViewAccordionChange}
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
                {'View settings'}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pb: 2, pt: 0, px: 2 }}>
            <PhylogenyViewerPageDrawerViewSettings />
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
              <PaletteOutlinedIcon
                color={'primary'}
                fontSize={'small'}
              />
              <Typography
                sx={{ fontWeight: 600 }}
                variant={'body2'}
              >
                {'Metadata & styling'}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pb: 2, pt: 0, px: 2 }}>
            <PhylogenyViewerPageDrawerMetadataStyling />
          </AccordionDetails>
        </Accordion>
      </Box>
    </PageCommonDrawer>
  );
};
