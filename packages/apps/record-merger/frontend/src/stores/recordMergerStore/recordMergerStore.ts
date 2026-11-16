import { container } from 'tsyringe';
import { createStore } from 'zustand';
import type { FastaParseResult } from '@rivm-loculus-tools/common-frontend/models/fasta.models';
import { LOADING_STATUS } from '@rivm-loculus-tools/common-frontend/models/fasta.models';
import type { MetadataParseResult } from '@rivm-loculus-tools/common-frontend/models/metadata.models';
import type {
  FastaDataStoreActions,
  FastaDataStoreState,
} from '@rivm-loculus-tools/common-frontend/stores/fastaDataStore';
import {
  createFastaDataStoreActions,
  createFastaDataStoreInitialState,
} from '@rivm-loculus-tools/common-frontend/stores/fastaDataStore';
import { FastaUtil } from '@rivm-loculus-tools/common-frontend/utils/FastaUtil';

import { RecordMergerAioliService } from '../../classes/services/RecordMergerAioliService';
import type {
  AlignmentResult,
  ConsensusParams,
  ConsensusResult,
  RecordMergerStep,
} from '../../models/pipeline.models';
import { PIPELINE_STATUS } from '../../models/pipeline.models';

export type { RecordMergerStep };

export type RecordMergerStore = RecordMergerStoreActions & RecordMergerStoreState;

export interface RecordMergerStoreActions extends FastaDataStoreActions {
  clearSelection: () => void;
  resetDataset: () => void;
  resetPipeline: () => void;
  runAlignment: () => Promise<AlignmentResult | null>;
  runConsensus: () => Promise<ConsensusResult | null>;
  selectSequences: (ids: string[]) => void;
  setActiveStep: (step: RecordMergerStep) => void;
  setConsensusParams: (params: Partial<ConsensusParams>) => void;
  setFilterColumn: (column: null | string) => void;
  setFilterValue: (value: string) => void;
  setMergerData: (
    fastas: string | string[],
    referenceFasta: string,
    tsv?: string,
  ) => Promise<{ fastaResult: FastaParseResult; metadataResult?: MetadataParseResult; referenceResult: FastaParseResult }>;
  setSearchQuery: (query: string) => void;
  toggleSequenceSelection: (id: string) => void;
}

export interface RecordMergerStoreState extends FastaDataStoreState {
  activeStep: RecordMergerStep;
  alignmentResult: AlignmentResult | null;
  consensusResult: ConsensusResult | null;
  filterColumn: null | string;
  filterValue: string;
  parsedReferenceFasta: FastaParseResult | null;
  pipelineError: null | string;
  pipelineParams: ConsensusParams;
  pipelineStatus: PIPELINE_STATUS;
  rawReferenceFasta: string;
  searchQuery: string;
  selectedSequenceIds: string[];
}

const revokeAlignmentUrls = (result: AlignmentResult | null): void => {
  if (!result) {
    return;
  }
  URL.revokeObjectURL(result.bamBlobUrl);
  URL.revokeObjectURL(result.baiBlobUrl);
  URL.revokeObjectURL(result.referenceFastaBlobUrl);
  URL.revokeObjectURL(result.referenceFaiBlobUrl);
};

const createDefaultConsensusParams = (): ConsensusParams => ({
  callFract: 0.5,
  minDepth: 1,
  mode: 'simple',
  preset: 'asm5',
  showDel: false,
  showIns: true,
});

const createRecordMergerStoreInitialState = (): RecordMergerStoreState => ({
  ...createFastaDataStoreInitialState(),
  activeStep: 'SELECT_RECORDS',
  alignmentResult: null,
  consensusResult: null,
  filterColumn: null,
  filterValue: '',
  parsedReferenceFasta: null,
  pipelineError: null,
  pipelineParams: createDefaultConsensusParams(),
  pipelineStatus: PIPELINE_STATUS.IDLE,
  rawReferenceFasta: '',
  searchQuery: '',
  selectedSequenceIds: [],
});

export const recordMergerStore = createStore<RecordMergerStore>((set, get) => {
  const initialState = createRecordMergerStoreInitialState();
  const fastaDataStoreActions = createFastaDataStoreActions({ get, set });

  return {
    ...initialState,
    ...fastaDataStoreActions,
    clearSelection: () => set({ selectedSequenceIds: [] }),
    resetDataset: () => {
      get().resetPipeline();
      fastaDataStoreActions.resetDataset();
      set({
        activeStep: 'SELECT_RECORDS',
        filterColumn: null,
        filterValue: '',
        parsedReferenceFasta: null,
        rawReferenceFasta: '',
        searchQuery: '',
        selectedSequenceIds: [],
      });
    },
    resetPipeline: () => {
      revokeAlignmentUrls(get().alignmentResult);
      set({
        activeStep: 'SELECT_RECORDS',
        alignmentResult: null,
        consensusResult: null,
        pipelineError: null,
        pipelineStatus: PIPELINE_STATUS.IDLE,
      });
    },
    runAlignment: async () => {
      const {
        alignmentResult: previousAlignment,
        parsedFasta,
        parsedReferenceFasta,
        pipelineParams,
        selectedSequenceIds,
      } = get();

      const referenceSequence = parsedReferenceFasta?.sequences?.[0];
      if (!referenceSequence) {
        const message = 'Please load a valid reference FASTA sequence before running alignment.';
        set({ pipelineError: message, pipelineStatus: PIPELINE_STATUS.ERROR });
        return null;
      }

      const selectedSet = new Set(selectedSequenceIds);
      const selectedSequences = (parsedFasta?.sequences ?? []).filter((seq) => selectedSet.has(seq.id));
      if (selectedSequences.length === 0) {
        const message = 'Select at least one input FASTA record to align.';
        set({ pipelineError: message, pipelineStatus: PIPELINE_STATUS.ERROR });
        return null;
      }

      revokeAlignmentUrls(previousAlignment);
      set({
        alignmentResult: null,
        consensusResult: null,
        pipelineError: null,
        pipelineStatus: PIPELINE_STATUS.ALIGNING,
      });

      try {
        const service = container.resolve(RecordMergerAioliService);
        const result = await service.runAlignment({
          onStageChange: (stage) => set({ pipelineStatus: stage }),
          preset: pipelineParams.preset,
          referenceSequence,
          selectedSequences,
        });

        set({
          activeStep: 'INSPECT_ALIGNMENT',
          alignmentResult: result,
          pipelineError: null,
          pipelineStatus: PIPELINE_STATUS.SUCCESS,
        });
        return result;
      } catch (err: unknown) {
        console.error('[recordMergerStore] Error during Biowasm alignment execution:', err);
        const message = err instanceof Error ? err.message : 'Failed to execute sequence alignment.';
        set({
          pipelineError: message,
          pipelineStatus: PIPELINE_STATUS.ERROR,
        });
        return null;
      }
    },
    runConsensus: async () => {
      const { alignmentResult, pipelineParams } = get();
      if (!alignmentResult) {
        const message = 'Please run sequence alignment before calling consensus.';
        set({ pipelineError: message, pipelineStatus: PIPELINE_STATUS.ERROR });
        return null;
      }

      set({
        consensusResult: null,
        pipelineError: null,
        pipelineStatus: PIPELINE_STATUS.CALLING_CONSENSUS,
      });

      try {
        const service = container.resolve(RecordMergerAioliService);
        const result = await service.runConsensus({
          alignmentResult,
          onStageChange: (stage) => set({ pipelineStatus: stage }),
          params: pipelineParams,
        });

        set({
          activeStep: 'REVIEW_MERGE',
          consensusResult: result,
          pipelineError: null,
          pipelineStatus: PIPELINE_STATUS.SUCCESS,
        });
        return result;
      } catch (err: unknown) {
        console.error('[recordMergerStore] Error during Biowasm consensus calling:', err);
        const message = err instanceof Error ? err.message : 'Failed to execute samtools consensus.';
        set({
          pipelineError: message,
          pipelineStatus: PIPELINE_STATUS.ERROR,
        });
        return null;
      }
    },
    selectSequences: (ids: string[]) => set({ selectedSequenceIds: Array.from(new Set(ids)) }),
    setActiveStep: (step: RecordMergerStep) => set({ activeStep: step }),
    setConsensusParams: (params: Partial<ConsensusParams>) => {
      set((state) => ({
        pipelineParams: {
          ...state.pipelineParams,
          ...params,
        },
      }));
    },
    setFilterColumn: (column: null | string) => set({ filterColumn: column, filterValue: '' }),
    setFilterValue: (value: string) => set({ filterValue: value }),
    setMergerData: async (fastas: string | string[], referenceFasta: string, tsv?: string) => {
      let mergedFasta: string;
      let parsedReference: FastaParseResult;

      try {
        mergedFasta = Array.isArray(fastas) ? FastaUtil.mergeFastas(fastas) : fastas;
        parsedReference = FastaUtil.parseFasta(referenceFasta);
        if (parsedReference.error || parsedReference.sequences.length === 0) {
          throw new Error(parsedReference.error ?? 'Reference FASTA contains no valid sequences.');
        }
      } catch (err: unknown) {
        get().resetDataset();
        const message = err instanceof Error ? err.message : 'Failed to parse input FASTA or reference FASTA.';
        set({
          loadingError: message,
          loadingStatus: LOADING_STATUS.ERROR,
        });
        throw err;
      }

      get().resetPipeline();
      const result = await fastaDataStoreActions.setData(mergedFasta, tsv);
      const selectedSequenceIds = result.fastaResult.sequences.map((seq) => seq.id);

      set({
        activeStep: 'SELECT_RECORDS',
        filterColumn: null,
        filterValue: '',
        parsedReferenceFasta: parsedReference,
        rawReferenceFasta: referenceFasta,
        searchQuery: '',
        selectedSequenceIds,
      });

      return {
        ...result,
        referenceResult: parsedReference,
      };
    },
    setSearchQuery: (query: string) => set({ searchQuery: query }),
    toggleSequenceSelection: (id: string) => {
      set((state) => {
        const exists = state.selectedSequenceIds.includes(id);
        return {
          selectedSequenceIds: exists
            ? state.selectedSequenceIds.filter((item) => item !== id)
            : [...state.selectedSequenceIds, id],
        };
      });
    },
  };
});
