import { createStore } from 'zustand';
import {
  createJSONStorage,
  persist,
} from 'zustand/middleware';
import { container } from 'tsyringe';
import type {
  FastaDataStoreActions,
  FastaDataStoreState,
} from '@rivm-loculus-tools/common-frontend/stores/fastaDataStore';
import {
  createFastaDataStoreActions,
  createFastaDataStoreInitialState,
} from '@rivm-loculus-tools/common-frontend/stores/fastaDataStore';
import type {
  FastaParseResult,
  FastaSequence,
} from '@rivm-loculus-tools/common-frontend/models/fasta.models';
import { LOADING_STATUS } from '@rivm-loculus-tools/common-frontend/models/fasta.models';
import type { MetadataParseResult } from '@rivm-loculus-tools/common-frontend/models/metadata.models';
import { FastaUtil } from '@rivm-loculus-tools/common-frontend/utils/FastaUtil';
import { MetaDataUtil } from '@rivm-loculus-tools/common-frontend/utils/MetaDataUtil';

import type {
  EditorSelection,
  EngineMeta,
  EngineSearchResult,
} from '../../models/editor.models';
import {
  ALI_VIEW_DEFAULT_AMINO_ACID_PALETTE,
  ALI_VIEW_DEFAULT_NUCLEOTIDE_PALETTE,
} from '../../constants';
import { CUSTOM_PALETTE_NAME } from '../../models/palette.models';
import type {
  AminoAcidPalette,
  NucleotidePalette,
} from '../../models/palette.models';
import { EngineErrorUtil } from '../../utils/EngineErrorUtil';
import { EditorWorkerService } from '../../classes/services/EditorWorkerService';
import { SequenceEditorEventBusService } from '../../classes/services/SequenceEditorEventBusService';

export type SequenceEditorStore = SequenceEditorStoreActions & SequenceEditorStoreState;

export interface SequenceEditorStoreActions extends FastaDataStoreActions {
  setAminoAcidPalette: (palette: AminoAcidPalette) => void;
  setCustomAminoAcidPalette: (palette: AminoAcidPalette) => void;
  setCustomNucleotidePalette: (palette: NucleotidePalette) => void;
  setIsRealigning: (isRealigning: boolean) => void;
  setLatestMessage: (message: null | string) => void;
  setMeta: (meta: EngineMeta | null) => void;
  setNucleotidePalette: (palette: NucleotidePalette) => void;
  setSearchQuery: (query: string) => void;
  setSearchResult: (results: EngineSearchResult | null) => void;
  setSearchResultHighlightedIndex: (index: null | number) => void;
  setSelection: (selection: EditorSelection | null) => void;
}

export interface SequenceEditorStoreState extends FastaDataStoreState {
  aminoAcidPalette: AminoAcidPalette;
  customAminoAcidPalette: AminoAcidPalette;
  customNucleotidePalette: NucleotidePalette;
  isRealigning: boolean;
  latestMessage: null | string;
  meta: EngineMeta | null;
  nucleotidePalette: NucleotidePalette;
  searchQuery: string;
  searchResult: EngineSearchResult | null;
  searchResultHighlightedIndex: null | number;
  selection: EditorSelection | null;
}

const createSequenceEditorStoreInitialState = (): SequenceEditorStoreState => ({
  ...createFastaDataStoreInitialState(),
  aminoAcidPalette: ALI_VIEW_DEFAULT_AMINO_ACID_PALETTE,
  customAminoAcidPalette: {
    name: CUSTOM_PALETTE_NAME,
    paletteColors: { ...ALI_VIEW_DEFAULT_AMINO_ACID_PALETTE.paletteColors },
  },
  customNucleotidePalette: {
    name: CUSTOM_PALETTE_NAME,
    paletteColors: { ...ALI_VIEW_DEFAULT_NUCLEOTIDE_PALETTE.paletteColors },
  },
  isRealigning: false,
  latestMessage: null,
  meta: null,
  nucleotidePalette: ALI_VIEW_DEFAULT_NUCLEOTIDE_PALETTE,
  searchQuery: '',
  searchResult: null,
  searchResultHighlightedIndex: null,
  selection: null,
});

const computeAlignmentMetadata = (sequences: FastaSequence[]): Pick<FastaParseResult, 'expectedLength' | 'invalidSequences' | 'isAligned'> => {
  const expectedLength = sequences.reduce((max, s) => Math.max(max, s.length), 0);
  const invalidSequences = sequences
    .filter((s) => s.length !== expectedLength)
    .map((s) => ({ id: s.id, length: s.length }));
  const isAligned = invalidSequences.length === 0;

  return {
    expectedLength,
    invalidSequences: isAligned ? undefined : invalidSequences,
    isAligned,
  };
};

export const sequenceEditorStore = createStore<SequenceEditorStore>()(
  persist(
    (set, get) => {
      let removedSequenceBatches: FastaSequence[][] = [];
      let syntheticSequenceCounter = 0;
      // Incremented on every reset so in-flight loads can detect that their session was discarded.
      let sessionGeneration = 0;
      let activeLoadQueue: Promise<unknown> = Promise.resolve();
      const createSupersededError = () => new DOMException('FASTA load was superseded by a dataset reset', 'AbortError');

      container.resolve(EditorWorkerService).setMessageHandler((message) => {
        if (get().latestMessage !== message) {
          set({ latestMessage: message });
        }
      });
      const initialState = createSequenceEditorStoreInitialState();
      const fastaDataStoreActions = createFastaDataStoreActions({ get, set });

      const executeSetData = async (fasta: string, tsv?: string) => {
        const existingParsedFasta = get().parsedFasta;
        const hasExistingSession = (existingParsedFasta?.sequences.length ?? 0) > 0;
        if (hasExistingSession && existingParsedFasta && !fasta.trim() && !tsv) {
          return {
            fastaResult: existingParsedFasta,
            metadataResult: get().parsedMetadata || undefined,
          };
        }
        const parsedFasta = FastaUtil.parseFasta(fasta);

        if (parsedFasta.error) {
          if (hasExistingSession) {
            set({
              latestMessage: parsedFasta.error,
              loadingStatus: LOADING_STATUS.SUCCESS,
            });
          } else {
            set({
              loadingError: parsedFasta.error,
              loadingStatus: LOADING_STATUS.ERROR,
            });
          }
          throw new Error(parsedFasta.error);
        }

        let parsedMetadata: MetadataParseResult | undefined;
        if (tsv) {
          parsedMetadata = MetaDataUtil.parseTsv(tsv);
          if (parsedMetadata.error) {
            if (hasExistingSession) {
              set({
                latestMessage: parsedMetadata.error,
                loadingStatus: LOADING_STATUS.SUCCESS,
              });
            } else {
              set({
                loadingError: parsedMetadata.error,
                loadingStatus: LOADING_STATUS.ERROR,
              });
            }
            throw new Error(parsedMetadata.error);
          }
        }

        const generation = sessionGeneration;

        try {
          const editorWorkerService = container.resolve(EditorWorkerService);
          if (!hasExistingSession) {
            // Guarantee a new session starts from an empty engine, even if a previous reset failed.
            await editorWorkerService.reset();
          }
          if (generation !== sessionGeneration) {
            throw createSupersededError();
          }
          await editorWorkerService.loadFasta(fasta);
        } catch (error: unknown) {
          if (generation !== sessionGeneration) {
            throw createSupersededError();
          }
          const errorMessage = EngineErrorUtil.getEngineErrorMessage(error);
          const hasSessionOnError = (get().parsedFasta?.sequences.length ?? 0) > 0;
          if (hasSessionOnError) {
            set({
              latestMessage: errorMessage,
              loadingStatus: LOADING_STATUS.SUCCESS,
            });
          } else {
            set({
              loadingError: errorMessage,
              loadingStatus: LOADING_STATUS.ERROR,
            });
          }
          throw error;
        }

        if (generation !== sessionGeneration) {
          // A reset happened while the load was in flight; the queued engine reset clears the
          // loaded rows, so committing them here would desynchronize the store from the engine.
          throw createSupersededError();
        }

        removedSequenceBatches = [];
        const currentState = get();
        const existingSequences = currentState.parsedFasta?.sequences || [];
        // Sequence bodies are intentionally cleared: the WASM engine owns the alignment and
        // stored bodies would go stale after the first edit. Read sequence data through
        // EditorWorkerService (viewport/export) instead.
        const newSequences: FastaSequence[] = parsedFasta.sequences.map((s) => ({
          ...s,
          sequence: '',
        }));
        const combinedSequences: FastaSequence[] = [
          ...newSequences,
          ...existingSequences,
        ];

        const updatedParsedFasta: FastaParseResult = {
          ...parsedFasta,
          ...computeAlignmentMetadata(combinedSequences),
          sequences: combinedSequences,
        };

        const updatedRawFasta = currentState.rawFasta
          ? `${fasta.trimEnd()}\n${currentState.rawFasta}`
          : fasta;

        if (tsv && parsedMetadata) {
          set({
            parsedMetadata,
            rawMetadata: tsv,
          });

          const fastaIds = combinedSequences.map((s) => s.id);
          const { bestColumn, matchCounts } = MetaDataUtil.findBestMatchingColumn(
            parsedMetadata.columns,
            parsedMetadata.recordsByColumn,
            fastaIds,
          );
          get().setColumnMatchCounts(matchCounts);
          get().setMatchKeyField(bestColumn);
        } else if (currentState.parsedMetadata) {
          const fastaIds = combinedSequences.map((s) => s.id);
          const { bestColumn, matchCounts } = MetaDataUtil.findBestMatchingColumn(
            currentState.parsedMetadata.columns,
            currentState.parsedMetadata.recordsByColumn,
            fastaIds,
          );
          get().setColumnMatchCounts(matchCounts);
          get().setMatchKeyField(bestColumn);
        }

        set({
          loadingError: null,
          loadingStatus: LOADING_STATUS.SUCCESS,
          parsedFasta: updatedParsedFasta,
          rawFasta: updatedRawFasta,
        });

        container.resolve(SequenceEditorEventBusService).emit('onSequencesPrepended');

        return {
          fastaResult: updatedParsedFasta,
          metadataResult: parsedMetadata || currentState.parsedMetadata || undefined,
        };
      };

      return {
        ...initialState,
        ...fastaDataStoreActions,
        resetDataset: () => {
          sessionGeneration++;
          removedSequenceBatches = [];
          syntheticSequenceCounter = 0;
          const { setSearchQuery } = get();
          fastaDataStoreActions.resetDataset();
          setSearchQuery('');
          set({
            isRealigning: false,
            latestMessage: null,
            meta: null,
            searchResult: null,
            searchResultHighlightedIndex: null,
            selection: null,
          });
          container.resolve(EditorWorkerService).reset().catch((error: unknown) => {
            console.error('Failed to reset sequence editor engine:', error);
            set({ latestMessage: EngineErrorUtil.getEngineErrorMessage(error) });
          });
        },
        setAminoAcidPalette: (palette: AminoAcidPalette) => set({ aminoAcidPalette: palette }),
        setCustomAminoAcidPalette: (palette: AminoAcidPalette) => set({ customAminoAcidPalette: palette }),
        setCustomNucleotidePalette: (palette: NucleotidePalette) => set({ customNucleotidePalette: palette }),
        setData: async (fasta: string, tsv?: string) => {
          const initialGeneration = sessionGeneration;
          const nextLoad = activeLoadQueue
            .catch(() => undefined)
            .then(async () => {
              if (initialGeneration !== sessionGeneration) {
                throw createSupersededError();
              }
              return await executeSetData(fasta, tsv);
            });
          activeLoadQueue = nextLoad;
          return await nextLoad;
        },
        setIsRealigning: (isRealigning: boolean) => set({ isRealigning }),
        setLatestMessage: (message: null | string) => set({ latestMessage: message }),
        setMeta: (meta: EngineMeta | null) => {
          const currentState = get();
          if (meta && currentState.parsedFasta && currentState.parsedFasta.sequences.length !== meta.sequenceCount) {
            let sequences = currentState.parsedFasta.sequences;
            if (sequences.length > meta.sequenceCount) {
              const removeCount = sequences.length - meta.sequenceCount;
              removedSequenceBatches.push(sequences.slice(0, removeCount));
              sequences = sequences.slice(removeCount);
            } else {
              const diff = meta.sequenceCount - sequences.length;
              const lastBatch = removedSequenceBatches.at(-1);
              if (lastBatch?.length === diff) {
                removedSequenceBatches.pop();
                sequences = [...lastBatch, ...sequences];
              } else {
                const dummy: FastaSequence[] = Array.from({ length: diff }, () => ({
                  accessionVersion: '',
                  header: '',
                  id: `__synthetic_seq_${syntheticSequenceCounter++}`,
                  length: meta.alignmentWidth,
                  sequence: '',
                }));
                sequences = [...dummy, ...sequences];
              }
            }

            if (meta.redoDepth === 0) {
              removedSequenceBatches = [];
            }

            if (currentState.parsedMetadata) {
              const fastaIds = sequences.map((s) => s.id);
              const { bestColumn, matchCounts } = MetaDataUtil.findBestMatchingColumn(
                currentState.parsedMetadata.columns,
                currentState.parsedMetadata.recordsByColumn,
                fastaIds,
              );
              get().setColumnMatchCounts(matchCounts);
              get().setMatchKeyField(bestColumn);
            }

            set({
              meta,
              parsedFasta: {
                ...currentState.parsedFasta,
                ...computeAlignmentMetadata(sequences),
                sequences,
              },
            });
            return;
          }
          if (meta?.redoDepth === 0) {
            removedSequenceBatches = [];
          }
          set({ meta });
        },
        setNucleotidePalette: (palette: NucleotidePalette) => set({ nucleotidePalette: palette }),
        setSearchQuery: (query: string) => {
          const { setSearchResult, setSearchResultHighlightedIndex: setSearchResultsHighlightedIndex } = get();
          set({ searchQuery: query });
          if (!query) {
            setSearchResultsHighlightedIndex(null);
            setSearchResult(null);
          }
        },
        setSearchResult: (results: EngineSearchResult | null) => {
          const { setSearchResultHighlightedIndex: setSearchResultsHighlightedIndex } = get();
          set({ searchResult: results });
          setSearchResultsHighlightedIndex(null);
        },
        setSearchResultHighlightedIndex: (index: null | number) => set({ searchResultHighlightedIndex: index }),
        setSelection: (selection: EditorSelection | null) => set({ selection }),
      };
    },
    {
      name: 'LOCULUS-SEQUENCE-EDITOR-Configuration',
      partialize: (state) => ({
        aminoAcidPalette: state.aminoAcidPalette,
        customAminoAcidPalette: state.customAminoAcidPalette,
        customNucleotidePalette: state.customNucleotidePalette,
        nucleotidePalette: state.nucleotidePalette,
      }),
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
