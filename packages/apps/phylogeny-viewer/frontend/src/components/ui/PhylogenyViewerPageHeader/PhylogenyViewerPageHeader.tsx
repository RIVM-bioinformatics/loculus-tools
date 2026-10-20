import { container } from 'tsyringe';
import {
  useCallback,
  useMemo,
} from 'react';
import { PageCommonHeader } from '@rivm-loculus-tools/common-frontend/components/ui/PageCommonHeader';
import { FastaPageHeaderCenterComponent } from '@rivm-loculus-tools/common-frontend/components/fasta/FastaPageHeaderCenterComponent';
import { UrlUtil } from '@rivm-loculus-tools/common-frontend/utils/UrlUtil';
import { useStore } from 'zustand';
import { FastaPageHeaderResetButton } from '@rivm-loculus-tools/common-frontend/components/fasta/FastaPageHeaderResetButton';
import { FastaPageHeaderImportButton } from '@rivm-loculus-tools/common-frontend/components/fasta/FastaPageHeaderImportButton';
import { ButtonWithMenu } from '@rivm-loculus-tools/common-frontend/components/ui/ButtonWithMenu';
import type { ButtonWithMenuProps } from '@rivm-loculus-tools/common-frontend/components/ui/ButtonWithMenu';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import ImageIcon from '@mui/icons-material/Image';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import CodeIcon from '@mui/icons-material/Code';
import { ExportUtil } from '@rivm-loculus-tools/common-frontend/utils/ExportUtil';

import { phylogenyViewerStore } from '../../../stores/phylogenyViewerStore';
import { PhylogenyViewerEventBusService } from '../../../classes/services/PhylogenyViewerEventBusService';
import { TREE_DOWNLOAD_TYPE } from '../../../models/tree.models';

export const PhylogenyViewerPageHeader = () => {
  const newick = useStore(phylogenyViewerStore, (state) => state.newick);
  const resetDataset = useStore(phylogenyViewerStore, (state) => state.resetDataset);
  const resetCalculation = useStore(phylogenyViewerStore, (state) => state.resetCalculation);
  const resetTreeView = useStore(phylogenyViewerStore, (state) => state.resetTreeView);


  const onClickExportNewick = useCallback(() => {
    if (newick) {
      ExportUtil.downloadNewickFile(newick, 'phylogenetic_tree.nwk');
    }
  }, [newick]);

  const onClickExportPng = useCallback(() => {
    container.resolve(PhylogenyViewerEventBusService).emit('onDownloadCanvas', TREE_DOWNLOAD_TYPE.PNG);
  }, []);

  const onClickExportJpeg = useCallback(() => {
    container.resolve(PhylogenyViewerEventBusService).emit('onDownloadCanvas', TREE_DOWNLOAD_TYPE.JPEG);
  }, []);

  const onClickExportSvg = useCallback(() => {
    container.resolve(PhylogenyViewerEventBusService).emit('onDownloadCanvas', TREE_DOWNLOAD_TYPE.SVG);
  }, []);

  const onReset = useCallback(() => {
    resetDataset();
    resetCalculation();
    resetTreeView();
    UrlUtil.clearSearchParams();
  }, [resetCalculation, resetDataset, resetTreeView]);

  const hasTree = Boolean(newick);

  const exportExportMenuItems: ButtonWithMenuProps['items'] = useMemo(() => [
    {
      icon: <CodeIcon fontSize={'small'} />,
      label: 'Save as Newick (.nwk)',
      onClick: onClickExportNewick,
    },
    {
      icon: <ImageIcon fontSize={'small'} />,
      label: 'Save as PNG Image',
      onClick: onClickExportPng,
    },
    {
      icon: <ImageIcon fontSize={'small'} />,
      label: 'Save as JPEG Image',
      onClick: onClickExportJpeg,
    },
    {
      icon: <PictureAsPdfIcon fontSize={'small'} />,
      label: 'Save as SVG Vector',
      onClick: onClickExportSvg,
    },
  ], [onClickExportNewick, onClickExportPng, onClickExportJpeg, onClickExportSvg]);

  return (
    <PageCommonHeader
      centerComponent={<FastaPageHeaderCenterComponent store={phylogenyViewerStore} />}
      rightComponent={(
        <>
          <FastaPageHeaderImportButton />
          <ButtonWithMenu
            disabled={!hasTree}
            items={exportExportMenuItems}
            label={'Export'}
            startIcon={<FileDownloadOutlinedIcon />}
          />
          <FastaPageHeaderResetButton onReset={onReset} />
        </>
      )}
      title={'Phylogeny Viewer'}
    />
  );
};
