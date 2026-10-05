import { createStore } from 'zustand';
import type {
  FastaDataStoreActions,
  FastaDataStoreState,
} from '@rivm-loculus-tools/frontend-common/stores/fastaDataStore';
import {
  createFastaDataStoreActions,
  createFastaDataStoreInitialState,
} from '@rivm-loculus-tools/frontend-common/stores/fastaDataStore';

export type SequenceEditorStore = SequenceEditorStoreActions & SequenceEditorStoreState;

export interface SequenceEditorStoreActions extends FastaDataStoreActions {

}

export interface SequenceEditorStoreState extends FastaDataStoreState {
}

const createSequenceEditorStoreInitialState = (): SequenceEditorStoreState => ({
  ...createFastaDataStoreInitialState(),

});

export const sequenceEditorStore = createStore<SequenceEditorStore>((set, get) => {
  const initialState = createSequenceEditorStoreInitialState();
  const fastaDataStoreActions = createFastaDataStoreActions({ get, set });

  return {
    ...initialState,
    ...fastaDataStoreActions,

  };
});
