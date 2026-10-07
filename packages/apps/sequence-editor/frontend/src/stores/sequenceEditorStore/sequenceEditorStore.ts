import { createStore } from 'zustand';
import {
  createJSONStorage,
  persist,
} from 'zustand/middleware';
import type {
  FastaDataStoreActions,
  FastaDataStoreState,
} from '@rivm-loculus-tools/frontend-common/stores/fastaDataStore';
import {
  createFastaDataStoreActions,
  createFastaDataStoreInitialState,
} from '@rivm-loculus-tools/frontend-common/stores/fastaDataStore';

import type {
  AminoAcidPalette,
  EditorSelection,
  EngineMeta,
  NucleotidePalette,
} from '../../models';
import {
  ALI_VIEW_DEFAULT_AMINO_ACID_PALETTE,
  ALI_VIEW_DEFAULT_NUCLEOTIDE_PALETTE,
} from '../../constants';

export type SequenceEditorStore = SequenceEditorStoreActions & SequenceEditorStoreState;

export interface SequenceEditorStoreActions extends FastaDataStoreActions {
  setAminoAcidPalette: (palette: AminoAcidPalette) => void;
  setLatestMessage: (message: null | string) => void;
  setMeta: (meta: EngineMeta | null) => void;
  setNucleotidePalette: (palette: NucleotidePalette) => void;
  setSelection: (selection: EditorSelection | null) => void;
}

export interface SequenceEditorStoreState extends FastaDataStoreState {
  aminoAcidPalette: AminoAcidPalette;
  latestMessage: null | string;
  meta: EngineMeta | null;
  nucleotidePalette: NucleotidePalette;
  selection: EditorSelection | null;
}

const createSequenceEditorStoreInitialState = (): SequenceEditorStoreState => ({
  ...createFastaDataStoreInitialState(),
  aminoAcidPalette: ALI_VIEW_DEFAULT_AMINO_ACID_PALETTE,
  latestMessage: null,
  meta: null,
  nucleotidePalette: ALI_VIEW_DEFAULT_NUCLEOTIDE_PALETTE,
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
        setAminoAcidPalette: (palette: AminoAcidPalette) => set({ aminoAcidPalette: palette }),
        setLatestMessage: (message: null | string) => set({ latestMessage: message }),
        setMeta: (meta: EngineMeta | null) => set({ meta }),
        setNucleotidePalette: (palette: NucleotidePalette) => set({ nucleotidePalette: palette }),
        setSelection: (selection: EditorSelection | null) => set({ selection }),
      };
    },
    {
      name: 'LOCULUS-SEQUENCE-EDITOR-Configuration',
      partialize: (state) => ({
        aminoAcidPalette: state.aminoAcidPalette,
        nucleotidePalette: state.nucleotidePalette,
      }),
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
