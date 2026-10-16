import { container } from 'tsyringe';
import { createStore } from 'zustand';
import uniq from 'lodash/uniq';
import { MetaDataUtil } from '@rivm-loculus-tools/common-frontend/utils/MetaDataUtil';
import type {
  FastaDataStoreActions,
  FastaDataStoreState,
} from '@rivm-loculus-tools/common-frontend/stores/fastaDataStore';
import {
  createFastaDataStoreActions,
  createFastaDataStoreInitialState,
} from '@rivm-loculus-tools/common-frontend/stores/fastaDataStore';
import type { FastaParseResult } from '@rivm-loculus-tools/common-frontend/models/fasta.models';
import type { MetadataParseResult } from '@rivm-loculus-tools/common-frontend/models/metadata.models';

import type { NodeTooltipInfo } from '../../models/tree.models';
import { CALCULATION_STATUS } from '../../models/calculation.models';
import type {
  FastTreeMLParams,
  FastTreeMode,
  TreeEngine,
} from '../../models/calculation.models';
import { FastTreeAioliService } from '../../classes/services/FastTreeAioliService';
import { TN93AioliService } from '../../classes/services/TN93AioliService';
import { ColorUtil } from '../../utils/ColorUtil';
import type { ColorMap } from '../../models/color.models';
import { PhylogenyViewerEventBusService } from '../../classes/services/PhylogenyViewerEventBusService';

export type PhylogenyViewerStore = PhylogenyViewerStoreActions & PhylogenyViewerStoreState;

export interface PhylogenyViewerStoreActions extends FastaDataStoreActions {
  calculateTree: () => Promise<null | string>;
  resetCalculation: () => void;
  resetDataset: () => void;
  resetTreeView: () => void;
  setColorByField: (field: string) => void;
  setData: (fasta: string, tsv?: string, forcedColorByField?: string) => Promise<{ fastaResult: FastaParseResult; metadataResult?: MetadataParseResult }>;
  setEngine: (engine: TreeEngine) => void;
  setFastTreeMode: (mode: FastTreeMode) => void;
  setFastTreeParams: (params: Partial<FastTreeMLParams>) => void;
  setNewick: (newick: string) => void;
  setSearchQuery: (query: string) => void;
  setSelectedLabelFields: (fields: string[]) => void;
  setShowBranchLengths: (show: boolean) => void;
  setShowLeafLabels: (show: boolean) => void;
  setShowScaleBar: (show: boolean) => void;
  setTooltip: (tooltip: NodeTooltipInfo | null) => void;
  toggleCollapseNode: (nodeId: string) => void;
}

export interface PhylogenyViewerStoreState extends FastaDataStoreState {
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
  newick: string;
  searchQuery: string;
  selectedLabelFields: string[];
  showBranchLengths: boolean;
  showLeafLabels: boolean;
  showScaleBar: boolean;
  tooltip: NodeTooltipInfo | null;
}

const createPhylogenyViewerStoreInitialState = (): PhylogenyViewerStoreState => ({
  ...createFastaDataStoreInitialState(),
  calculationError: null,
  calculationStatus: CALCULATION_STATUS.IDLE,
  collapsedNodeIds: [],
  colorByField: null,
  colorMap: {},
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
  newick: '',
  searchQuery: '',
  selectedLabelFields: [],
  showBranchLengths: true,
  showLeafLabels: true,
  showScaleBar: true,
  tooltip: null,
});

export const phylogenyViewerStore = createStore<PhylogenyViewerStore>((set, get) => {
  const initialState = createPhylogenyViewerStoreInitialState();
  const fastaDataStoreActions = createFastaDataStoreActions({ get, set });

  return {
    ...initialState,
    ...fastaDataStoreActions,
    calculateTree: async () => {
      set({
        calculationError: null,
        calculationStatus: CALCULATION_STATUS.LOADING,
        lastCalculationExecutionTimeMs: null,
        newick: '',
      });

      const { rawFasta } = get();
      const startTime = performance.now();

      try {
        const { engine, fastTreeMode, fastTreeParams } = get();
        let generatedNewick = '';

        if (engine === 'tn93') {
          generatedNewick = await container.resolve(TN93AioliService).getTree(rawFasta);
        } else {
          generatedNewick = await container.resolve(FastTreeAioliService).getTree(rawFasta, fastTreeMode, fastTreeParams);
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
        console.error('[phylogenyViewerStore] Error during tree calculation:', err);
        const errMsg = err instanceof Error ? err.message : 'Failed to calculate phylogenetic tree.';
        set({
          calculationError: errMsg,
          calculationStatus: CALCULATION_STATUS.ERROR,
        });
        return null;
      }
    },
    resetCalculation: () => {
      set({
        calculationError: null,
        calculationStatus: CALCULATION_STATUS.IDLE,
        lastCalculationExecutionTimeMs: null,
        newick: '',
      });
    },
    resetDataset: () => {
      fastaDataStoreActions.resetDataset();
      set({
        colorByField: null,
        colorMap: {},
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
    setCalculationStatus: (status: CALCULATION_STATUS) => set({ calculationStatus: status }),
    setColorByField: (field: string) => {
      if (!field) {
        set({ colorByField: null, colorMap: {} });
        return;
      }
      const records = get().parsedMetadata?.records ?? [];

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
    setData: async (fasta: string, tsv?: string, forcedColorByField?: string) => {
      const result = await fastaDataStoreActions.setData(fasta, tsv);
      const { fastaResult, metadataResult } = result;

      const { setColorByField } = get();

      if (!fastaResult.isAligned) {
        set({ calculationStatus: CALCULATION_STATUS.IDLE });
        container.resolve(PhylogenyViewerEventBusService).emit('onShowAlignmentErrorDialog');
        throw new Error('Fasta data is not aligned');
      }

      const metadataColumns = metadataResult?.columns ?? [];
      if (metadataColumns.length > 0) {
        if (forcedColorByField && metadataColumns.includes(forcedColorByField)) {
          setColorByField(forcedColorByField);
        } else {
          const preferred = metadataColumns.find((c) => ['clade', 'country', 'division', 'host', 'lineage', 'region'].includes(c.toLowerCase())) || metadataColumns[0];
          if (preferred) {
            setColorByField(preferred);
          }
        }
      }

      // re-calculate the tree
      await get().calculateTree();
      return result;

    },
    setEngine: (engine: TreeEngine) => set({ engine }),
    setFastTreeMode: (mode: FastTreeMode) => set({ fastTreeMode: mode }),
    setFastTreeParams: (params: Partial<FastTreeMLParams>) => {
      set((state) => ({ fastTreeParams: { ...state.fastTreeParams, ...params } }));
    },
    setMatchKeyField: (field: null | string) => {
      fastaDataStoreActions.setMatchKeyField(field);

      const { setColorByField, setSearchQuery, setSelectedLabelFields } = get();
      setSearchQuery('');
      setColorByField('');
      setSelectedLabelFields(field ? [field] : []);
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

      set({ selectedLabelFields: [matchKeyField, ...fieldsWithoutMatchedKeyField].filter((x): x is string => Boolean(x)) });
    },
    setShowBranchLengths: (show: boolean) => set({ showBranchLengths: show }),
    setShowLeafLabels: (show: boolean) => set({ showLeafLabels: show }),
    setShowScaleBar: (show: boolean) => set({ showScaleBar: show }),
    setTooltip: (tooltip: NodeTooltipInfo | null) => set({ tooltip }),
    toggleCollapseNode: (nodeId: string) => {
      set((state) => {
        const exists = state.collapsedNodeIds.includes(nodeId);
        const next = exists
          ? state.collapsedNodeIds.filter((id) => id !== nodeId)
          : [...state.collapsedNodeIds, nodeId];
        return { collapsedNodeIds: next };
      });
    },
  };
});
