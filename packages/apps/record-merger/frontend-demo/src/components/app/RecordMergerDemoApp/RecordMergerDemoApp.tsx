import { container } from 'tsyringe';
import {
  useCallback,
  useMemo,
} from 'react';
import type { DialogAction } from '@gen-epix/ui-core-components/components/Dialog';
import HelpOutlineIcon from '@mui/icons-material/HelpOutlineOutlined';
import MergeTypeIcon from '@mui/icons-material/MergeType';
import {
  Box,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import { useStore } from 'zustand';
import { FastaDataEventBusService } from '@rivm-loculus-tools/common-frontend/classes/services/FastaDataEventBusService';
import { DependencyContainerUtil } from '@rivm-loculus-tools/common-frontend/utils/DependencyContainerUtil';
import { ErrorUtil } from '@rivm-loculus-tools/common-frontend/utils/ErrorUtil';
import { RecordMergerApp } from '@rivm-loculus-tools/record-merger/components/app/RecordMergerApp';
import type { RecordMergerConfig } from '@rivm-loculus-tools/record-merger/models/config.models';
import { recordMergerStore } from '@rivm-loculus-tools/record-merger/stores/recordMergerStore';
import { createRecordMergerTheme } from '@rivm-loculus-tools/record-merger/theme/demoTheme';
import { RecordMergerStandardConfigUtil } from '@rivm-loculus-tools/record-merger/utils/RecordMergerStandardConfigUtil';

export const RecordMergerDemoApp = () => {
  const setMergerData = useStore(recordMergerStore, (state) => state.setMergerData);

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
      const [batch1Res, batch2Res, refRes, metaRes] = await Promise.all([
        fetch('/sample-data/sarscov2_records_batch1.fasta'),
        fetch('/sample-data/sarscov2_records_batch2.fasta'),
        fetch('/sample-data/sarscov2_reference.fasta'),
        fetch('/sample-data/sarscov2_metadata.tsv'),
      ]);

      if (!batch1Res.ok || !batch2Res.ok || !refRes.ok || !metaRes.ok) {
        throw new Error('Failed to fetch one or more demo data files.');
      }

      const [batch1Text, batch2Text, refText, metaText] = await Promise.all([
        batch1Res.text(),
        batch2Res.text(),
        refRes.text(),
        metaRes.text(),
      ]);

      await setMergerData([batch1Text, batch2Text], refText, metaText);
      container.resolve(FastaDataEventBusService).emit('onCloseImportDialog');
    } catch (err: unknown) {
      container.resolve(FastaDataEventBusService).emit('onCloseImportDialog');
      const errorMessage = `Failed to load demo dataset: ${ErrorUtil.getErrorMessage(err, 'Unknown error')}`;
      container.resolve(FastaDataEventBusService).emit('onShowImportDialog', errorMessage);
    } finally {
      const url = new URL(window.location.href);
      url.searchParams.delete('input-fasta');
      url.searchParams.delete('input-reference');
      url.searchParams.delete('input-metadata');
      window.history.replaceState(null, '', url.toString());
    }
  }, [setMergerData]);

  const extraImportDialogActions = useMemo<DialogAction[]>(() => [
    {
      autoFocus: true,
      color: 'secondary',
      label: 'Demo (SARS-CoV-2 Multi-Record)',
      onClick: onClickLoadDemoData,
      variant: 'contained',
    },
  ], [onClickLoadDemoData]);

  const config = useMemo<RecordMergerConfig>(() => {
    const standardConfig = RecordMergerStandardConfigUtil.createConfig();
    return {
      ...standardConfig,
      fastaImportExtraActions: extraImportDialogActions,
      getTouchIconUrl: () => '/assets/favicon.svg',
      pageConfig: {
        ...standardConfig.pageConfig,
        afterAppBarRightComponent,
        appBarIcon: <MergeTypeIcon sx={{ fontSize: 24 }} />,
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
      theme: createRecordMergerTheme('light'),
    } satisfies RecordMergerConfig;
  }, [afterAppBarRightComponent, extraImportDialogActions]);

  DependencyContainerUtil.registerConfig(config);

  return (
    <RecordMergerApp />
  );
};
