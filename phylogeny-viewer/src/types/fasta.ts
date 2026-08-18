export interface FastaSequence {
  id: string;
  header: string;
  accessionVersion: string;
  sequence: string;
  length: number;
}

export interface FastaParseResult {
  sequences: FastaSequence[];
  isAligned: boolean;
  expectedLength: number;
  invalidSequences?: { id: string; length: number }[];
  error?: string;
}
