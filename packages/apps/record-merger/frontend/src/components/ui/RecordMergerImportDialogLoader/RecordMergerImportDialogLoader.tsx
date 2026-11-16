import { container } from 'tsyringe';
import type { DialogAction } from '@gen-epix/ui-core-components/components/Dialog';
import {
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { useStore } from 'zustand';
import { FastaDataEventBusService } from '@rivm-loculus-tools/common-frontend/classes/services/FastaDataEventBusService';
import { LoculusService } from '@rivm-loculus-tools/common-frontend/classes/services/LoculusService';
import { UrlService } from '@rivm-loculus-tools/common-frontend/classes/services/UrlService';
import { LOADING_STATUS } from '@rivm-loculus-tools/common-frontend/models/fasta.models';
import { ErrorUtil } from '@rivm-loculus-tools/common-frontend/utils/ErrorUtil';
import { UrlUtil } from '@rivm-loculus-tools/common-frontend/utils/UrlUtil';

import { recordMergerStore } from '../../../stores/recordMergerStore';
import type { RecordMergerImportDialogRefMethods } from '../RecordMergerImportDialog';
import { RecordMergerImportDialog } from '../RecordMergerImportDialog';

export type RecordMergerImportDialogLoaderProps = {
  extraActions?: DialogAction[];
};

const fetchRequiredResourceText = async (url: string, label: string): Promise<string> => {
  if (!UrlUtil.isValidResourceUrl(url)) {
    throw new Error(`Invalid ${label} URL.`);
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${label} fetch failed (${response.status})`);
  }
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`The ${label} URL returned no sequence data.`);
  }
  return text;
};

export const RecordMergerImportDialogLoader = ({ extraActions }: RecordMergerImportDialogLoaderProps) => {
  const setMergerData = useStore(recordMergerStore, (state) => state.setMergerData);
  const setLoadingStatus = useStore(recordMergerStore, (state) => state.setLoadingStatus);
  const importDialogRef = useRef<RecordMergerImportDialogRefMethods>(null);

  useEffect(() => {
    const eventBus = container.resolve(FastaDataEventBusService);
    const removers = [
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      eventBus.addEventListener('onShowImportDialog', (initialErrorMessage?: string) => {
        importDialogRef.current?.open(initialErrorMessage ? { initialErrorMessage } : undefined);
      }),
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      eventBus.addEventListener('onCloseImportDialog', () => {
        importDialogRef.current?.close();
      }),
    ];
    return () => {
      removers.forEach((remove) => remove());
    };
  }, []);

  useEffect(() => {
    const {
      inputFastaUrl,
      inputFastaUrls,
      inputMetadataUrl,
      inputReferenceUrl,
    } = UrlService.getParamsFromUrl(window.location.href);

    let fastaUrls: string[] = [];
    if (inputFastaUrls && inputFastaUrls.length > 0) {
      fastaUrls = inputFastaUrls;
    } else if (inputFastaUrl) {
      fastaUrls = [inputFastaUrl];
    }

    const fetchMetadata = async (): Promise<string | undefined> => {
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
        console.warn('[RecordMergerImportDialogLoader] Failed to auto-fetch metadata:', metaErr);
        return undefined;
      }
    };

    const loadDeepLinkedData = async () => {
      if (!inputReferenceUrl) {
        throw new Error('Missing required input-reference URL parameter.');
      }
      setLoadingStatus(LOADING_STATUS.LOADING);
      try {
        const [fastaTexts, referenceText, metaText] = await Promise.all([
          Promise.all(fastaUrls.map(async (url) => await fetchRequiredResourceText(url, 'input-fasta'))),
          fetchRequiredResourceText(inputReferenceUrl, 'input-reference'),
          fetchMetadata(),
        ]);
        await setMergerData(fastaTexts, referenceText, metaText);
      } catch (err: unknown) {
        console.error('[RecordMergerImportDialogLoader] Failed to auto-load data:', err);
        setLoadingStatus(LOADING_STATUS.ERROR);
        const message = ErrorUtil.getErrorMessage(err, 'Failed to auto-load data from the provided URLs.');
        container.resolve(FastaDataEventBusService).emit('onShowImportDialog', message);
      }
    };

    const handleDeepLinking = async () => {
      if (fastaUrls.length > 0 && inputReferenceUrl) {
        await loadDeepLinkedData();
        return;
      }
      if (fastaUrls.length > 0 || inputReferenceUrl) {
        const missingParam = fastaUrls.length === 0 ? 'input-fasta' : 'input-reference';
        container
          .resolve(FastaDataEventBusService)
          .emit('onShowImportDialog', `Both input-fasta and input-reference URL parameters are required (missing ${missingParam}).`);
        return;
      }
      container.resolve(FastaDataEventBusService).emit('onShowImportDialog');
    };

    void handleDeepLinking();
  }, [setLoadingStatus, setMergerData]);

  const showDialogError = useCallback((errorMessage: string) => {
    importDialogRef.current?.close();
    container.resolve(FastaDataEventBusService).emit('onShowImportDialog', errorMessage);
  }, []);

  const onDataChange = useCallback(async (fastaContents: string[], referenceContent: string, metadataContent?: string) => {
    try {
      await setMergerData(fastaContents, referenceContent, metadataContent);
      importDialogRef.current?.close();
    } catch (e: unknown) {
      showDialogError(ErrorUtil.getErrorMessage(e, 'Unknown error'));
    } finally {
      UrlUtil.clearSearchParams();
      container.resolve(LoculusService).clear();
    }
  }, [setMergerData, showDialogError]);

  const onError = useCallback((errorMessage: unknown) => {
    showDialogError(ErrorUtil.getErrorMessage(errorMessage, 'Unknown error'));
  }, [showDialogError]);

  return (
    <RecordMergerImportDialog
      extraActions={extraActions}
      onDataChange={onDataChange}
      onError={onError}
      ref={importDialogRef}
    />
  );
};
