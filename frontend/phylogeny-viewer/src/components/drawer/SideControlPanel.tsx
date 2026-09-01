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
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';

import { useTreeViewStore } from '../../stores/treeViewStore';
import { DRAWER_WIDTH } from '../../constants/drawer';

import { CalculationSettings } from './CalculationSettings';
import { ViewSettings } from './ViewSettings';
import { MetadataStyling } from './MetadataStyling';
import { SearchFilter } from './SearchFilter';

export const SideControlPanel = () => {
  const drawerOpen = useTreeViewStore((state) => state.drawerOpen);
  const setDrawerOpen = useTreeViewStore((state) => state.setDrawerOpen);
  const setImportModalOpen = useTreeViewStore((state) => state.setImportModalOpen);

  const [expandedAccordions, setExpandedAccordions] = useState<string[]>([
    'calc',
    'view',
    'meta',
    'search',
  ]);

  const toggleAccordion = useCallback((panel: string) => {
    setExpandedAccordions((prev) =>
      prev.includes(panel) ? prev.filter((p) => p !== panel) : [...prev, panel]);
  }, []);

  const onClickCloseDrawer = useCallback(() => setDrawerOpen(false), [setDrawerOpen]);
  const onClickLoadData = useCallback(() => setImportModalOpen(true), [setImportModalOpen]);
  const onChangeCalculation = useCallback(() => toggleAccordion('calc'), [toggleAccordion]);
  const onChangeView = useCallback(() => toggleAccordion('view'), [toggleAccordion]);
  const onChangeMetadata = useCallback(() => toggleAccordion('meta'), [toggleAccordion]);
  const onChangeSearch = useCallback(() => toggleAccordion('search'), [toggleAccordion]);

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
          expanded={expandedAccordions.includes('calc')}
          onChange={onChangeCalculation}
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
                {'Tree Calculation'}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pb: 2, pt: 0, px: 2 }}>
            <CalculationSettings />
          </AccordionDetails>
        </Accordion>
        {/* 2. View & Layout */}
        <Accordion
          disableGutters
          elevation={0}
          expanded={expandedAccordions.includes('view')}
          onChange={onChangeView}
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
                {'View & Display'}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pb: 2, pt: 0, px: 2 }}>
            <ViewSettings />
          </AccordionDetails>
        </Accordion>
        {/* 3. Metadata & Styling */}
        <Accordion
          disableGutters
          elevation={0}
          expanded={expandedAccordions.includes('meta')}
          onChange={onChangeMetadata}
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
                {'Metadata & Styling'}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pb: 2, pt: 0, px: 2 }}>
            <MetadataStyling />
          </AccordionDetails>
        </Accordion>
        {/* 4. Search & Filter */}
        <Accordion
          disableGutters
          elevation={0}
          expanded={expandedAccordions.includes('search')}
          onChange={onChangeSearch}
          sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
              <SearchOutlinedIcon
                color={'primary'}
                fontSize={'small'}
              />
              <Typography
                sx={{ fontWeight: 600 }}
                variant={'body2'}
              >
                {'Search & Highlights'}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pb: 2, pt: 0, px: 2 }}>
            <SearchFilter />
          </AccordionDetails>
        </Accordion>
      </Box>
    </Drawer>
  );
};
