import type { FastaSequence, FastaParseResult } from '../../types/fasta';

export function parseFasta(content: string): FastaParseResult {
  if (!content || !content.trim()) {
    return {
      sequences: [],
      isAligned: true,
      expectedLength: 0,
      error: 'Empty FASTA content provided.',
    };
  }

  const lines = content.split('\n');
  const sequences: FastaSequence[] = [];
  let currentHeader = '';
  let currentSeqParts: string[] = [];

  const commitSequence = () => {
    if (currentHeader) {
      const fullSeq = currentSeqParts.join('').replace(/\s/g, '').toUpperCase();
      if (fullSeq.length > 0) {
        // Extract ID: part before pipe or tab, sanitized for Newick compatibility
        const cleanHeader = currentHeader.startsWith('>') ? currentHeader.substring(1).trim() : currentHeader.trim();
        const firstPart = cleanHeader.split(/[|\t]/)[0].trim();
        const safeId = firstPart.replace(/[():;,']/g, '_');

        sequences.push({
          id: safeId,
          header: cleanHeader,
          accessionVersion: safeId,
          sequence: fullSeq,
          length: fullSeq.length,
        });
      }
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('>')) {
      commitSequence();
      currentHeader = line;
      currentSeqParts = [];
    } else {
      currentSeqParts.push(line);
    }
  }
  commitSequence();

  if (sequences.length === 0) {
    return {
      sequences: [],
      isAligned: true,
      expectedLength: 0,
      error: 'No valid FASTA sequence entries found in input.',
    };
  }

  // Pre-alignment validation: verify all sequence lengths are equal
  const firstLength = sequences[0].length;
  const invalidSequences = sequences.filter((s) => s.length !== firstLength).map((s) => ({ id: s.id, length: s.length }));

  const isAligned = invalidSequences.length === 0;

  return {
    sequences,
    isAligned,
    expectedLength: firstLength,
    invalidSequences: isAligned ? undefined : invalidSequences,
    error: isAligned
      ? undefined
      : 'Tree calculation failed: The provided FASTA sequences are not aligned. Please align your sequences before loading them into the viewer.',
  };
}
