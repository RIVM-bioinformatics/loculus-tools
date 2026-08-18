import type { MetadataParseResult, MetadataRecord } from '../../types/metadata';

export function parseTsv(content: string): MetadataParseResult {
  if (!content || !content.trim()) {
    return {
      records: [],
      columns: [],
      recordsByAccession: {},
      recordsBySampleId: {},
      recordsByColumn: {},
      error: 'Empty metadata content provided.',
    };
  }

  const lines = content.trim().split('\n');
  if (lines.length < 2) {
    return {
      records: [],
      columns: [],
      recordsByAccession: {},
      recordsBySampleId: {},
      recordsByColumn: {},
      error: 'Metadata file must contain at least a header row and one data row.',
    };
  }

  // Parse header row
  const headerLine = lines[0].trim();
  const delimiter = headerLine.includes('\t') ? '\t' : headerLine.includes(',') ? ',' : '\t';
  const columns = headerLine
    .split(delimiter)
    .map((col) => col.trim().replace(/^["']|["']$/g, ''))
    .filter((c) => c.length > 0);

  const records: MetadataRecord[] = [];
  const recordsByAccession: Record<string, MetadataRecord> = {};
  const recordsBySampleId: Record<string, MetadataRecord> = {};
  const recordsByColumn: Record<string, Record<string, MetadataRecord>> = {};

  columns.forEach((col) => {
    recordsByColumn[col] = {};
  });

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(delimiter).map((val) => val.trim().replace(/^["']|["']$/g, ''));
    const record: MetadataRecord = {};

    columns.forEach((col, colIdx) => {
      const val = values[colIdx] ?? '';
      record[col] = val;
      if (val) {
        recordsByColumn[col][val] = record;
      }
    });

    records.push(record);

    // Index by potential ID keys
    const accessionKey =
      record.displayName ||
      record.accessionVersion ||
      record.accession ||
      record.id ||
      record.submissionId ||
      record.strain ||
      record.isolate ||
      record.name;

    if (accessionKey) {
      recordsByAccession[accessionKey] = record;
    }

    const sampleIdKey =
      record.SampleID ||
      record.sampleId ||
      record.sample_id ||
      record.specimenCollectorSampleId ||
      record.id;

    if (sampleIdKey) {
      recordsBySampleId[sampleIdKey] = record;
    }
  }

  return {
    records,
    columns,
    recordsByAccession,
    recordsBySampleId,
    recordsByColumn,
  };
}

/**
 * Retrieve metadata record for a given sample/node name with fallback strategies.
 */
export function getRecordForSample(
  metadata: MetadataParseResult | null | undefined,
  sampleId: string,
  matchKeyColumn?: string | null
): MetadataRecord | undefined {
  if (!metadata || !sampleId) return undefined;

  // 1. If matchKeyColumn is specified and exists, check it first
  if (matchKeyColumn && metadata.recordsByColumn?.[matchKeyColumn]) {
    const rec = metadata.recordsByColumn[matchKeyColumn][sampleId];
    if (rec) return rec;
  }

  // 2. Check displayName
  if (metadata.recordsByColumn?.['displayName']?.[sampleId]) {
    return metadata.recordsByColumn['displayName'][sampleId];
  }

  // 3. Check accessionVersion
  if (metadata.recordsByColumn?.['accessionVersion']?.[sampleId]) {
    return metadata.recordsByColumn['accessionVersion'][sampleId];
  }

  // 4. Check accession maps
  if (metadata.recordsByAccession[sampleId]) {
    return metadata.recordsByAccession[sampleId];
  }
  if (metadata.recordsBySampleId[sampleId]) {
    return metadata.recordsBySampleId[sampleId];
  }

  // 5. Broad search through all indexed columns
  if (metadata.recordsByColumn) {
    for (const col of Object.keys(metadata.recordsByColumn)) {
      const match = metadata.recordsByColumn[col][sampleId];
      if (match) return match;
    }
  }

  return undefined;
}

/**
 * Compute the best matching metadata column for the given FASTA sequence IDs.
 */
export function findBestMatchingColumn(
  columns: string[],
  recordsByColumn: Record<string, Record<string, MetadataRecord>>,
  fastaIds: string[]
): { bestColumn: string | null; matchCounts: Record<string, number> } {
  const matchCounts: Record<string, number> = {};
  let bestColumn: string | null = null;
  let maxMatches = -1;

  if (!columns || !recordsByColumn || !fastaIds || fastaIds.length === 0) {
    return { bestColumn: null, matchCounts: {} };
  }

  const prioritizedKeys = [
    'displayname',
    'accessionversion',
    'accession',
    'sampleid',
    'sample_id',
    'id',
    'strain',
    'isolate',
    'submissionid',
    'name',
  ];

  for (const col of columns) {
    const colDict = recordsByColumn[col];
    if (!colDict) continue;

    let count = 0;
    for (const id of fastaIds) {
      if (colDict[id]) {
        count++;
      }
    }
    matchCounts[col] = count;

    if (count > maxMatches) {
      maxMatches = count;
      bestColumn = col;
    } else if (count === maxMatches && count > 0 && bestColumn) {
      // Tie-breaker: prioritize standard ID column names
      const currentPriority = prioritizedKeys.indexOf(bestColumn.toLowerCase());
      const newPriority = prioritizedKeys.indexOf(col.toLowerCase());
      if (newPriority !== -1 && (currentPriority === -1 || newPriority < currentPriority)) {
        bestColumn = col;
      }
    }
  }

  if (maxMatches <= 0) {
    // If no matches, default to highest priority known ID column if available
    for (const pKey of prioritizedKeys) {
      const found = columns.find((c) => c.toLowerCase() === pKey);
      if (found) {
        bestColumn = found;
        break;
      }
    }
    if (!bestColumn && columns.length > 0) {
      bestColumn = columns[0];
    }
  }

  return { bestColumn, matchCounts };
}
