import type {
  FastaParseResult,
  FastaSequence,
} from '../../models/fasta';

export class FastaUtil {
  public static parseFasta(content: string): FastaParseResult {
    if (!content?.trim()) {
      return {
        error: 'Empty FASTA content provided.',
        expectedLength: 0,
        isAligned: true,
        sequences: [],
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
            accessionVersion: safeId,
            header: cleanHeader,
            id: safeId,
            length: fullSeq.length,
            sequence: fullSeq,
          });
        }
      }
    };

    for (const sourceLine of lines) {
      const line = sourceLine.trim();
      if (!line) {
        continue;
      }

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
        error: 'No valid FASTA sequence entries found in input.',
        expectedLength: 0,
        isAligned: true,
        sequences: [],
      };
    }

    // Pre-alignment validation: verify all sequence lengths are equal
    const firstLength = sequences[0].length;
    const invalidSequences = sequences.filter((s) => s.length !== firstLength).map((s) => ({ id: s.id, length: s.length }));

    const isAligned = invalidSequences.length === 0;

    return {
      error: isAligned
        ? undefined
        : 'Tree calculation failed: The provided FASTA sequences are not aligned. Please align your sequences before loading them into the viewer.',
      expectedLength: firstLength,
      invalidSequences: isAligned ? undefined : invalidSequences,
      isAligned,
      sequences,
    };
  }

  public static stripFastaHeaders(fastaContent: string): string {
    const lines = fastaContent.split('\n');
    const strippedLines = lines.map((line) => {
      if (line.startsWith('>')) {
        const cleanHeader = line.substring(1).trim();
        const firstPart = cleanHeader.split(/[|\t]/)[0].trim();
        const safeId = firstPart.replace(/[():;,']/g, '_');
        return `>${safeId}`;
      }
      return line;
    });
    return strippedLines.join('\n');
  }
}
