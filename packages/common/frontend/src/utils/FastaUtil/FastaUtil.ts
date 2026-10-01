import type {
  FastaParseResult,
  FastaPreflightResult,
  FastaRecord,
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

  public static preflightFasta(content: string): FastaPreflightResult {
    const records: FastaRecord[] = [];
    let currentName = '';
    let currentSequence: string[] = [];

    if (!content.trim()) {
      throw new Error('The FASTA input is empty.');
    }

    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }

      if (line.startsWith('>')) {
        if (currentName || currentSequence.length > 0) {
          const error = FastaUtil.flushRecord(records, currentName, currentSequence);
          if (error) {
            throw new Error(error);
          }
        }
        currentName = line.slice(1).trim().split(/\s+/)[0] ?? '';
        currentSequence = [];
        continue;
      }

      if (!currentName) {
        throw new Error('FASTA sequence data appeared before its first header.');
      }
      currentSequence.push(line);
    }

    if (currentName || currentSequence.length > 0) {
      const error = FastaUtil.flushRecord(records, currentName, currentSequence);
      if (error) {
        throw new Error(error);
      }
    }

    if (records.length === 0) {
      throw new Error('No FASTA records were found.');
    }

    const expectedLength = records[0].sequence.length;
    const invalidRecords = records
      .filter((record) => record.sequence.length !== expectedLength)
      .map((record) => ({ length: record.sequence.length, name: record.name }));

    return {
      expectedLength,
      invalidRecords,
      isAligned: invalidRecords.length === 0,
      records,
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

  private static flushRecord(
    records: FastaRecord[],
    name: string,
    sequenceParts: string[],
  ): null | string {
    const sequence = sequenceParts.join('').replace(/\s/g, '').toUpperCase();
    if (!name) {
      return 'Every FASTA record needs a non-empty header.';
    }
    if (!sequence) {
      return `FASTA record "${name}" has no sequence.`;
    }
    records.push({ name, sequence });
    return null;
  }
}
