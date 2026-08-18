import { create } from 'zustand';
import type { TreeEngine, FastTreeMode, FastTreeMLParams, CalculationStatus } from '../types/calculation';
import { calculateTN93Tree } from '../services/biowasm/tn93Service';
import { calculateFastTree } from '../services/biowasm/fasttreeService';
import { useDatasetStore } from './datasetStore';

interface CalculationState {
  engine: TreeEngine;
  fastTreeMode: FastTreeMode;
  fastTreeParams: FastTreeMLParams;
  status: CalculationStatus;
  error: string | null;
  newick: string;
  lastExecutionTimeMs: number | null;

  setEngine: (engine: TreeEngine) => void;
  setFastTreeMode: (mode: FastTreeMode) => void;
  setFastTreeParams: (params: Partial<FastTreeMLParams>) => void;
  setNewick: (newick: string) => void;
  calculateTree: (overrideFasta?: string) => Promise<string | null>;
  resetCalculation: () => void;
}

export const useCalculationStore = create<CalculationState>((set, get) => ({
  engine: 'tn93',
  fastTreeMode: 'noml',
  fastTreeParams: {
    model: 'gtr',
    bootstrapping: 1000,
    spr: 4,
    gamma: true,
  },
  status: 'idle',
  error: null,
  newick: '',
  lastExecutionTimeMs: null,

  setEngine: (engine: TreeEngine) => set({ engine }),
  setFastTreeMode: (mode: FastTreeMode) => set({ fastTreeMode: mode }),
  setFastTreeParams: (params: Partial<FastTreeMLParams>) =>
    set((state) => ({ fastTreeParams: { ...state.fastTreeParams, ...params } })),
  setNewick: (newick: string) => set({ newick, status: 'success', error: null }),

  calculateTree: async (overrideFasta?: string) => {
    const rawFasta = overrideFasta ?? useDatasetStore.getState().rawFasta;
    const parsedFasta = useDatasetStore.getState().parsedFasta;

    if (!rawFasta || !rawFasta.trim()) {
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

    set({ status: 'loading', error: null });
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
        newick: generatedNewick,
        status: 'success',
        error: null,
        lastExecutionTimeMs: durationMs,
      });

      return generatedNewick;
    } catch (err: any) {
      console.error('[CalculationStore] Error during tree calculation:', err);
      const errMsg = err?.message || 'Failed to calculate phylogenetic tree.';
      set({
        error: errMsg,
        status: 'error',
      });
      return null;
    }
  },

  resetCalculation: () => {
    set({
      status: 'idle',
      error: null,
      newick: '',
      lastExecutionTimeMs: null,
    });
  },
}));
