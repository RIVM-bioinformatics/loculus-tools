import { create } from 'zustand';

import type {
  NodeTooltipInfo,
  TreeViewState,
} from '../models/tree';
import type { MetadataRecord } from '../models/metadata';

interface TreeViewStateStore {
  collapsedNodeIds: string[];
  drawerOpen: boolean;
  highlightedIds: string[];
  resetTreeView: () => void;
  searchQuery: string;
  setDrawerOpen: (open: boolean) => void;
  setHighlightedIds: (ids: string[]) => void;
  setSearchQuery: (query: string, allAccessions?: string[], metadataRecords?: MetadataRecord[], matchKeyColumn?: null | string) => void;
  setShowBranchLengths: (show: boolean) => void;

  setShowLeafLabels: (show: boolean) => void;
  setShowScaleBar: (show: boolean) => void;
  setShowSupportLines: (show: boolean) => void;
  setTooltip: (tooltip: NodeTooltipInfo | null) => void;
  setViewState: (state: Partial<TreeViewState>) => void;
  showBranchLengths: boolean;
  showLeafLabels: boolean;
  showScaleBar: boolean;
  showSupportLines: boolean;
  toggleCollapseNode: (nodeId: string) => void;
  tooltip: NodeTooltipInfo | null;
  viewState: TreeViewState;
}

export const useTreeViewStore = create<TreeViewStateStore>((set) => ({
  collapsedNodeIds: [],
  drawerOpen: true,
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
  setDrawerOpen: (open: boolean) => set({ drawerOpen: open }),
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
  setShowSupportLines: (show: boolean) => set({ showSupportLines: show }),
  setTooltip: (tooltip: NodeTooltipInfo | null) => set({ tooltip }),

  setViewState: (newState: Partial<TreeViewState>) =>
    set((state) => ({ viewState: { ...state.viewState, ...newState } })),

  showBranchLengths: true,
  showLeafLabels: true,
  showScaleBar: true,
  showSupportLines: false,
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
