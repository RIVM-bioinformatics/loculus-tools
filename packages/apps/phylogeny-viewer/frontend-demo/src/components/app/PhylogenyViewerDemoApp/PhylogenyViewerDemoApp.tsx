import { DependencyContainerUtil } from '@rivm-loculus-tools/common-frontend/utils/DependencyContainerUtil';
import { PhylogenyViewerApp } from '@rivm-loculus-tools/phylogeny-viewer/components/app/PhylogenyViewerApp';
import { theme } from '@rivm-loculus-tools/common-frontend/theme';
import ForestIcon from '@mui/icons-material/Forest';
import { PhylogenyViewerStandardConfigUtil } from '@rivm-loculus-tools/phylogeny-viewer/utils/PhylogenyViewerStandardConfigUtil';
import {
  useCallback,
  useMemo,
} from 'react';
import type { DialogAction } from '@gen-epix/ui-core-components/components/Dialog';
import { FastaDataEventBusService } from '@rivm-loculus-tools/common-frontend/classes/services/FastaDataEventBusService';
import { ErrorUtil } from '@rivm-loculus-tools/common-frontend/utils/ErrorUtil';
import { UrlUtil } from '@rivm-loculus-tools/common-frontend/utils/UrlUtil';
import { phylogenyViewerStore } from '@rivm-loculus-tools/phylogeny-viewer/stores/phylogenyViewerStore';
import { useStore } from 'zustand';
import type { PhylogenyViewerConfig } from '@rivm-loculus-tools/phylogeny-viewer/models/config.models';
import HelpOutlineIcon from '@mui/icons-material/HelpOutlineOutlined';
import {
  Box,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import { container } from 'tsyringe';

export const PhylogenyViewerDemoApp = () => {
  const setData = useStore(phylogenyViewerStore, (state) => state.setData);

  const onDocumentationButtonClick = useCallback(() => {
    window.open('https://github.com/RIVM-bioinformatics/loculus-tools', '_blank');
  }, []);

  const afterAppBarRightComponent = useMemo(() => (
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
  ), [onDocumentationButtonClick]);

  const onClickLoadDemoData = useCallback(async () => {
    try {
      const [fastaRes, metaRes] = await Promise.all([
        fetch('/sample-data/sarscov2_aligned.fasta'),
        fetch('/sample-data/sarscov2_metadata.tsv'),
      ]);
      const demoFastaText = await fastaRes.text();
      const demoMetadataText = await metaRes.text();

      await setData(demoFastaText, demoMetadataText, 'country');
      container.resolve(FastaDataEventBusService).emit('onCloseImportDialog');
    } catch (err: unknown) {
      container.resolve(FastaDataEventBusService).emit('onCloseImportDialog');
      const errorMessage = `Failed to load demo dataset: ${ErrorUtil.getErrorMessage(err, 'Unknown error')}`;
      container.resolve(FastaDataEventBusService).emit('onShowImportDialog', errorMessage);
    } finally {
      UrlUtil.clearSearchParams();
    }
  }, [setData]);

  const extraFastaDataImportDialogLoaderActions = useMemo<DialogAction[]>(() => [
    {
      autoFocus: true,
      color: 'secondary',
      label: 'Demo (SARS-CoV-2)',
      onClick: onClickLoadDemoData,
      variant: 'contained',
    },
  ], [onClickLoadDemoData]);


  const config = useMemo<PhylogenyViewerConfig>(() => {
    const standardConfig = PhylogenyViewerStandardConfigUtil.createConfig();
    return {
      ...standardConfig,
      fastaImportExtraActions: extraFastaDataImportDialogLoaderActions,
      getTouchIconUrl: () => '/assets/favicon.svg',
      pageConfig: {
        ...standardConfig.pageConfig,
        afterAppBarRightComponent,
        appBarIcon: <ForestIcon sx={{ fontSize: 24 }} />,
        beforeAppBarComponent: (
          <Box
            sx={{
              alignItems: 'center',
              display: 'flex',
              gap: 1,
              height: 48,
              paddingLeft: 2,
            }}
          >
            <Typography
              component={'h1'}
              sx={{
                color: 'primary.main',
                fontSize: '1.5rem',
                fontWeight: 600,
              }}
            >
              {'Loculus'}
            </Typography>
          </Box>
        ),
      },
      theme,
    };
  }, [afterAppBarRightComponent, extraFastaDataImportDialogLoaderActions]);


  DependencyContainerUtil.registerConfig(config);

  return (
    <PhylogenyViewerApp />
  );
};
