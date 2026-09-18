export interface FastaPreflightResult {
  expectedLength: number;
  invalidRecords: { length: number; name: string }[];
  isAligned: boolean;
  records: FastaRecord[];
}

export interface FastaRecord {
  name: string;
  sequence: string;
}

const flushRecord = (
  records: FastaRecord[],
  name: string,
  sequenceParts: string[],
): null | string => {
  const sequence = sequenceParts.join('').replace(/\s/g, '').toUpperCase();
  if (!name) {
    return 'Every FASTA record needs a non-empty header.';
  }
  if (!sequence) {
    return `FASTA record "${name}" has no sequence.`;
  }
  records.push({ name, sequence });
  return null;
};

export const preflightFasta = (content: string): FastaPreflightResult => {
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
        const error = flushRecord(records, currentName, currentSequence);
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
    const error = flushRecord(records, currentName, currentSequence);
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
};

export const datasetFilename = (label: string): string => {
  const withoutExtension = label.trim().replace(/\.[^.]+$/, '');
  const safeLabel = withoutExtension
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 80);
  return `${safeLabel || 'alignment'}.fasta`;
};

export const downloadText = (content: string, filename: string): void => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.download = filename;
  anchor.href = url;
  document.body.append(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 0);
};
