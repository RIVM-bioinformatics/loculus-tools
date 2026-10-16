import type { DialogAction } from '@gen-epix/ui-core-components/components/Dialog';
import {
  useCallback,
  useEffect,
  useRef,
} from 'react';
import type { StoreApi } from 'zustand';
import { useStore } from 'zustand';

import { FastaDataEventBusService } from '../../../classes/services/FastaDataEventBusService';
import { LOADING_STATUS } from '../../../models/fasta.models';
import type { FastaDataStore } from '../../../stores/fastaDataStore';
import { UrlUtil } from '../../../utils/UrlUtil';
import type { FastaDataImportDialogRefMethods } from '../FastaDataImportDialog/FastaDataImportDialog';
import { FastaDataImportDialog } from '../FastaDataImportDialog/FastaDataImportDialog';
import { ErrorUtil } from '../../../utils/ErrorUtil';


export type FastaDataImportDialogLoaderProps = {
  extraActions: DialogAction[];
  store: StoreApi<FastaDataStore>;
};

export const FastaDataImportDialogLoader = ({ extraActions, store }: FastaDataImportDialogLoaderProps) => {
  const setData = useStore(store, (state) => state.setData);
  const setLoadingStatus = useStore(store, (state) => state.setLoadingStatus);
  const fastaDataImportDialogRef = useRef<FastaDataImportDialogRefMethods>(null);

  useEffect(() => {
    const removers = [
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      FastaDataEventBusService.getInstance().addEventListener('onShowImportDialog', (initialErrorMessage?: string) => {
        fastaDataImportDialogRef.current?.open(initialErrorMessage ? { initialErrorMessage } : undefined);
      }),
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      FastaDataEventBusService.getInstance().addEventListener('onCloseImportDialog', () => {
        fastaDataImportDialogRef.current?.close();
      }),
    ];
    return () => {
      removers.forEach((remove) => remove());
    };
  }, []);

  useEffect(() => {
    // Scan URL parameters for deep-linking
    const urlParams = new URLSearchParams(window.location.search);
    const inputFastaUrl = urlParams.get('input-fasta');
    const inputMetadataUrl = urlParams.get('input-metadata');

    const handleDeepLinking = async () => {
      if (inputFastaUrl) {
        setLoadingStatus(LOADING_STATUS.LOADING);
        try {
          const fastaRes = await fetch(inputFastaUrl);
          if (!fastaRes.ok) {
            throw new Error(`FASTA fetch failed (${fastaRes.status})`);
          }
          const fastaText = await fastaRes.text();

          if (!fastaText.trim()) {
            setLoadingStatus(LOADING_STATUS.ERROR);
            throw new Error('The input-fasta URL returned no sequence data. Check that the URL and requested accession(s) are correct.');
          }

          let metaText: string | undefined;
          if (inputMetadataUrl) {
            try {
              const metaRes = await fetch(inputMetadataUrl);
              if (metaRes.ok) {
                metaText = await metaRes.text();
              }
            } catch (metaErr) {
              console.warn('[App] Failed to auto-fetch metadata:', metaErr);
            }
          }

          await setData(fastaText, metaText);
        } catch (fastaErr) {
          console.error('[App] Failed to auto-load FASTA:', fastaErr);
          const message = fastaErr instanceof Error ? fastaErr.message : 'Failed to auto-load FASTA from the provided URL.';
          FastaDataEventBusService.getInstance().emit('onShowImportDialog', message);
        }
      } else {
        // PV1-02: Show data loading modal if no data provided via URL query params
        FastaDataEventBusService.getInstance().emit('onShowImportDialog');
      }
    };

    void handleDeepLinking();
  }, [setData, setLoadingStatus]);

  const handleError = useCallback((errorMessage: string) => {
    fastaDataImportDialogRef.current?.close();
    FastaDataEventBusService.getInstance().emit('onShowImportDialog', errorMessage);
  }, []);

  const onDataChange = useCallback(async (fastaContent: string, metadataContent?: string) => {
    try {
      await setData(fastaContent, metadataContent);
      fastaDataImportDialogRef.current?.close();
    } catch (e) {
      handleError(ErrorUtil.getErrorMessage(e, 'Unknown error'));
    } finally {
      // clear any search params from the URL
      UrlUtil.clearSearchParams();
    }
  }, [handleError, setData]);

  const onError = useCallback((errorMessage: unknown) => {
    handleError(ErrorUtil.getErrorMessage(errorMessage, 'Unknown error'));
  }, [handleError]);

  return (
    <>
      <FastaDataImportDialog
        extraActions={extraActions}
        onDataChange={onDataChange}
        onError={onError}
        ref={fastaDataImportDialogRef}
      />
    </>
  );
};
