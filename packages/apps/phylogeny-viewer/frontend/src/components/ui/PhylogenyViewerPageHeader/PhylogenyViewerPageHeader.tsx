import { container } from 'tsyringe';
import type { MouseEvent } from 'react';
import {
  useCallback,
  useState,
} from 'react';
import ForestIcon from '@mui/icons-material/Forest';
import {
  Button,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from '@mui/material';
import { PageCommonHeader } from '@rivm-loculus-tools/common-frontend/components/ui/PageCommonHeader';
import { FastaPageHeaderCenterComponent } from '@rivm-loculus-tools/common-frontend/components/fasta/FastaPageHeaderCenterComponent';
import { UrlUtil } from '@rivm-loculus-tools/common-frontend/utils/UrlUtil';
import { useStore } from 'zustand';
import { FastaPageHeaderResetButton } from '@rivm-loculus-tools/common-frontend/components/fasta/FastaPageHeaderResetButton';
import { FastaPageHeaderImportButton } from '@rivm-loculus-tools/common-frontend/components/fasta/FastaPageHeaderImportButton';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { PageHeaderDocumentationButton } from '@rivm-loculus-tools/common-frontend/components/ui/PageHeaderDocumentationButton';
import ImageIcon from '@mui/icons-material/Image';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import CodeIcon from '@mui/icons-material/Code';

import { phylogenyViewerStore } from '../../../stores/phylogenyViewerStore';
import { ExportUtil } from '../../../utils/ExportUtil';
import { PhylogenyViewerEventBusService } from '../../../classes/services/PhylogenyViewerEventBusService';
import { TREE_DOWNLOAD_TYPE } from '../../../models/tree.models';

export const PhylogenyViewerPageHeader = () => {
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
    container.resolve(PhylogenyViewerEventBusService).emit('onDownloadCanvas', TREE_DOWNLOAD_TYPE.PNG);
    onCloseExportMenu();
  }, [onCloseExportMenu]);

  const onClickExportJpeg = useCallback(() => {
    container.resolve(PhylogenyViewerEventBusService).emit('onDownloadCanvas', TREE_DOWNLOAD_TYPE.JPEG);
    onCloseExportMenu();
  }, [onCloseExportMenu]);

  const onClickExportSvg = useCallback(() => {
    container.resolve(PhylogenyViewerEventBusService).emit('onDownloadCanvas', TREE_DOWNLOAD_TYPE.SVG);
    onCloseExportMenu();
  }, [onCloseExportMenu]);

  const onReset = useCallback(() => {
    resetDataset();
    resetCalculation();
    resetTreeView();
    UrlUtil.clearSearchParams();
  }, [resetCalculation, resetDataset, resetTreeView]);

  const hasTree = Boolean(newick);

  return (
    <PageCommonHeader
      centerComponent={<FastaPageHeaderCenterComponent store={phylogenyViewerStore} />}
      icon={<ForestIcon sx={{ fontSize: 24 }} />}
      rightComponent={(
        <>
          <FastaPageHeaderImportButton />
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
          <FastaPageHeaderResetButton onReset={onReset} />
          <PageHeaderDocumentationButton />
        </>
      )}
      title={'Phylogeny Viewer'}
    />
  );
};
