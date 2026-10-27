import { DependencyContainerUtil } from '@rivm-loculus-tools/common-frontend/utils/DependencyContainerUtil';
import { theme } from '@rivm-loculus-tools/common-frontend/theme';
import BiotechOutlinedIcon from '@mui/icons-material/BiotechOutlined';
import { SequenceEditorStandardConfigUtil } from '@rivm-loculus-tools/sequence-editor/utils/SequenceEditorStandardConfigUtil';
import {
  useCallback,
  useMemo,
} from 'react';
import type { DialogAction } from '@gen-epix/ui-core-components/components/Dialog';
import { FastaDataEventBusService } from '@rivm-loculus-tools/common-frontend/classes/services/FastaDataEventBusService';
import { ErrorUtil } from '@rivm-loculus-tools/common-frontend/utils/ErrorUtil';
import { UrlUtil } from '@rivm-loculus-tools/common-frontend/utils/UrlUtil';
import { useStore } from 'zustand';
import { SequenceEditorApp } from '@rivm-loculus-tools/sequence-editor/components/app/App';
import { sequenceEditorStore } from '@rivm-loculus-tools/sequence-editor/stores/sequenceEditorStore';
import HelpOutlineIcon from '@mui/icons-material/HelpOutlineOutlined';
import {
  Box,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import { container } from 'tsyringe';

export const SequenceEditorDemoApp = () => {
  const setData = useStore(sequenceEditorStore, (state) => state.setData);

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
      const fastaRes = await fetch('/sample-data/sarscov2_demo.fasta');
      const demoFastaText = await fastaRes.text();

      await setData(demoFastaText);
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

  const config = useMemo(() => {
    const standardConfig = SequenceEditorStandardConfigUtil.createConfig();
    return {
      ...standardConfig,
      fastaImportExtraActions: extraFastaDataImportDialogLoaderActions,
      getTouchIconUrl: () => '/assets/favicon.svg',
      pageConfig: {
        ...standardConfig.pageConfig,
        afterAppBarRightComponent,
        appBarIcon: <BiotechOutlinedIcon sx={{ fontSize: 24 }} />,
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

  // Note: do not run this in a useEffect, as it should be executed synchronously during component initialization
  DependencyContainerUtil.registerConfig(config);

  return (
    <SequenceEditorApp />
  );
};
