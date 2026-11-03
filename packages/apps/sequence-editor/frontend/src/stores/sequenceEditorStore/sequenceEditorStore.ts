import { createStore } from 'zustand';
import {
  createJSONStorage,
  persist,
} from 'zustand/middleware';
import type {
  FastaDataStoreActions,
  FastaDataStoreState,
} from '@rivm-loculus-tools/common-frontend/stores/fastaDataStore';
import {
  createFastaDataStoreActions,
  createFastaDataStoreInitialState,
} from '@rivm-loculus-tools/common-frontend/stores/fastaDataStore';

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

export type SequenceEditorStore = SequenceEditorStoreActions & SequenceEditorStoreState;

export interface SequenceEditorStoreActions extends FastaDataStoreActions {
  setAminoAcidPalette: (palette: AminoAcidPalette) => void;
  setCustomAminoAcidPalette: (palette: AminoAcidPalette) => void;
  setCustomNucleotidePalette: (palette: NucleotidePalette) => void;
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
      const initialState = createSequenceEditorStoreInitialState();
      const fastaDataStoreActions = createFastaDataStoreActions({ get, set });

      return {
        ...initialState,
        ...fastaDataStoreActions,
        resetDataset: () => {
          const { setSearchQuery } = get();
          fastaDataStoreActions.resetDataset();
          setSearchQuery('');
        },
        setAminoAcidPalette: (palette: AminoAcidPalette) => set({ aminoAcidPalette: palette }),
        setCustomAminoAcidPalette: (palette: AminoAcidPalette) => set({ customAminoAcidPalette: palette }),
        setCustomNucleotidePalette: (palette: NucleotidePalette) => set({ customNucleotidePalette: palette }),
        setLatestMessage: (message: null | string) => set({ latestMessage: message }),
        setMeta: (meta: EngineMeta | null) => set({ meta }),
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
