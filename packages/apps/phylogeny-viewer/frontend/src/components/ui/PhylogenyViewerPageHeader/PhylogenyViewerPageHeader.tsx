import type { MouseEvent } from 'react';
import {
  useCallback,
  useState,
} from 'react';
import ForestIcon from '@mui/icons-material/Forest';
import {
  Box,
  Button,
  Chip,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material';
import { PageCommonHeader } from '@rivm-loculus-tools/frontend-common/components/page';
import { UrlUtil } from '@rivm-loculus-tools/frontend-common/utils/UrlUtil';
import { useStore } from 'zustand';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import HelpOutlineIcon from '@mui/icons-material/HelpOutlineOutlined';
import ImageIcon from '@mui/icons-material/Image';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import CodeIcon from '@mui/icons-material/Code';
import { FastaDataEventBusService } from '@rivm-loculus-tools/frontend-common/classes/services/FastaDataEventBusService';

import { phylogenyViewerStore } from '../../../stores/phylogenyViewerStore';
import { ExportUtil } from '../../../utils/ExportUtil';
import { EventBusService } from '../../../classes/services/EventBusService';
import { TREE_DOWNLOAD_TYPE } from '../../../models/tree';

export const PhylogenyViewerPageHeader = () => {
  const parsedFasta = useStore(phylogenyViewerStore, (state) => state.parsedFasta);
  const parsedMetadata = useStore(phylogenyViewerStore, (state) => state.parsedMetadata);
  const newick = useStore(phylogenyViewerStore, (state) => state.newick);
  const resetDataset = useStore(phylogenyViewerStore, (state) => state.resetDataset);
  const resetCalculation = useStore(phylogenyViewerStore, (state) => state.resetCalculation);
  const resetTreeView = useStore(phylogenyViewerStore, (state) => state.resetTreeView);

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

  const onImportDataButtonClick = useCallback(() => FastaDataEventBusService.getInstance().emit('onShowImportDialog'), []);
  const onDocumentationButtonClick = useCallback(() => {
    window.open('https://github.com/RIVM-bioinformatics/loculus-tools', '_blank');
  }, []);

  const seqCount = parsedFasta?.sequences?.length || 0;
  const metaCount = parsedMetadata?.records?.length || 0;
  const hasTree = Boolean(newick);

  return (
    <PageCommonHeader
      centerComponent={(
        <>
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
        </>
      )}
      icon={<ForestIcon sx={{ fontSize: 24 }} />}
      rightComponent={(
        <>
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
        </>
      )}
      title={'Phylogeny Viewer'}
    />
  );
};
