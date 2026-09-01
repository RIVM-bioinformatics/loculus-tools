import { create } from 'zustand';

import type {
  CalculationStatus,
  FastTreeMLParams,
  FastTreeMode,
  TreeEngine,
} from '../models/calculation';
import { calculateTN93Tree } from '../services/Tn93Service';
import { calculateFastTree } from '../services/FastTreeService';

import { useDatasetStore } from './datasetStore';

interface CalculationState {
  calculateTree: (overrideFasta?: string) => Promise<null | string>;
  engine: TreeEngine;
  error: null | string;
  fastTreeMode: FastTreeMode;
  fastTreeParams: FastTreeMLParams;
  lastExecutionTimeMs: null | number;
  newick: string;

  resetCalculation: () => void;
  setEngine: (engine: TreeEngine) => void;
  setFastTreeMode: (mode: FastTreeMode) => void;
  setFastTreeParams: (params: Partial<FastTreeMLParams>) => void;
  setNewick: (newick: string) => void;
  status: CalculationStatus;
}

export const useCalculationStore = create<CalculationState>((set, get) => ({
  calculateTree: async (overrideFasta?: string) => {
    const rawFasta = overrideFasta ?? useDatasetStore.getState().rawFasta;
    const parsedFasta = useDatasetStore.getState().parsedFasta;

    if (!rawFasta?.trim()) {
      set({ error: 'No sequence data available to calculate tree.', status: 'error' });
      return null;
    }

    if (parsedFasta && !parsedFasta.isAligned) {
      set({
        error: parsedFasta.error || 'The provided FASTA sequences are not aligned.',
        status: 'error',
      });
      return null;
    }

    set({ error: null, status: 'loading' });
    const startTime = performance.now();

    try {
      const { engine, fastTreeMode, fastTreeParams } = get();
      let generatedNewick = '';

      if (engine === 'tn93') {
        generatedNewick = await calculateTN93Tree(rawFasta);
      } else {
        generatedNewick = await calculateFastTree(rawFasta, fastTreeMode, fastTreeParams);
      }

      const durationMs = Math.round(performance.now() - startTime);

      set({
        error: null,
        lastExecutionTimeMs: durationMs,
        newick: generatedNewick,
        status: 'success',
      });

      return generatedNewick;
    } catch (err: unknown) {
      console.error('[CalculationStore] Error during tree calculation:', err);
      const errMsg = err instanceof Error ? err.message : 'Failed to calculate phylogenetic tree.';
      set({
        error: errMsg,
        status: 'error',
      });
      return null;
    }
  },
  engine: 'tn93',
  error: null,
  fastTreeMode: 'noml',
  fastTreeParams: {
    bootstrapping: 1000,
    gamma: true,
    model: 'gtr',
    spr: 4,
  },
  lastExecutionTimeMs: null,
  newick: '',

  resetCalculation: () => {
    set({
      error: null,
      lastExecutionTimeMs: null,
      newick: '',
      status: 'idle',
    });
  },
  setEngine: (engine: TreeEngine) => set({ engine }),
  setFastTreeMode: (mode: FastTreeMode) => set({ fastTreeMode: mode }),
  setFastTreeParams: (params: Partial<FastTreeMLParams>) =>
    set((state) => ({ fastTreeParams: { ...state.fastTreeParams, ...params } })),

  setNewick: (newick: string) => set({ error: null, newick, status: 'success' }),

  status: 'idle',
}));
