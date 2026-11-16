import {
  useCallback,
  useMemo,
} from 'react';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import DnaIcon from '@mui/icons-material/Biotech';
import StorageIcon from '@mui/icons-material/Storage';
import { useStore } from 'zustand';
import { DownloadUtil } from '@gen-epix/ui-core/utils/DownloadUtil';
import { FastaPageHeaderCenterComponent } from '@rivm-loculus-tools/common-frontend/components/fasta/FastaPageHeaderCenterComponent';
import { FastaPageHeaderImportButton } from '@rivm-loculus-tools/common-frontend/components/fasta/FastaPageHeaderImportButton';
import { FastaPageHeaderResetButton } from '@rivm-loculus-tools/common-frontend/components/fasta/FastaPageHeaderResetButton';
import type { ButtonWithMenuProps } from '@rivm-loculus-tools/common-frontend/components/ui/ButtonWithMenu';
import { ButtonWithMenu } from '@rivm-loculus-tools/common-frontend/components/ui/ButtonWithMenu';
import { PageCommonHeader } from '@rivm-loculus-tools/common-frontend/components/ui/PageCommonHeader';
import { ExportUtil } from '@rivm-loculus-tools/common-frontend/utils/ExportUtil';

import { recordMergerStore } from '../../../stores/recordMergerStore';

export const RecordMergerPageHeader = () => {
  const parsedFasta = useStore(recordMergerStore, (state) => state.parsedFasta);
  const parsedMetadata = useStore(recordMergerStore, (state) => state.parsedMetadata);
  const alignmentResult = useStore(recordMergerStore, (state) => state.alignmentResult);
  const consensusResult = useStore(recordMergerStore, (state) => state.consensusResult);
  const resetDataset = useStore(recordMergerStore, (state) => state.resetDataset);

  const sequenceCount = parsedFasta?.sequences?.length ?? 0;
  const metaDataCount = parsedMetadata?.records?.length ?? 0;

  const onClickExportConsensus = useCallback(() => {
    if (consensusResult?.consensusFasta) {
      ExportUtil.downloadFastaFile(consensusResult.consensusFasta, 'merged_consensus.fasta');
    }
  }, [consensusResult]);

  const onClickExportBam = useCallback(() => {
    if (alignmentResult?.bamBlobUrl) {
      DownloadUtil.createDownloadUrl(alignmentResult.bamBlobUrl, 'aligned.sorted.bam');
    }
  }, [alignmentResult]);

  const onReset = useCallback(() => {
    resetDataset();
  }, [resetDataset]);

  const exportMenuItems: ButtonWithMenuProps['items'] = useMemo(() => [
    {
      disabled: !consensusResult?.consensusFasta,
      icon: <DnaIcon fontSize={'small'} />,
      label: 'Download Consensus FASTA (.fasta)',
      onClick: onClickExportConsensus,
    },
    {
      disabled: !alignmentResult?.bamBlobUrl,
      icon: <StorageIcon fontSize={'small'} />,
      label: 'Download Sorted Alignment (.bam)',
      onClick: onClickExportBam,
    },
  ], [alignmentResult, consensusResult, onClickExportBam, onClickExportConsensus]);

  return (
    <PageCommonHeader
      centerComponent={(
        <FastaPageHeaderCenterComponent
          metaDataCount={metaDataCount}
          sequenceCount={sequenceCount}
        />
      )}
      rightComponent={(
        <>
          <FastaPageHeaderImportButton />
          <ButtonWithMenu
            disabled={!alignmentResult && !consensusResult}
            items={exportMenuItems}
            label={'Export'}
            startIcon={<FileDownloadOutlinedIcon />}
          />
          <FastaPageHeaderResetButton onReset={onReset} />
        </>
      )}
      title={'Record Merger'}
    />
  );
};
