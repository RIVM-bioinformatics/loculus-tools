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

import { EventBusService } from '../../../classes/services/EventBusService';
import { uiStore } from '../../../stores/uiStore';

import { PhyloViewerPageDrawerCalculationSettings } from './PhyloViewerPageDrawerCalculationSettings';
import { PhyloViewerPageDrawerMetadataStyling } from './PhyloViewerPageDrawerMetadataStyling';
import { PhyloViewerPageDrawerViewSettings } from './PhyloViewerPageDrawerViewSettings';

enum ACCORDIONS {
  CALCULATION = 'CALCULATION',
  METADATA = 'METADATA',
  VIEW = 'VIEW',
}

export const PhyloViewerPageDrawer = () => {
  const parsedMetadata = useStore(uiStore, (state) => state.parsedMetadata);
  const [expandedAccordions, setExpandedAccordions] = useState<ACCORDIONS[]>([]);

  const toggleAccordion = useCallback((panel: ACCORDIONS) => {
    setExpandedAccordions((prev) =>
      prev.includes(panel) ? prev.filter((p) => p !== panel) : [...prev, panel]);
  }, []);

  const collapseAccordion = useCallback((panel: ACCORDIONS) => {
    setExpandedAccordions((prev) => prev.filter((p) => p !== panel));
  }, []);

  const onClickLoadData = useCallback(() => EventBusService.getInstance().emit('onShowImportDialog'), []);
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
            <PhyloViewerPageDrawerCalculationSettings />
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
            <PhyloViewerPageDrawerViewSettings />
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
            <PhyloViewerPageDrawerMetadataStyling />
          </AccordionDetails>
        </Accordion>
      </Box>
    </PageCommonDrawer>
  );
};
