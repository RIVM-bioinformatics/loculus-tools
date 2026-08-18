import { create } from 'zustand';
import type { NodeTooltipInfo, TreeViewState } from '../types/tree';

interface TreeViewStateStore {
  showBranchLengths: boolean;
  showLeafLabels: boolean;
  showSupportLines: boolean;
  showScaleBar: boolean;
  searchQuery: string;
  highlightedIds: string[];
  collapsedNodeIds: string[];
  tooltip: NodeTooltipInfo | null;
  drawerOpen: boolean;
  importModalOpen: boolean;
  viewState: TreeViewState;

  setShowBranchLengths: (show: boolean) => void;
  setShowLeafLabels: (show: boolean) => void;
  setShowSupportLines: (show: boolean) => void;
  setShowScaleBar: (show: boolean) => void;
  setSearchQuery: (query: string, allAccessions?: string[], metadataRecords?: Record<string, any>[], matchKeyColumn?: string | null) => void;
  setHighlightedIds: (ids: string[]) => void;
  setTooltip: (tooltip: NodeTooltipInfo | null) => void;
  setDrawerOpen: (open: boolean) => void;
  setImportModalOpen: (open: boolean) => void;
  setViewState: (state: Partial<TreeViewState>) => void;
  toggleCollapseNode: (nodeId: string) => void;
  resetTreeView: () => void;
}

export const useTreeViewStore = create<TreeViewStateStore>((set) => ({
  showBranchLengths: true,
  showLeafLabels: true,
  showSupportLines: false,
  showScaleBar: true,
  searchQuery: '',
  highlightedIds: [],
  collapsedNodeIds: [],
  tooltip: null,
  drawerOpen: true,
  importModalOpen: false,
  viewState: {
    zoomLevel: 1,
    horizontalScrollPosition: 0,
    verticalScrollPosition: 0,
  },

  setShowBranchLengths: (show: boolean) => set({ showBranchLengths: show }),
  setShowLeafLabels: (show: boolean) => set({ showLeafLabels: show }),
  setShowSupportLines: (show: boolean) => set({ showSupportLines: show }),
  setShowScaleBar: (show: boolean) => set({ showScaleBar: show }),

  setSearchQuery: (query: string, allAccessions = [], metadataRecords = [], matchKeyColumn = null) => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      set({ searchQuery: '', highlightedIds: [] });
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
          (val) => typeof val === 'string' && val.toLowerCase().includes(trimmed)
        );
        if (matchesAnyField) {
          matched.add(acc);
        }
      }
    });

    set({ searchQuery: query, highlightedIds: Array.from(matched) });
  },

  setHighlightedIds: (ids: string[]) => set({ highlightedIds: ids }),
  setTooltip: (tooltip: NodeTooltipInfo | null) => set({ tooltip }),
  setDrawerOpen: (open: boolean) => set({ drawerOpen: open }),
  setImportModalOpen: (open: boolean) => set({ importModalOpen: open }),
  setViewState: (newState: Partial<TreeViewState>) =>
    set((state) => ({ viewState: { ...state.viewState, ...newState } })),

  toggleCollapseNode: (nodeId: string) => {
    set((state) => {
      const exists = state.collapsedNodeIds.includes(nodeId);
      const next = exists
        ? state.collapsedNodeIds.filter((id) => id !== nodeId)
        : [...state.collapsedNodeIds, nodeId];
      return { collapsedNodeIds: next };
    });
  },

  resetTreeView: () => {
    set({
      searchQuery: '',
      highlightedIds: [],
      collapsedNodeIds: [],
      tooltip: null,
      viewState: {
        zoomLevel: 1,
        horizontalScrollPosition: 0,
        verticalScrollPosition: 0,
      },
    });
  },
}));
