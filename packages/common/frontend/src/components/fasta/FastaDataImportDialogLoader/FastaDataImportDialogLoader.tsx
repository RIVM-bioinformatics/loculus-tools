import { container } from 'tsyringe';
import type { DialogAction } from '@gen-epix/ui-core-components/components/Dialog';
import {
  useCallback,
  useEffect,
  useRef,
} from 'react';
import type { StoreApi } from 'zustand';
import { useStore } from 'zustand';

import { FastaDataEventBusService } from '../../../classes/services/FastaDataEventBusService';
import { UrlService } from '../../../classes/services/UrlService';
import { LOADING_STATUS } from '../../../models/fasta.models';
import type { FastaDataStore } from '../../../stores/fastaDataStore';
import { UrlUtil } from '../../../utils/UrlUtil';
import type { FastaDataImportDialogRefMethods } from '../FastaDataImportDialog';
import { FastaDataImportDialog } from '../FastaDataImportDialog';
import { ErrorUtil } from '../../../utils/ErrorUtil';
import { LoculusService } from '../../../classes/services/LoculusService';


export type FastaDataImportDialogLoaderProps = {
  extraActions?: DialogAction[];
  fastaDescription?: string;
  store: StoreApi<FastaDataStore>;
};

export const FastaDataImportDialogLoader = ({ extraActions, fastaDescription, store }: FastaDataImportDialogLoaderProps) => {
  const setData = useStore(store, (state) => state.setData);
  const setLoadingStatus = useStore(store, (state) => state.setLoadingStatus);
  const fastaDataImportDialogRef = useRef<FastaDataImportDialogRefMethods>(null);

  useEffect(() => {
    const removers = [
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      container.resolve(FastaDataEventBusService).addEventListener('onShowImportDialog', (initialErrorMessage?: string) => {
        fastaDataImportDialogRef.current?.open(initialErrorMessage ? { initialErrorMessage } : undefined);
      }),
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      container.resolve(FastaDataEventBusService).addEventListener('onCloseImportDialog', () => {
        fastaDataImportDialogRef.current?.close();
      }),
    ];
    return () => {
      removers.forEach((remove) => remove());
    };
  }, []);

  useEffect(() => {
    // Scan URL parameters for deep-linking
    const { inputFastaUrl, inputMetadataUrl } = UrlService.getParamsFromUrl(window.location.href);

    const fetchFasta = async () => {
      if (!inputFastaUrl || !UrlUtil.isValidResourceUrl(inputFastaUrl)) {
        throw new Error('Invalid input-fasta URL.');
      }
      const fastaRes = await fetch(inputFastaUrl);
      if (!fastaRes.ok) {
        throw new Error(`FASTA fetch failed (${fastaRes.status})`);
      }
      const fastaText = await fastaRes.text();
      if (!fastaText.trim()) {
        setLoadingStatus(LOADING_STATUS.ERROR);
        throw new Error('The input-fasta URL returned no sequence data. Check that the URL and requested accession(s) are correct.');
      }
      return fastaText;
    };

    const fetchMetadata = async () => {
      if (!inputMetadataUrl) {
        return undefined;
      }
      try {
        if (!UrlUtil.isValidResourceUrl(inputMetadataUrl)) {
          throw new Error('Invalid input-metadata URL.');
        }
        const metaRes = await fetch(inputMetadataUrl);
        return metaRes.ok ? await metaRes.text() : undefined;
      } catch (metaErr) {
        console.warn('[App] Failed to auto-fetch metadata:', metaErr);
        return undefined;
      }
    };

    const loadDeepLinkedData = async () => {
      setLoadingStatus(LOADING_STATUS.LOADING);
      try {
        const fastaText = await fetchFasta();
        const metaText = await fetchMetadata();
        await setData(fastaText, metaText);
      } catch (fastaErr) {
        console.error('[App] Failed to auto-load FASTA:', fastaErr);
        const message = fastaErr instanceof Error ? fastaErr.message : 'Failed to auto-load FASTA from the provided URL.';
        container.resolve(FastaDataEventBusService).emit('onShowImportDialog', message);
      }
    };

    const handleDeepLinking = async () => {
      if (inputFastaUrl) {
        await loadDeepLinkedData();
        return;
      }
      // PV1-02: Show data loading modal if no data provided via URL query params
      container.resolve(FastaDataEventBusService).emit('onShowImportDialog');
    };

    void handleDeepLinking();
  }, [setData, setLoadingStatus]);

  const handleError = useCallback((errorMessage: string) => {
    fastaDataImportDialogRef.current?.close();
    container.resolve(FastaDataEventBusService).emit('onShowImportDialog', errorMessage);
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
      container.resolve(LoculusService).clear();
    }
  }, [handleError, setData]);

  const onError = useCallback((errorMessage: unknown) => {
    handleError(ErrorUtil.getErrorMessage(errorMessage, 'Unknown error'));
  }, [handleError]);

  return (
    <>
      <FastaDataImportDialog
        extraActions={extraActions}
        fastaDescription={fastaDescription}
        onDataChange={onDataChange}
        onError={onError}
        ref={fastaDataImportDialogRef}
      />
    </>
  );
};
