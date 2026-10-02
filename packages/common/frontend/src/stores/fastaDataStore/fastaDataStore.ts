import type { FastaParseResult } from '../../models/fasta';
import { CALCULATION_STATUS } from '../../models/fasta';
import type { MetadataParseResult } from '../../models/metadata';
import { FastaUtil } from '../../utils/FastaUtil';
import { MetaDataUtil } from '../../utils/MetaDataUtil';

export type FastaDataStore = FastaDataStoreActions & FastaDataStoreState;

export interface FastaDataStoreActions {
  resetDataset: () => void;
  setCalculationStatus: (status: CALCULATION_STATUS) => void;
  setColumnMatchCounts: (counts: Record<string, number>) => void;
  setData: (fasta: string, tsv?: string) => Promise<{ fastaResult: FastaParseResult; metadataResult: MetadataParseResult }>;
  setMatchKeyField: (field: null | string) => void;
}

export interface FastaDataStoreState {
  calculationStatus: CALCULATION_STATUS;
  columnMatchCounts: Record<string, number>;
  matchKeyField: null | string;
  parsedFasta: FastaParseResult | null;
  parsedMetadata: MetadataParseResult | null;
  rawFasta: string;
  rawMetadata: string;
}

export const createFastaDataStoreInitialState = (): FastaDataStoreState => ({
  calculationStatus: CALCULATION_STATUS.IDLE,
  columnMatchCounts: {},
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
    setCalculationStatus: (status: CALCULATION_STATUS) => set({ calculationStatus: status }),
    setColumnMatchCounts: (counts: Record<string, number>) => set({ columnMatchCounts: counts }),
    setData: async (fasta: string, tsv?: string) => {
      let metadataResult: MetadataParseResult;
      if (tsv) {
        metadataResult = MetaDataUtil.parseTsv(tsv);
        set({
          parsedMetadata: metadataResult,
          rawMetadata: tsv,
        });

        const currentFasta = get().parsedFasta;
        if (metadataResult && currentFasta && currentFasta.sequences.length > 0) {
          const fastaIds = currentFasta.sequences.map((s) => s.id);
          const { bestColumn, matchCounts } = MetaDataUtil.findBestMatchingColumn(
            metadataResult.columns,
            metadataResult.recordsByColumn,
            fastaIds,
          );
          get().setColumnMatchCounts(matchCounts);
          get().setMatchKeyField(bestColumn);
        } else if (metadataResult && metadataResult.columns.length > 0) {
          // Default to best candidate
          const prioritized = ['displayName', 'accessionVersion', 'accession', 'SampleID', 'id', 'strain'];
          const defaultCol = prioritized.find((p) => metadataResult.columns.includes(p)) || metadataResult.columns[0];
          get().setMatchKeyField(defaultCol);
        }
      }


      const fastaResult = FastaUtil.parseFasta(fasta);
      set({
        parsedFasta: fastaResult,
        rawFasta: fasta,
      });

      if (metadataResult && fastaResult.sequences.length > 0) {
        const fastaIds = fastaResult.sequences.map((s) => s.id);
        const { bestColumn, matchCounts } = MetaDataUtil.findBestMatchingColumn(
          metadataResult.columns,
          metadataResult.recordsByColumn,
          fastaIds,
        );
        get().setColumnMatchCounts(matchCounts);
        get().setMatchKeyField(bestColumn);
      }

      return Promise.resolve({ fastaResult, metadataResult });
    },
    setMatchKeyField: (field: null | string) => set({ matchKeyField: field }),
  };
};
