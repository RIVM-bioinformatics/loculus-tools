export type ColorMap = Record<string, string>;

export interface MetadataParseResult {
  columns: string[];
  error?: string;
  records: MetadataRecord[];
  recordsByAccession: Record<string, MetadataRecord>;
  recordsByColumn: Record<string, Record<string, MetadataRecord>>;
  recordsBySampleId: Record<string, MetadataRecord>;
}

export type MetadataRecord = Record<string, string>;
