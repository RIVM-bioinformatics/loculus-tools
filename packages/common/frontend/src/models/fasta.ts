export enum CALCULATION_STATUS {
  ERROR = 'ERROR',
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
}

export type FastaParseResult = {
  error?: string;
  expectedLength: number;
  invalidSequences?: { id: string; length: number }[];
  isAligned: boolean;
  sequences: FastaSequence[];
};

export type FastaPreflightResult = {
  expectedLength: number;
  invalidRecords: { length: number; name: string }[];
  isAligned: boolean;
  records: FastaRecord[];
};

export type FastaRecord = {
  name: string;
  sequence: string;
};

export type FastaSequence = {
  accessionVersion: string;
  header: string;
  id: string;
  length: number;
  sequence: string;
};
