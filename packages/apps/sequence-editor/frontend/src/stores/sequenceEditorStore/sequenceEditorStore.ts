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

export const sequenceEditorStore = createStore<SequenceEditorStore>()(
  persist(
    (set, get) => {
      container.resolve(EditorWorkerService).setMessageHandler((message) => set({ latestMessage: message }));
      const initialState = createSequenceEditorStoreInitialState();
      const fastaDataStoreActions = createFastaDataStoreActions({ get, set });

      return {
        ...initialState,
        ...fastaDataStoreActions,
        resetDataset: () => {
          const { setSearchQuery } = get();
          fastaDataStoreActions.resetDataset();
          setSearchQuery('');
          set({
            latestMessage: null,
            meta: null,
            searchResult: null,
            searchResultHighlightedIndex: null,
            selection: null,
          });
          void container.resolve(EditorWorkerService).reset();
        },
        setAminoAcidPalette: (palette: AminoAcidPalette) => set({ aminoAcidPalette: palette }),
        setCustomAminoAcidPalette: (palette: AminoAcidPalette) => set({ customAminoAcidPalette: palette }),
        setCustomNucleotidePalette: (palette: NucleotidePalette) => set({ customNucleotidePalette: palette }),
        setData: async (fasta: string, tsv?: string) => {
          const parsedFasta = FastaUtil.parseFasta(fasta);

          if (parsedFasta.error) {
            set({
              loadingError: parsedFasta.error,
              loadingStatus: LOADING_STATUS.ERROR,
            });
            throw new Error(parsedFasta.error);
          }

          await container.resolve(EditorWorkerService).loadFasta(fasta);

          const currentState = get();
          const existingSequences = currentState.parsedFasta?.sequences || [];
          const combinedSequences: FastaSequence[] = [
            ...parsedFasta.sequences,
            ...existingSequences,
          ];

          const updatedParsedFasta: FastaParseResult = {
            ...parsedFasta,
            sequences: combinedSequences,
          };

          const updatedRawFasta = currentState.rawFasta
            ? `${fasta.trimEnd()}\n${currentState.rawFasta}`
            : fasta;

          let parsedMetadata: MetadataParseResult | undefined;
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
        },
        setIsRealigning: (isRealigning: boolean) => set({ isRealigning }),
        setLatestMessage: (message: null | string) => set({ latestMessage: message }),
        setMeta: (meta: EngineMeta | null) => {
          const currentState = get();
          if (meta && currentState.parsedFasta && currentState.parsedFasta.sequences.length !== meta.sequenceCount) {
            let sequences = currentState.parsedFasta.sequences;
            if (sequences.length > meta.sequenceCount) {
              sequences = sequences.slice(0, meta.sequenceCount);
            } else {
              const diff = meta.sequenceCount - sequences.length;
              const dummy: FastaSequence[] = Array.from({ length: diff }, (_, i) => ({
                accessionVersion: '',
                header: '',
                id: `seq_${sequences.length + i}`,
                length: meta.alignmentWidth,
                sequence: '',
              }));
              sequences = [...sequences, ...dummy];
            }
            set({
              meta,
              parsedFasta: {
                ...currentState.parsedFasta,
                sequences,
              },
            });
            return;
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
