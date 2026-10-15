import type { StoreApi } from 'zustand';

import type { FastaParseResult } from '../../models/fasta';
import { LOADING_STATUS } from '../../models/fasta';
import type { MetadataParseResult } from '../../models/metadata';
import { FastaUtil } from '../../utils/FastaUtil';
import { MetaDataUtil } from '../../utils/MetaDataUtil';

export type FastaDataStore = FastaDataStoreActions & FastaDataStoreState;

export interface FastaDataStoreActions {
  resetDataset: () => void;
  setColumnMatchCounts: (counts: Record<string, number>) => void;
  setData: (fasta: string, tsv?: string) => Promise<{ fastaResult: FastaParseResult; metadataResult?: MetadataParseResult }>;
  setLoadingStatus: (status: LOADING_STATUS) => void;
  setMatchKeyField: (field: null | string) => void;
}

export interface FastaDataStoreState {
  columnMatchCounts: Record<string, number>;
  loadingError: null | string;
  loadingStatus: LOADING_STATUS;
  matchKeyField: null | string;
  parsedFasta: FastaParseResult | null;
  parsedMetadata: MetadataParseResult | null;
  rawFasta: string;
  rawMetadata: string;
}

export const createFastaDataStoreInitialState = (): FastaDataStoreState => ({
  columnMatchCounts: {},
  loadingError: null,
  loadingStatus: LOADING_STATUS.IDLE,
  matchKeyField: null,
  parsedFasta: null,
  parsedMetadata: null,
  rawFasta: '',
  rawMetadata: '',
});


type Get<T extends FastaDataStore> = StoreApi<T>['getState'];
type Set<T extends FastaDataStore> = StoreApi<T>['setState'];

export const createFastaDataStoreActions = <T extends FastaDataStore>(kwArgs: { get: Get<T>; set: Set<T> }): FastaDataStoreActions => {
  const { get, set } = kwArgs;
  const setBaseState = (partial: Partial<FastaDataStoreState>) => set(partial as Partial<T>);

  return {
    resetDataset: () => setBaseState(createFastaDataStoreInitialState()),
    setColumnMatchCounts: (counts: Record<string, number>) => setBaseState({ columnMatchCounts: counts }),
    setData: async (fasta: string, tsv?: string) => {
      const { resetDataset } = get();
      resetDataset();
      const parsedFasta = FastaUtil.parseFasta(fasta);

      if (parsedFasta.error) {
        setBaseState({
          loadingError: parsedFasta.error,
          loadingStatus: LOADING_STATUS.ERROR,
        });
        throw new Error(parsedFasta.error);
      }

      setBaseState({
        parsedFasta,
        rawFasta: fasta,
      });

      let parsedMetadata: MetadataParseResult | undefined;
      if (tsv) {
        parsedMetadata = MetaDataUtil.parseTsv(tsv);
        if (parsedMetadata.error) {
          setBaseState({
            loadingError: parsedMetadata.error,
            loadingStatus: LOADING_STATUS.ERROR,
          });
          throw new Error(parsedMetadata.error);
        }

        setBaseState({
          parsedMetadata,
          rawMetadata: tsv,
        });

        const fastaIds = parsedFasta.sequences.map((s) => s.id);
        const { bestColumn, matchCounts } = MetaDataUtil.findBestMatchingColumn(
          parsedMetadata.columns,
          parsedMetadata.recordsByColumn,
          fastaIds,
        );
        get().setColumnMatchCounts(matchCounts);
        get().setMatchKeyField(bestColumn);
      }

      setBaseState({
        loadingError: null,
        loadingStatus: LOADING_STATUS.SUCCESS,
      });
      return Promise.resolve({ fastaResult: parsedFasta, metadataResult: parsedMetadata });
    },
    setLoadingStatus: (status: LOADING_STATUS) => setBaseState({ loadingStatus: status }),
    setMatchKeyField: (field: null | string) => setBaseState({ matchKeyField: field }),
  };
};
