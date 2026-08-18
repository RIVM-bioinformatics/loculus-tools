import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  Button,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import HelpOutlineIcon from '@mui/icons-material/HelpOutlineOutlined';
import ForestIcon from '@mui/icons-material/Forest';
import ImageIcon from '@mui/icons-material/Image';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import CodeIcon from '@mui/icons-material/Code';

import { useDatasetStore } from '../../stores/datasetStore';
import { useCalculationStore } from '../../stores/calculationStore';
import { useTreeViewStore } from '../../stores/treeViewStore';
import { useMetadataStore } from '../../stores/metadataStore';
import {
  downloadNewickFile,
  downloadCanvasAsImage,
  downloadCanvasAsSvg,
} from '../../services/export/exportService';

export const AppHeader: React.FC = () => {
  const drawerOpen = useTreeViewStore((state) => state.drawerOpen);
  const setDrawerOpen = useTreeViewStore((state) => state.setDrawerOpen);
  const setImportModalOpen = useTreeViewStore((state) => state.setImportModalOpen);
  const resetTreeView = useTreeViewStore((state) => state.resetTreeView);

  const parsedFasta = useDatasetStore((state) => state.parsedFasta);
  const parsedMetadata = useDatasetStore((state) => state.parsedMetadata);
  const resetDataset = useDatasetStore((state) => state.resetDataset);

  const newick = useCalculationStore((state) => state.newick);
  const resetCalculation = useCalculationStore((state) => state.resetCalculation);
  const resetMetadataState = useMetadataStore((state) => state.resetMetadataState);

  // Export Menu State
  const [exportAnchorEl, setExportAnchorEl] = useState<null | HTMLElement>(null);
  const isExportMenuOpen = Boolean(exportAnchorEl);

  const handleExportClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setExportAnchorEl(event.currentTarget);
  };

  const handleExportClose = () => {
    setExportAnchorEl(null);
  };

  const handleExportNewick = () => {
    if (newick) {
      downloadNewickFile(newick, 'phylogenetic_tree.nwk');
    }
    handleExportClose();
  };

  const handleExportPng = () => {
    const canvas = (window as any).__phyloTreeCanvas as HTMLCanvasElement;
    downloadCanvasAsImage(canvas, 'png', 'phylogenetic_tree');
    handleExportClose();
  };

  const handleExportJpeg = () => {
    const canvas = (window as any).__phyloTreeCanvas as HTMLCanvasElement;
    downloadCanvasAsImage(canvas, 'jpeg', 'phylogenetic_tree');
    handleExportClose();
  };

  const handleExportSvg = () => {
    const canvas = (window as any).__phyloTreeCanvas as HTMLCanvasElement;
    downloadCanvasAsSvg(canvas, 'phylogenetic_tree.svg');
    handleExportClose();
  };

  const handleResetSession = () => {
    if (window.confirm('Reset the current session and clear all loaded sequences and metadata?')) {
      resetDataset();
      resetCalculation();
      resetTreeView();
      resetMetadataState();
    }
  };

  const seqCount = parsedFasta?.sequences?.length || 0;
  const metaCount = parsedMetadata?.records?.length || 0;
  const hasTree = Boolean(newick);

  return (
    <AppBar
      position="static"
      elevation={1}
      sx={{
        backgroundColor: '#01689B', // Official RIVM Blue
        color: '#FFFFFF',
        zIndex: (theme) => theme.zIndex.drawer + 1,
        height: 56,
        justifyContent: 'center',
      }}
    >
      <Toolbar variant="dense" sx={{ display: 'flex', justifyContent: 'space-between', px: 2 }}>
        {/* Left: Menu toggle and App Branding */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {!drawerOpen && (
            <IconButton
              edge="start"
              color="inherit"
              aria-label="open drawer"
              onClick={() => setDrawerOpen(true)}
              size="small"
            >
              <MenuIcon />
            </IconButton>
          )}

          <ForestIcon sx={{ fontSize: 24 }} />

          <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 700, fontSize: '1.05rem', letterSpacing: '-0.01em' }}>
            Phylogenetic Tree Viewer
          </Typography>

          <Typography
            variant="caption"
            sx={{
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              px: 1,
              py: 0.25,
              borderRadius: 1,
              fontWeight: 600,
              fontSize: '0.7rem',
              display: { xs: 'none', sm: 'inline-block' },
            }}
          >
            Loculus Tool
          </Typography>
        </Box>

        {/* Center: Dataset Status Badges */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {seqCount > 0 && (
            <Chip
              size="small"
              label={`${seqCount} Sequences`}
              sx={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: '#FFFFFF',
                fontWeight: 600,
                fontSize: '0.75rem',
              }}
            />
          )}

          {metaCount > 0 && (
            <Chip
              size="small"
              label={`${metaCount} Metadata Records`}
              sx={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: '#FFFFFF',
                fontWeight: 600,
                fontSize: '0.75rem',
              }}
            />
          )}
        </Box>

        {/* Right: Global Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            variant="contained"
            size="small"
            color="inherit"
            startIcon={<FileUploadOutlinedIcon />}
            onClick={() => setImportModalOpen(true)}
            sx={{
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              color: '#FFFFFF',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.25)',
              },
            }}
          >
            Import Data
          </Button>

          <Button
            variant="contained"
            size="small"
            color="inherit"
            startIcon={<FileDownloadOutlinedIcon />}
            onClick={handleExportClick}
            disabled={!hasTree}
            sx={{
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              color: '#FFFFFF',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.25)',
              },
            }}
          >
            Export
          </Button>

          <Menu
            anchorEl={exportAnchorEl}
            open={isExportMenuOpen}
            onClose={handleExportClose}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <MenuItem onClick={handleExportNewick}>
              <ListItemIcon>
                <CodeIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Save as Newick (.nwk)" />
            </MenuItem>
            <MenuItem onClick={handleExportPng}>
              <ListItemIcon>
                <ImageIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Save as PNG Image" />
            </MenuItem>
            <MenuItem onClick={handleExportJpeg}>
              <ListItemIcon>
                <ImageIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Save as JPEG Image" />
            </MenuItem>
            <MenuItem onClick={handleExportSvg}>
              <ListItemIcon>
                <PictureAsPdfIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Save as SVG Vector" />
            </MenuItem>
          </Menu>

          <Tooltip title="Reset current session and dataset">
            <IconButton size="small" color="inherit" onClick={handleResetSession} sx={{ opacity: 0.85 }}>
              <RestartAltIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Documentation & Specifications">
            <IconButton
              size="small"
              color="inherit"
              onClick={() => window.open('https://github.com/RIVM-bioinformatics/loculus-tools', '_blank')}
              sx={{ opacity: 0.85 }}
            >
              <HelpOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
};
