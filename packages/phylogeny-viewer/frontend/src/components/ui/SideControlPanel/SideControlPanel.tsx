import {
  useCallback,
  useState,
} from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Drawer,
  IconButton,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import CalculateOutlinedIcon from '@mui/icons-material/CalculateOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';

import { DRAWER_WIDTH } from '../../../constants/view';
import { EventBusService } from '../../../classes/services/EventBusService';

import { SideControlPanelCalculationSettings } from './SideControlPanelCalculationSettings';
import { SideControlPanelViewSettings } from './SideControlPanelViewSettings';
import { SideControlPanelMetadataStyling } from './SideControlPanelMetadataStyling';

enum ACCORDIONS {
  CALCULATION = 'CALCULATION',
  METADATA = 'METADATA',
  VIEW = 'VIEW',
}

export type SideControlPanelProps = {
  drawerOpen: boolean;
};

export const SideControlPanel = ({ drawerOpen }: SideControlPanelProps) => {
  const [expandedAccordions, setExpandedAccordions] = useState<string[]>([]);

  const toggleAccordion = useCallback((panel: string) => {
    setExpandedAccordions((prev) =>
      prev.includes(panel) ? prev.filter((p) => p !== panel) : [...prev, panel]);
  }, []);

  const onClickCloseDrawer = useCallback(() => EventBusService.getInstance().emit('onToggleDrawer', false), []);
  const onClickLoadData = useCallback(() => EventBusService.getInstance().emit('onShowImportDialog'), []);
  const onCalculationAccordionChange = useCallback(() => toggleAccordion(ACCORDIONS.CALCULATION), [toggleAccordion]);
  const onViewAccordionChange = useCallback(() => toggleAccordion(ACCORDIONS.VIEW), [toggleAccordion]);
  const onMetaDataAccordionChange = useCallback(() => toggleAccordion(ACCORDIONS.METADATA), [toggleAccordion]);

  return (
    <Drawer
      anchor={'left'}
      open={drawerOpen}
      sx={{
        '& .MuiDrawer-paper': {
          backgroundColor: '#FFFFFF',
          borderColor: 'divider',
          borderRight: '1px solid',
          boxSizing: 'border-box',
          height: 'calc(100% - 56px)',
          overflowY: 'auto',
          top: '56px',
          width: DRAWER_WIDTH,
        },
        flexShrink: 0,
        width: drawerOpen ? DRAWER_WIDTH : 0,
      }}
      variant={'persistent'}
    >
      {/* Header with Close and Data Load trigger */}
      <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 1.5, p: 2 }}>
        <Box sx={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
          <Typography
            color={'text.primary'}
            sx={{ fontWeight: 700 }}
            variant={'subtitle1'}
          >
            {'Tree Controls'}
          </Typography>
          <IconButton
            onClick={onClickCloseDrawer}
            size={'small'}
            title={'Collapse Side Panel'}
          >
            <ChevronLeftIcon />
          </IconButton>
        </Box>
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
            <SideControlPanelCalculationSettings />
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
            <SideControlPanelViewSettings />
          </AccordionDetails>
        </Accordion>
        {/* 3. Metadata & Styling */}
        <Accordion
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
            <SideControlPanelMetadataStyling />
          </AccordionDetails>
        </Accordion>
      </Box>
    </Drawer>
  );
};
