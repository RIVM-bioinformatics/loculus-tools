import { createStore } from 'zustand';
import uniq from 'lodash/uniq';
import { FastaUtil } from '@rivm-loculus-tools/frontend-common/utils/FastaUtil';
import { MetaDataUtil } from '@rivm-loculus-tools/frontend-common/utils/MetaDataUtil';

import type { FastaParseResult } from '../../models/fasta';
import type { MetadataParseResult } from '../../models/metadata';
import type { NodeTooltipInfo } from '../../models/tree';
import type {
  FastTreeMLParams,
  FastTreeMode,
  TreeEngine,
} from '../../models/calculation';
import { CALCULATION_STATUS } from '../../models/calculation';
import { FastTreeAioliService } from '../../classes/services/FastTreeAioliService';
import { TN93AioliService } from '../../classes/services/TN93AioliService';
import { ColorUtil } from '../../utils/ColorUtil';
import type { ColorMap } from '../../models/color';

export type UiStore = UiStoreActions & UiStoreState;

export type UiStoreActions = {
  calculateTree: (overrideFasta?: string) => Promise<null | string>;
  resetCalculation: () => void;
  resetDataset: () => void;
  resetTreeView: () => void;
  setCalculationStatus: (status: CALCULATION_STATUS) => void;
  setColorByField: (field: string) => void;
  setColumnMatchCounts: (counts: Record<string, number>) => void;
  setEngine: (engine: TreeEngine) => void;
  setFastaContent: (fasta: string) => FastaParseResult;
  setFastTreeMode: (mode: FastTreeMode) => void;
  setFastTreeParams: (params: Partial<FastTreeMLParams>) => void;
  setMatchKeyField: (field: null | string) => void;
  setMetadataContent: (tsv: string) => MetadataParseResult;
  setNewick: (newick: string) => void;
  setSearchQuery: (query: string) => void;
  setSelectedLabelFields: (fields: string[]) => void;
  setShowBranchLengths: (show: boolean) => void;
  setShowLeafLabels: (show: boolean) => void;
  setShowScaleBar: (show: boolean) => void;
  setTooltip: (tooltip: NodeTooltipInfo | null) => void;
  toggleCollapseNode: (nodeId: string) => void;
};

export type UiStoreState = {
  calculationError: null | string;
  calculationStatus: CALCULATION_STATUS;
  collapsedNodeIds: string[];
  colorByField: null | string;
  colorMap: ColorMap;
  columnMatchCounts: Record<string, number>;
  engine: TreeEngine;
  fastTreeMode: FastTreeMode;
  fastTreeParams: FastTreeMLParams;
  highlightedIds: string[];
  lastCalculationExecutionTimeMs: null | number;
  matchKeyField: null | string;
  newick: string;
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
  calculateTree: async (overrideFasta?: string) => {
    const rawFasta = overrideFasta ?? get().rawFasta;

    if (!rawFasta?.trim()) {
      set({ calculationError: 'No sequence data available to calculate tree.', calculationStatus: CALCULATION_STATUS.ERROR });
      return null;
    }

    // Always re-parse the FASTA actually being used, since an override may not yet be reflected in the store's parsedFasta.
    const parsedFasta = FastaUtil.parseFasta(rawFasta);

    if (!parsedFasta.isAligned) {
      set({
        calculationError: parsedFasta.error || 'The provided FASTA sequences are not aligned.',
        calculationStatus: CALCULATION_STATUS.ERROR,
      });
      return null;
    }

    set({ calculationError: null, calculationStatus: CALCULATION_STATUS.LOADING });
    const startTime = performance.now();

    try {
      const { engine, fastTreeMode, fastTreeParams } = get();
      let generatedNewick = '';

      if (engine === 'tn93') {
        generatedNewick = await TN93AioliService.getInstance().getTree(rawFasta);
      } else {
        generatedNewick = await FastTreeAioliService.getInstance().getTree(rawFasta, fastTreeMode, fastTreeParams);
      }

      const durationMs = Math.round(performance.now() - startTime);

      set({
        calculationError: null,
        calculationStatus: CALCULATION_STATUS.SUCCESS,
        lastCalculationExecutionTimeMs: durationMs,
        newick: generatedNewick,
      });

      return generatedNewick;
    } catch (err: unknown) {
      console.error('[UiStore] Error during tree calculation:', err);
      const errMsg = err instanceof Error ? err.message : 'Failed to calculate phylogenetic tree.';
      set({
        calculationError: errMsg,
        calculationStatus: CALCULATION_STATUS.ERROR,
      });
      return null;
    }
  },
  calculationError: null,
  calculationStatus: CALCULATION_STATUS.IDLE,
  collapsedNodeIds: [],
  colorByField: null,
  colorMap: {},
  columnMatchCounts: {},
  engine: 'tn93',
  fastTreeMode: 'noml',
  fastTreeParams: {
    bootstrapping: 1000,
    gamma: true,
    model: 'gtr',
    spr: 4,
  },
  highlightedIds: [],
  lastCalculationExecutionTimeMs: null,
  matchKeyField: null,
  newick: '',
  parsedFasta: null,
  parsedMetadata: null,
  rawFasta: '',
  rawMetadata: '',
  resetCalculation: () => {
    set({
      calculationError: null,
      calculationStatus: CALCULATION_STATUS.IDLE,
      lastCalculationExecutionTimeMs: null,
      newick: '',
    });
  },
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

  setCalculationStatus: (status: CALCULATION_STATUS) => set({ calculationStatus: status }),

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

  setEngine: (engine: TreeEngine) => set({ engine }),

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
      get().setColumnMatchCounts(matchCounts);
      get().setMatchKeyField(bestColumn);
    }

    return parsed;
  },

  setFastTreeMode: (mode: FastTreeMode) => set({ fastTreeMode: mode }),

  setFastTreeParams: (params: Partial<FastTreeMLParams>) => {
    set((state) => ({ fastTreeParams: { ...state.fastTreeParams, ...params } }));
  },

  setMatchKeyField: (field: null | string) => {
    const { setColorByField, setSearchQuery, setSelectedLabelFields } = get();
    set({ matchKeyField: field });
    setSearchQuery(null);
    setColorByField(null);
    setSelectedLabelFields(field ? [field] : []);
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
      get().setColumnMatchCounts(matchCounts);
      get().setMatchKeyField(bestColumn);
    } else if (parsed && parsed.columns.length > 0) {
      // Default to best candidate
      const prioritized = ['displayName', 'accessionVersion', 'accession', 'SampleID', 'id', 'strain'];
      const defaultCol = prioritized.find((p) => parsed.columns.includes(p)) || parsed.columns[0];
      get().setMatchKeyField(defaultCol);
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

  setNewick: (newick: string) => {
    set({ calculationError: null, calculationStatus: CALCULATION_STATUS.SUCCESS, newick });
  },

  setSearchQuery: (query: string) => {
    if (!query) {
      set({ highlightedIds: [], searchQuery: '' });
      return;
    }
    const allSequenceIds = (get().parsedFasta?.sequences ?? []).map((sequence) => sequence.id);
    const records = get().parsedMetadata?.records ?? [];
    const highlightedIds = MetaDataUtil.getHighlightedIds(query, allSequenceIds, records);
    set({ highlightedIds, searchQuery: query });
  },

  setSelectedLabelFields: (fields: string[]) => {
    const { matchKeyField } = get();
    const fieldsWithoutMatchedKeyField = fields.filter((f) => f !== matchKeyField);

    set({ selectedLabelFields: [matchKeyField, ...fieldsWithoutMatchedKeyField].filter(x => !!x) });
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
