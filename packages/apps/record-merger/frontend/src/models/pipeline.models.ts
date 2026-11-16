export enum PIPELINE_STATUS {
  ALIGNING = 'ALIGNING',
  CALLING_CONSENSUS = 'CALLING_CONSENSUS',
  ERROR = 'ERROR',
  IDLE = 'IDLE',
  SORTING_INDEXING = 'SORTING_INDEXING',
  SUCCESS = 'SUCCESS',
}

export type AlignmentResult = {
  baiBlobUrl: string;
  bamBlobUrl: string;
  executionTimeMs: number;
  preset: Minimap2Preset;
  referenceFaiBlobUrl: string;
  referenceFastaBlobUrl: string;
  referenceId: string;
  referenceLength: number;
  selectedIds: string[];
};

export type ConsensusMode = 'bayesian' | 'simple';

export type ConsensusParams = {
  callFract: number;
  minDepth: number;
  mode: ConsensusMode;
  preset: Minimap2Preset;
  showDel: boolean;
  showIns: boolean;
};

export type ConsensusResult = {
  consensusFasta: string;
  consensusHeader: string;
  consensusSequence: string;
  executionTimeMs: number;
  params: ConsensusParams;
  referenceId: string;
  selectedIds: string[];
};

export type Minimap2Preset = 'asm10' | 'asm20' | 'asm5' | 'map-ont' | 'sr';

export type RecordMergerStep =
  | 'INSPECT_ALIGNMENT'
  | 'REVIEW_MERGE'
  | 'SELECT_RECORDS'
  | 'UPLOAD_COMBINED';
