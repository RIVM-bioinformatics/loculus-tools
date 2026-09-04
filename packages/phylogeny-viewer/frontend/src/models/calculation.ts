export interface CalculationResult {
  engine: TreeEngine;
  newick: string;
  sequenceCount: number;
  timeMs: number;
}

export type CalculationStatus = 'error' | 'idle' | 'loading' | 'success';

export interface FastTreeMLParams {
  bootstrapping: number; // e.g. 1000, 0 for none
  gamma: boolean; // Gamma rate variation
  model: 'gtr' | 'jc';
  spr: number; // SPR rounds
}

export type FastTreeMode = 'ml' | 'noml';

export type TreeEngine = 'fasttree' | 'tn93';
