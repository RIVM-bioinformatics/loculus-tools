import type { FastaParseResult } from '../../models/fasta';
import { LOADING_STATUS } from '../../models/fasta';
import type { MetadataParseResult } from '../../models/metadata';
import { FastaUtil } from '../../utils/FastaUtil';
import { MetaDataUtil } from '../../utils/MetaDataUtil';

export type FastaDataStore = FastaDataStoreActions & FastaDataStoreState;

export interface FastaDataStoreActions {
  resetDataset: () => void;
  setColumnMatchCounts: (counts: Record<string, number>) => void;
  setData: (fasta: string, tsv?: string) => Promise<{ fastaResult: FastaParseResult; metadataResult: MetadataParseResult }>;
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


type Get = () => FastaDataStore;
type Set = (partial: ((state: FastaDataStore) => FastaDataStore | Partial<FastaDataStore>) | FastaDataStore | Partial<FastaDataStore>, replace?: false) => void;

export const createFastaDataStoreActions = (kwArgs: { get: Get; set: Set }): FastaDataStoreActions => {
  const { get, set } = kwArgs;
  return {
    resetDataset: () => set(createFastaDataStoreInitialState()),
    setColumnMatchCounts: (counts: Record<string, number>) => set({ columnMatchCounts: counts }),
    setData: async (fasta: string, tsv?: string) => {
      const parsedFasta = FastaUtil.parseFasta(fasta);

      if (parsedFasta.error) {
        set({
          loadingError: parsedFasta.error,
          loadingStatus: LOADING_STATUS.ERROR,
        });
        throw new Error(parsedFasta.error);
      }

      set({
        parsedFasta,
        rawFasta: fasta,
      });

      let parsedMetadata: MetadataParseResult;
      if (tsv) {
        parsedMetadata = MetaDataUtil.parseTsv(tsv);
        if (parsedMetadata.error) {
          set({
            loadingError: parsedMetadata.error,
            loadingStatus: LOADING_STATUS.ERROR,
          });
          throw new Error(parsedMetadata.error);
        }

        set({
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

      set({
        loadingError: null,
        loadingStatus: LOADING_STATUS.SUCCESS,
      });

      return Promise.resolve({ fastaResult: parsedFasta, metadataResult: parsedMetadata });
    },
    setLoadingStatus: (status: LOADING_STATUS) => set({ loadingStatus: status }),
    setMatchKeyField: (field: null | string) => set({ matchKeyField: field }),
  };
};
