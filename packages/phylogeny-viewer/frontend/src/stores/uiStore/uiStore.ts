import { createStore } from 'zustand';
import uniq from 'lodash/uniq';

import type { FastaParseResult } from '../../models/fasta';
import type {
  ColorMap,
  MetadataParseResult,
} from '../../models/metadata';
import type { NodeTooltipInfo } from '../../models/tree';
import { FastaUtil } from '../../utils/FastaUtil';
import { MetaDataUtil } from '../../utils/MetaDataUtil';
import { ColorUtil } from '../../utils/ColorUtil';

export type UiStore = UiStoreActions & UiStoreState;

export type UiStoreActions = {
  resetDataset: () => void;
  resetTreeView: () => void;
  setColorByField: (field: string) => void;
  setColumnMatchCounts: (counts: Record<string, number>) => void;
  setFastaContent: (fasta: string) => FastaParseResult;
  setMatchKeyField: (field: null | string) => void;
  setMetadataContent: (tsv: string) => MetadataParseResult;
  setSearchQuery: (query: string) => void;
  setSelectedLabelFields: (fields: string[]) => void;
  setShowBranchLengths: (show: boolean) => void;
  setShowLeafLabels: (show: boolean) => void;
  setShowScaleBar: (show: boolean) => void;
  setTooltip: (tooltip: NodeTooltipInfo | null) => void;
  toggleCollapseNode: (nodeId: string) => void;
};

export type UiStoreState = {
  collapsedNodeIds: string[];
  colorByField: null | string;
  colorMap: ColorMap;
  columnMatchCounts: Record<string, number>;
  highlightedIds: string[];
  matchKeyField: null | string;
  parsedFasta: FastaParseResult | null;
  parsedMetadata: MetadataParseResult | null;
  rawFasta: string;
  rawMetadata: string;
  searchQuery: string;
  selectedLabelFields: string[];
  showBranchLengths: boolean;
  showLeafLabels: boolean;
  showScaleBar: boolean;
  tooltip: NodeTooltipInfo | null;
};

export const uiStore = createStore<UiStore>((set, get) => ({
  collapsedNodeIds: [],
  colorByField: null,
  colorMap: {},
  columnMatchCounts: {},
  highlightedIds: [],
  matchKeyField: null,
  parsedFasta: null,
  parsedMetadata: null,
  rawFasta: '',
  rawMetadata: '',
  resetDataset: () => {
    set({
      colorByField: null,
      colorMap: {},
      columnMatchCounts: {},
      matchKeyField: null,
      parsedFasta: null,
      parsedMetadata: null,
      rawFasta: '',
      rawMetadata: '',
      selectedLabelFields: [],
    });
  },
  resetTreeView: () => {
    set({
      collapsedNodeIds: [],
      highlightedIds: [],
      searchQuery: '',
      showBranchLengths: true,
      showLeafLabels: true,
      showScaleBar: true,
      tooltip: null,
    });
  },
  searchQuery: '',
  selectedLabelFields: [],

  setColorByField: (field: string) => {
    if (!field) {
      set({ colorByField: null, colorMap: {} });
      return;
    }
    const { parsedMetadata: { records = [] } = {} } = get();

    const values = records.map((r) => r[field] || '');
    const uniqueValues = uniq(values);

    const counts: Record<string, number> = {};
    values.forEach((v) => {
      if (v) {
        counts[v] = (counts[v] || 0) + 1;
      }
    });

    const newMap: ColorMap = {};
    const gradient = ColorUtil.createGradient(uniqueValues.length);
    console.log({ gradient });
    uniqueValues.forEach((value, index) => {
      newMap[value] = {
        color: ColorUtil.getDeterministicColor(gradient, value, index),
        count: counts[value] || 0,
        isMissing: ColorUtil.isMissingValue(value),
      };
    });

    set({
      colorByField: field,
      colorMap: newMap,
    });
  },

  setColumnMatchCounts: (counts: Record<string, number>) => {
    set({ columnMatchCounts: counts });
  },

  setFastaContent: (fasta: string) => {
    const parsed = FastaUtil.parseFasta(fasta);
    set({
      parsedFasta: parsed,
      rawFasta: fasta,
    });

    const parsedMetadata = get().parsedMetadata;
    if (parsedMetadata && parsed.sequences.length > 0) {
      const fastaIds = parsed.sequences.map((s) => s.id);
      const { bestColumn, matchCounts } = MetaDataUtil.findBestMatchingColumn(
        parsedMetadata.columns,
        parsedMetadata.recordsByColumn,
        fastaIds,
      );
      set({ columnMatchCounts: matchCounts, matchKeyField: bestColumn });
    }

    return parsed;
  },

  setMatchKeyField: (field: null | string) => {
    const { setColorByField, setSearchQuery } = get();
    set({ matchKeyField: field });
    setSearchQuery(null);
    setColorByField(null);
  },

  setMetadataContent: (tsv: string) => {
    const parsed = MetaDataUtil.parseTsv(tsv);
    set({
      parsedMetadata: parsed,
      rawMetadata: tsv,
    });

    const currentFasta = get().parsedFasta;
    if (parsed && currentFasta && currentFasta.sequences.length > 0) {
      const fastaIds = currentFasta.sequences.map((s) => s.id);
      const { bestColumn, matchCounts } = MetaDataUtil.findBestMatchingColumn(
        parsed.columns,
        parsed.recordsByColumn,
        fastaIds,
      );
      set({ columnMatchCounts: matchCounts, matchKeyField: bestColumn });
    } else if (parsed && parsed.columns.length > 0) {
      // Default to best candidate
      const prioritized = ['displayName', 'accessionVersion', 'accession', 'SampleID', 'id', 'strain'];
      const defaultCol = prioritized.find((p) => parsed.columns.includes(p)) || parsed.columns[0];
      set({ matchKeyField: defaultCol });
    }
    if (parsed.columns.length > 0) {
      const preferred = parsed.columns.find((c) =>
        ['clade', 'country', 'division', 'host', 'lineage', 'region'].includes(c.toLowerCase())) || parsed.columns[0];
      if (preferred) {
        get().setColorByField(preferred);
      }
    }

    return parsed;
  },

  setSearchQuery: (query: string) => {
    if (query === null) {
      set({ highlightedIds: [], searchQuery: null });
      return;
    }
    const allSequenceIds = (get().parsedFasta?.sequences ?? []).map((sequence) => sequence.id);
    const records = get().parsedMetadata?.records ?? [];
    const highlightedIds = MetaDataUtil.getHighlightedIds(query, allSequenceIds, records);
    set({ highlightedIds, searchQuery: query });
  },

  setSelectedLabelFields: (fields: string[]) => {
    set({ selectedLabelFields: fields });
  },

  setShowBranchLengths: (show: boolean) => set({ showBranchLengths: show }),
  setShowLeafLabels: (show: boolean) => set({ showLeafLabels: show }),
  setShowScaleBar: (show: boolean) => set({ showScaleBar: show }),
  setTooltip: (tooltip: NodeTooltipInfo | null) => set({ tooltip }),

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
  valueCounts: {},
}));
