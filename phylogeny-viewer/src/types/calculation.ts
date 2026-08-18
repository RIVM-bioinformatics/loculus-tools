export type TreeEngine = 'tn93' | 'fasttree';

export type FastTreeMode = 'noml' | 'ml';

export interface FastTreeMLParams {
  model: 'gtr' | 'jc';
  bootstrapping: number; // e.g. 1000, 0 for none
  spr: number; // SPR rounds
  gamma: boolean; // Gamma rate variation
}

export type CalculationStatus = 'idle' | 'loading' | 'success' | 'error';

export interface CalculationResult {
  newick: string;
  engine: TreeEngine;
  timeMs: number;
  sequenceCount: number;
}
