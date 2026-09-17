export interface FastaParseResult {
  error?: string;
  expectedLength: number;
  invalidSequences?: { id: string; length: number }[];
  isAligned: boolean;
  sequences: FastaSequence[];
}

export interface FastaSequence {
  accessionVersion: string;
  header: string;
  id: string;
  length: number;
  sequence: string;
}
