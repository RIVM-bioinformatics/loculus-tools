import type { MouseEvent } from 'react';
import {
  useCallback,
  useState,
} from 'react';
import {
  AppBar,
  Box,
  Button,
  Chip,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
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
import { useStore } from 'zustand/react';

import { uiStore } from '../../../stores/uiStore';
import { ExportUtil } from '../../../utils/ExportUtil';
import { EventBusService } from '../../../classes/services/EventBusService';
import { UrlUtil } from '../../../utils/UrlUtil';
import { TREE_DOWNLOAD_TYPE } from '../../../models/tree';

export type PageHeaderProps = {
  readonly drawerOpen: boolean;
  readonly noInteraction?: boolean;
};

export const PageHeader = ({ drawerOpen, noInteraction }: PageHeaderProps) => {
  const resetTreeView = useStore(uiStore, (state) => state.resetTreeView);

  const parsedFasta = useStore(uiStore, (state) => state.parsedFasta);
  const parsedMetadata = useStore(uiStore, (state) => state.parsedMetadata);
  const resetDataset = useStore(uiStore, (state) => state.resetDataset);

  const newick = useStore(uiStore, (state) => state.newick);
  const resetCalculation = useStore(uiStore, (state) => state.resetCalculation);

  // Export Menu State
  const [exportAnchorEl, setExportAnchorEl] = useState<HTMLElement | null>(null);
  const isExportMenuOpen = Boolean(exportAnchorEl);

  const onClickExport = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    setExportAnchorEl(event.currentTarget);
  }, []);

  const onCloseExportMenu = useCallback(() => {
    setExportAnchorEl(null);
  }, []);

  const onClickExportNewick = useCallback(() => {
    if (newick) {
      ExportUtil.downloadNewickFile(newick, 'phylogenetic_tree.nwk');
    }
    onCloseExportMenu();
  }, [newick, onCloseExportMenu]);

  const onClickExportPng = useCallback(() => {
    EventBusService.getInstance().emit('onDownloadCanvas', TREE_DOWNLOAD_TYPE.PNG);
    onCloseExportMenu();
  }, [onCloseExportMenu]);

  const onClickExportJpeg = useCallback(() => {
    EventBusService.getInstance().emit('onDownloadCanvas', TREE_DOWNLOAD_TYPE.JPEG);
    onCloseExportMenu();
  }, [onCloseExportMenu]);

  const onClickExportSvg = useCallback(() => {
    EventBusService.getInstance().emit('onDownloadCanvas', TREE_DOWNLOAD_TYPE.SVG);
    onCloseExportMenu();
  }, [onCloseExportMenu]);

  const onClickResetSession = useCallback(() => {
    resetDataset();
    resetCalculation();
    resetTreeView();
    UrlUtil.clearSearchParams();
  }, [resetCalculation, resetDataset, resetTreeView]);

  const onToggleDrawerButtonClick = useCallback(() => {
    EventBusService.getInstance().emit('onToggleDrawer', !drawerOpen);
  }, [drawerOpen]);
  const onImportDataButtonClick = useCallback(() => EventBusService.getInstance().emit('onShowImportDialog'), []);
  const onDocumentationButtonClick = useCallback(() => {
    window.open('https://github.com/RIVM-bioinformatics/loculus-tools', '_blank');
  }, []);

  const seqCount = parsedFasta?.sequences?.length || 0;
  const metaCount = parsedMetadata?.records?.length || 0;
  const hasTree = Boolean(newick);

  return (
    <AppBar
      elevation={1}
      position={'static'}
      sx={{
        backgroundColor: 'primary.main',
        color: '#FFFFFF',
        height: 56,
        justifyContent: 'center',
        zIndex: (theme) => theme.zIndex.drawer + 1,
      }}
    >
      <Toolbar
        sx={{ display: 'flex', justifyContent: 'space-between', px: 2 }}
        variant={'dense'}
      >
        {/* Left: Menu toggle and App Branding */}
        <Box sx={{ alignItems: 'center', display: 'flex', gap: 1.5 }}>
          {!noInteraction && (
            <IconButton
              aria-label={'open drawer'}
              color={'inherit'}
              edge={'start'}
              onClick={onToggleDrawerButtonClick}
              size={'small'}
            >
              <MenuIcon />
            </IconButton>
          )}
          <ForestIcon sx={{ fontSize: 24 }} />
          <Typography
            component={'div'}
            noWrap
            sx={{ color: 'inherit', fontSize: '1.05rem', fontWeight: 700, letterSpacing: '-0.01em' }}
            variant={'h6'}
          >
            {'Phylogenetic Tree Viewer'}
          </Typography>
          <Typography
            sx={{
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              borderRadius: 1,
              display: { sm: 'inline-block', xs: 'none' },
              fontSize: '0.7rem',
              fontWeight: 600,
              px: 1,
              py: 0.25,
            }}
            variant={'caption'}
          >
            {'Loculus Tool'}
          </Typography>
        </Box>
        {/* Center: Dataset Status Badges */}
        <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
          {seqCount > 0 && (
            <Chip
              label={`${seqCount} Sequences`}
              size={'small'}
              sx={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: '#FFFFFF',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            />
          )}
          {metaCount > 0 && (
            <Chip
              label={`${metaCount} Metadata Records`}
              size={'small'}
              sx={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: '#FFFFFF',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            />
          )}
        </Box>
        {/* Right: Global Actions */}
        {!noInteraction && (
          <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
            <Button
              color={'inherit'}
              onClick={onImportDataButtonClick}
              size={'small'}
              startIcon={<FileUploadOutlinedIcon />}
              sx={{
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.25)',
                },
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                color: '#FFFFFF',
              }}
              variant={'contained'}
            >
              {'Import Data'}
            </Button>
            <Button
              color={'inherit'}
              disabled={!hasTree}
              onClick={onClickExport}
              size={'small'}
              startIcon={<FileDownloadOutlinedIcon />}
              sx={{
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.25)',
                },
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                color: '#FFFFFF',
              }}
              variant={'contained'}
            >
              {'Export'}
            </Button>
            <Menu
              anchorEl={exportAnchorEl}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              onClose={onCloseExportMenu}
              open={isExportMenuOpen}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            >
              <MenuItem onClick={onClickExportNewick}>
                <ListItemIcon>
                  <CodeIcon fontSize={'small'} />
                </ListItemIcon>
                <ListItemText primary={'Save as Newick (.nwk)'} />
              </MenuItem>
              <MenuItem onClick={onClickExportPng}>
                <ListItemIcon>
                  <ImageIcon fontSize={'small'} />
                </ListItemIcon>
                <ListItemText primary={'Save as PNG Image'} />
              </MenuItem>
              <MenuItem onClick={onClickExportJpeg}>
                <ListItemIcon>
                  <ImageIcon fontSize={'small'} />
                </ListItemIcon>
                <ListItemText primary={'Save as JPEG Image'} />
              </MenuItem>
              <MenuItem onClick={onClickExportSvg}>
                <ListItemIcon>
                  <PictureAsPdfIcon fontSize={'small'} />
                </ListItemIcon>
                <ListItemText primary={'Save as SVG Vector'} />
              </MenuItem>
            </Menu>
            <Tooltip title={'Reset current session and dataset'}>
              <IconButton
                color={'inherit'}
                onClick={onClickResetSession}
                size={'small'}
                sx={{ opacity: 0.85 }}
              >
                <RestartAltIcon fontSize={'small'} />
              </IconButton>
            </Tooltip>
            <Tooltip title={'Documentation & Specifications'}>
              <IconButton
                color={'inherit'}
                onClick={onDocumentationButtonClick}
                size={'small'}
                sx={{ opacity: 0.85 }}
              >
                <HelpOutlineIcon fontSize={'small'} />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
};
