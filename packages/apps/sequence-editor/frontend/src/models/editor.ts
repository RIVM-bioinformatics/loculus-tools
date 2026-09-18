import type {
  Meta,
  SearchResult,
} from '../engine/protocol';

export interface ActiveCell {
  col: number;
  row: number;
}

export interface EditorState {
  activeCell: ActiveCell;
  announcement: string;
  busy: boolean;
  busyLabel: null | string;
  currentHit: number;
  dataRevision: number;
  datasetLabel: string;
  dirty: boolean;
  error: null | string;
  metadata: Meta | null;
  openDialog: 'import' | 'none';
  openPanel: 'none' | 'settings';
  palette: string;
  searchResults: null | SearchResult;
  selectedRows: number[];
  selectionBlock: null | SelectionBlock;
  status: null | string;
}

export interface SelectionBlock {
  endCol: number;
  startCol: number;
}

export const initialEditorState: EditorState = {
  activeCell: { col: 0, row: 0 },
  announcement: '',
  busy: false,
  busyLabel: null,
  currentHit: 0,
  dataRevision: 0,
  datasetLabel: 'Untitled alignment',
  dirty: false,
  error: null,
  metadata: null,
  openDialog: 'none',
  openPanel: 'none',
  palette: 'AliView Default',
  searchResults: null,
  selectedRows: [],
  selectionBlock: null,
  status: null,
};

export type EditorAction =
  | { announcement?: string; dirty: boolean; status?: string; type: 'commandSucceeded'; updateRevision: boolean }
  | { label: string; metadata: Meta; type: 'resetForDataset' }
  | { label: string; type: 'setBusy' }
  | { message: string; type: 'commandFailed' }
  | { type: 'setActiveCell'; value: ActiveCell }
  | { type: 'setAnnouncement'; value: string }
  | { type: 'setCurrentHit'; value: number }
  | { type: 'setDatasetLabel'; value: string }
  | { type: 'setDialog'; value: 'import' | 'none' }
  | { type: 'setDirty'; value: boolean }
  | { type: 'setError'; value: null | string }
  | { type: 'setMetadata'; value: Meta | null }
  | { type: 'setPanel'; value: 'none' | 'settings' }
  | { type: 'setSearchResults'; value: null | SearchResult }
  | { type: 'setSelectedRows'; value: number[] }
  | { type: 'setSelectionBlock'; value: null | SelectionBlock }
  | { type: 'setStatus'; value: null | string };

export const editorReducer = (state: EditorState, action: EditorAction): EditorState => {
  switch (action.type) {
    case 'commandFailed':
      return {
        ...state,
        announcement: action.message,
        busy: false,
        busyLabel: null,
        error: action.message,
        status: null,
      };
    case 'commandSucceeded':
      return {
        ...state,
        announcement: action.announcement ?? state.announcement,
        busy: false,
        busyLabel: null,
        dataRevision: action.updateRevision ? state.dataRevision + 1 : state.dataRevision,
        dirty: action.dirty,
        error: null,
        status: action.status ?? state.status,
      };
    case 'resetForDataset':
      return {
        ...state,
        activeCell: { col: 0, row: 0 },
        announcement: `Loaded ${action.metadata.sequences} sequence${action.metadata.sequences === 1 ? '' : 's'}.`,
        currentHit: 0,
        datasetLabel: action.label,
        dirty: false,
        error: null,
        metadata: action.metadata,
        searchResults: null,
        selectedRows: [],
        selectionBlock: null,
        status: `Loaded ${action.metadata.sequences} sequence${action.metadata.sequences === 1 ? '' : 's'}.`,
      };
    case 'setActiveCell':
      return { ...state, activeCell: action.value };
    case 'setAnnouncement':
      return { ...state, announcement: action.value };
    case 'setBusy':
      return { ...state, busy: true, busyLabel: action.label, error: null };
    case 'setCurrentHit':
      return { ...state, currentHit: action.value };
    case 'setDatasetLabel':
      return { ...state, datasetLabel: action.value };
    case 'setDialog':
      return { ...state, openDialog: action.value };
    case 'setDirty':
      return { ...state, dirty: action.value };
    case 'setError':
      return { ...state, error: action.value };
    case 'setMetadata':
      return { ...state, metadata: action.value };
    case 'setPanel':
      return { ...state, openPanel: action.value };
    case 'setSearchResults':
      return { ...state, currentHit: 0, searchResults: action.value };
    case 'setSelectedRows':
      return { ...state, selectedRows: action.value };
    case 'setSelectionBlock':
      return { ...state, selectionBlock: action.value };
    case 'setStatus':
      return { ...state, status: action.value };
    default:
      return state;
  }
};
