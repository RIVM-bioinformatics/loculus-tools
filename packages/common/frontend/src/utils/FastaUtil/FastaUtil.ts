import type {
  FastaParseResult,
  FastaSequence,
} from '../../models/fasta';

export class FastaUtil {
  public static parseFasta(content: string): FastaParseResult {
    if (!content?.trim()) {
      return FastaUtil.createErrorResult('The FASTA input is empty.');
    }

    const lines = content.split(/\r?\n/);
    const sequences: FastaSequence[] = [];
    let currentHeader = '';
    let currentSeqParts: string[] = [];

    const commitSequence = (): void => {
      if (currentHeader) {
        const fullSeq = currentSeqParts.join('').replace(/\s/g, '').toUpperCase();

        // Empty records (a header with no following sequence) are retained with
        // a length of zero rather than being discarded or rejected.

        // Extract ID: part before pipe or tab, sanitized for Newick compatibility
        const firstPart = currentHeader.split(/[|\t]/)[0].trim();
        const safeId = firstPart.replace(/[():;,']/g, '_');

        sequences.push({
          accessionVersion: safeId,
          header: currentHeader,
          id: safeId,
          length: fullSeq.length,
          sequence: fullSeq,
        });
      }
    };

    for (const sourceLine of lines) {
      const line = sourceLine.trim();
      if (!line) {
        continue;
      }

      if (line.startsWith('>')) {
        commitSequence();
        currentHeader = line.slice(1).trim();
        if (!currentHeader) {
          return FastaUtil.createErrorResult('Every FASTA record needs a non-empty header.');
        }
        currentSeqParts = [];
      } else {
        if (!currentHeader) {
          return FastaUtil.createErrorResult('FASTA sequence data appeared before its first header.');
        }
        currentSeqParts.push(line);
      }
    }
    commitSequence();

    if (sequences.length === 0) {
      return FastaUtil.createErrorResult('No FASTA records were found.');
    }

    // Pre-alignment validation: verify all sequence lengths are equal
    const firstLength = sequences[0].length;
    const invalidSequences = sequences.filter((s) => s.length !== firstLength).map((s) => ({ id: s.id, length: s.length }));

    const isAligned = invalidSequences.length === 0;

    return {
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


  private static createErrorResult(error: string): FastaParseResult {
    return {
      error,
      expectedLength: 0,
      isAligned: false,
      sequences: [],
    };
  }

}
