import React, { useState } from 'react';
import {
  Box,
  Drawer,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  IconButton,
  Button,
  Divider,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import CalculateOutlinedIcon from '@mui/icons-material/CalculateOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';

import { CalculationSettings } from './CalculationSettings';
import { ViewSettings } from './ViewSettings';
import { MetadataStyling } from './MetadataStyling';
import { SearchFilter } from './SearchFilter';
import { useTreeViewStore } from '../../stores/treeViewStore';

export const DRAWER_WIDTH = 340;

export const SideControlPanel: React.FC = () => {
  const drawerOpen = useTreeViewStore((state) => state.drawerOpen);
  const setDrawerOpen = useTreeViewStore((state) => state.setDrawerOpen);
  const setImportModalOpen = useTreeViewStore((state) => state.setImportModalOpen);

  const [expandedAccordions, setExpandedAccordions] = useState<string[]>([
    'calc',
    'view',
    'meta',
    'search',
  ]);

  const toggleAccordion = (panel: string) => {
    setExpandedAccordions((prev) =>
      prev.includes(panel) ? prev.filter((p) => p !== panel) : [...prev, panel]
    );
  };

  return (
    <Drawer
      variant="persistent"
      anchor="left"
      open={drawerOpen}
      sx={{
        width: drawerOpen ? DRAWER_WIDTH : 0,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          top: '56px',
          height: 'calc(100% - 56px)',
          borderRight: '1px solid',
          borderColor: 'divider',
          backgroundColor: '#FFFFFF',
          overflowY: 'auto',
        },
      }}
    >
      {/* Header with Close and Data Load trigger */}
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle1" color="text.primary" sx={{ fontWeight: 700 }}>
            Tree Controls
          </Typography>
          <IconButton size="small" onClick={() => setDrawerOpen(false)} title="Collapse Side Panel">
            <ChevronLeftIcon />
          </IconButton>
        </Box>

        <Button
          variant="outlined"
          color="primary"
          fullWidth
          startIcon={<FileUploadOutlinedIcon />}
          onClick={() => setImportModalOpen(true)}
          sx={{ py: 0.75 }}
        >
          Load / Replace Data
        </Button>
      </Box>

      {/* Accordions */}
      <Box sx={{ pb: 3 }}>
        {/* 1. Tree Calculation */}
        <Accordion
          expanded={expandedAccordions.includes('calc')}
          onChange={() => toggleAccordion('calc')}
          disableGutters
          elevation={0}
          sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalculateOutlinedIcon fontSize="small" color="primary" />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Tree Calculation
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, px: 2, pb: 2 }}>
            <CalculationSettings />
          </AccordionDetails>
        </Accordion>

        {/* 2. View & Layout */}
        <Accordion
          expanded={expandedAccordions.includes('view')}
          onChange={() => toggleAccordion('view')}
          disableGutters
          elevation={0}
          sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TuneOutlinedIcon fontSize="small" color="primary" />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                View & Display
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, px: 2, pb: 2 }}>
            <ViewSettings />
          </AccordionDetails>
        </Accordion>

        {/* 3. Metadata & Styling */}
        <Accordion
          expanded={expandedAccordions.includes('meta')}
          onChange={() => toggleAccordion('meta')}
          disableGutters
          elevation={0}
          sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PaletteOutlinedIcon fontSize="small" color="primary" />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Metadata & Styling
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, px: 2, pb: 2 }}>
            <MetadataStyling />
          </AccordionDetails>
        </Accordion>

        {/* 4. Search & Filter */}
        <Accordion
          expanded={expandedAccordions.includes('search')}
          onChange={() => toggleAccordion('search')}
          disableGutters
          elevation={0}
          sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SearchOutlinedIcon fontSize="small" color="primary" />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Search & Highlights
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, px: 2, pb: 2 }}>
            <SearchFilter />
          </AccordionDetails>
        </Accordion>
      </Box>
    </Drawer>
  );
};
