import { createStore } from 'zustand';
import type {
  FastaDataStoreActions,
  FastaDataStoreState,
} from '@rivm-loculus-tools/frontend-common/stores/fastaDataStore';
import {
  createFastaDataStoreActions,
  createFastaDataStoreInitialState,
} from '@rivm-loculus-tools/frontend-common/stores/fastaDataStore';

import type {
  EditorSelection,
  EngineMeta,
} from '../../models';

export type SequenceEditorStore = SequenceEditorStoreActions & SequenceEditorStoreState;

export interface SequenceEditorStoreActions extends FastaDataStoreActions {
  setLatestMessage: (message: null | string) => void;
  setMeta: (meta: EngineMeta | null) => void;
  setSelection: (selection: EditorSelection | null) => void;
}

export interface SequenceEditorStoreState extends FastaDataStoreState {
  latestMessage: null | string;
  meta: EngineMeta | null;
  selection: EditorSelection | null;
}

const createSequenceEditorStoreInitialState = (): SequenceEditorStoreState => ({
  ...createFastaDataStoreInitialState(),
  latestMessage: null,
  meta: null,
  selection: null,
});

export const sequenceEditorStore = createStore<SequenceEditorStore>((set, get) => {
  const initialState = createSequenceEditorStoreInitialState();
  const fastaDataStoreActions = createFastaDataStoreActions({ get, set });

  return {
    ...initialState,
    ...fastaDataStoreActions,
    setLatestMessage: (message: null | string) => set({ latestMessage: message }),
    setMeta: (meta: EngineMeta | null) => set({ meta }),
    setSelection: (selection: EditorSelection | null) => set({ selection }),
  };
});
