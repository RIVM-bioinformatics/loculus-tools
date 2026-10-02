import type { DataImportDialogRefMethods } from '@rivm-loculus-tools/frontend-common/components/DataImportDialog';
import { DataImportDialog } from '@rivm-loculus-tools/frontend-common/components/DataImportDialog';
import type { DialogAction } from '@gen-epix/ui-core-components/components/Dialog';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { useStore } from 'zustand';
import { UrlUtil } from '@rivm-loculus-tools/frontend-common/utils/UrlUtil';

import { EventBusService } from '../../../classes/services/EventBusService';
import type { AlignmentErrorDialogRefMethods } from '../AlignmentErrorDialog';
import { AlignmentErrorDialog } from '../AlignmentErrorDialog';
import { uiStore } from '../../../stores/uiStore';
import { useDeepLinking } from '../../../hooks/useDeepLinking';

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export const DataImportDialogLoader = () => {
  const setFastaContent = useStore(uiStore, (state) => state.setFastaContent);
  const setMetadataContent = useStore(uiStore, (state) => state.setMetadataContent);
  const calculateTree = useStore(uiStore, (state) => state.calculateTree);
  const setColorByField = useStore(uiStore, (state) => state.setColorByField);
  const dataImportDialogRef = useRef<DataImportDialogRefMethods>(null);
  const alignmentErrorDialogRef = useRef<AlignmentErrorDialogRefMethods>(null);

  useDeepLinking();

  const handleError = useCallback((errorMessage: string) => {
    dataImportDialogRef.current?.close();
    EventBusService.getInstance().emit('onShowImportDialog', errorMessage);
  }, []);

  const onDataChange = useCallback(async (fastaContent: string, metadataContent: string) => {
    try {
      const fastaResult = setFastaContent(fastaContent);
      if (!fastaResult.isAligned) {
        dataImportDialogRef.current?.close();
        EventBusService.getInstance().emit('onShowAlignmentErrorDialog');
        return;
      }

      // 4. Parse Metadata
      if (metadataContent) {
        const metaResult = setMetadataContent(metadataContent);
        if (metaResult.columns.length > 0) {
          // Default color by first non-ID column if available
          const preferredCols = ['country', 'region', 'host', 'division', 'lineage', 'clade'];
          const matched = metaResult.columns.find((c) => preferredCols.includes(c.toLowerCase()));
          const defaultField = matched || metaResult.columns.find((c) => c !== 'accessionVersion' && c !== 'SampleID' && c !== 'id') || metaResult.columns[0];
          if (defaultField) {
            setColorByField(defaultField);
          }
        }
      }

      // 5. Calculate default tree
      dataImportDialogRef.current?.close();
      await calculateTree(fastaContent);
    } catch (e) {
      handleError(getErrorMessage(e, 'Unknown error'));
    } finally {
      // clear any search params from the URL
      UrlUtil.clearSearchParams();
    }
  }, [calculateTree, handleError, setColorByField, setFastaContent, setMetadataContent]);

  const onError = useCallback((errorMessage: unknown) => {
    handleError(getErrorMessage(errorMessage, 'Unknown error'));
  }, [handleError]);

  const onClickLoadDemoData = useCallback(async () => {
    try {
      const [fastaRes, metaRes] = await Promise.all([
        fetch('/sample-data/sarscov2_aligned.fasta'),
        fetch('/sample-data/sarscov2_metadata.tsv'),
      ]);
      const demoFastaText = await fastaRes.text();
      const demoMetadataText = await metaRes.text();

      setFastaContent(demoFastaText);
      const metaResult = setMetadataContent(demoMetadataText);
      if (metaResult.columns.length > 0) {
        const field = 'country';
        setColorByField(field);
      }
      dataImportDialogRef.current?.close();
      await calculateTree(demoFastaText);
    } catch (err: unknown) {
      handleError(`Failed to load demo dataset: ${getErrorMessage(err, 'Unknown error')}`);
    } finally {
      UrlUtil.clearSearchParams();
    }
  }, [calculateTree, handleError, setColorByField, setFastaContent, setMetadataContent]);

  const extraActions = useMemo<DialogAction[]>(() => [
    {
      autoFocus: true,
      color: 'secondary',
      label: 'Demo (SARS-CoV-2)',
      onClick: onClickLoadDemoData,
      variant: 'contained',
    },
  ], [onClickLoadDemoData]);

  useEffect(() => {
    const eventBusService = EventBusService.getInstance();

    const removers = [
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      eventBusService.addEventListener('onShowImportDialog', (initialErrorMessage?: string) => {
        dataImportDialogRef.current?.open(initialErrorMessage ? { initialErrorMessage } : undefined);
      }),
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      eventBusService.addEventListener('onShowAlignmentErrorDialog', () => {
        alignmentErrorDialogRef.current?.open();
      }),
    ];
    return () => {
      removers.forEach((remove) => remove());
    };
  }, []);


  return (
    <>
      <DataImportDialog
        extraActions={extraActions}
        onDataChange={onDataChange}
        onError={onError}
        ref={dataImportDialogRef}
      />
      <AlignmentErrorDialog ref={alignmentErrorDialogRef} />
    </>
  );
};
