import { createStore } from 'zustand';

import type {
  NodeTooltipInfo,
  TreeViewState,
} from '../models/tree';
import type { MetadataRecord } from '../models/metadata';

interface TreeViewStateStore {
  collapsedNodeIds: string[];
  highlightedIds: string[];
  resetTreeView: () => void;
  searchQuery: string;
  setHighlightedIds: (ids: string[]) => void;
  setSearchQuery: (query: string, allAccessions?: string[], metadataRecords?: MetadataRecord[], matchKeyColumn?: null | string) => void;
  setShowBranchLengths: (show: boolean) => void;

  setShowLeafLabels: (show: boolean) => void;
  setShowScaleBar: (show: boolean) => void;
  setTooltip: (tooltip: NodeTooltipInfo | null) => void;
  setViewState: (state: Partial<TreeViewState>) => void;
  showBranchLengths: boolean;
  showLeafLabels: boolean;
  showScaleBar: boolean;
  toggleCollapseNode: (nodeId: string) => void;
  tooltip: NodeTooltipInfo | null;
  viewState: TreeViewState;
}

export const treeViewStore = createStore<TreeViewStateStore>((set) => ({
  collapsedNodeIds: [],
  highlightedIds: [],
  resetTreeView: () => {
    set({
      collapsedNodeIds: [],
      highlightedIds: [],
      searchQuery: '',
      tooltip: null,
      viewState: {
        horizontalScrollPosition: 0,
        verticalScrollPosition: 0,
        zoomLevel: 1,
      },
    });
  },
  searchQuery: '',
  setHighlightedIds: (ids: string[]) => set({ highlightedIds: ids }),
  setSearchQuery: (query: string, allAccessions = [], metadataRecords = [], matchKeyColumn = null) => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      set({ highlightedIds: [], searchQuery: '' });
      return;
    }

    const matched = new Set<string>();

    // Check accession names / fasta IDs
    allAccessions.forEach((acc) => {
      if (acc.toLowerCase().includes(trimmed)) {
        matched.add(acc);
      }
    });

    // Check metadata records
    metadataRecords.forEach((rec) => {
      const acc =
        (matchKeyColumn && rec[matchKeyColumn]) ||
        rec.displayName ||
        rec.accessionVersion ||
        rec.accession ||
        rec.id ||
        rec.submissionId ||
        rec.SampleID;
      if (acc) {
        const matchesAnyField = Object.values(rec).some(
          (val) => typeof val === 'string' && val.toLowerCase().includes(trimmed),
        );
        if (matchesAnyField) {
          matched.add(acc);
        }
      }
    });

    set({ highlightedIds: Array.from(matched), searchQuery: query });
  },
  setShowBranchLengths: (show: boolean) => set({ showBranchLengths: show }),

  setShowLeafLabels: (show: boolean) => set({ showLeafLabels: show }),
  setShowScaleBar: (show: boolean) => set({ showScaleBar: show }),
  setTooltip: (tooltip: NodeTooltipInfo | null) => set({ tooltip }),

  setViewState: (newState: Partial<TreeViewState>) =>
    set((state) => ({ viewState: { ...state.viewState, ...newState } })),

  showBranchLengths: true,
  showLeafLabels: true,
  showScaleBar: true,
  toggleCollapseNode: (nodeId: string) => {
    set((state) => {
      const exists = state.collapsedNodeIds.includes(nodeId);
      const next = exists
        ? state.collapsedNodeIds.filter((id) => id !== nodeId)
        : [...state.collapsedNodeIds, nodeId];
      return { collapsedNodeIds: next };
    });
  },

  tooltip: null,

  viewState: {
    horizontalScrollPosition: 0,
    verticalScrollPosition: 0,
    zoomLevel: 1,
  },
}));
