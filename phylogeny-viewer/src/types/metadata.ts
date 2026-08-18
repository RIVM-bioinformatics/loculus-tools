export type MetadataRecord = Record<string, string>;

export interface MetadataParseResult {
  records: MetadataRecord[];
  columns: string[];
  recordsByAccession: Record<string, MetadataRecord>;
  recordsBySampleId: Record<string, MetadataRecord>;
  recordsByColumn: Record<string, Record<string, MetadataRecord>>;
  error?: string;
}

export type ColorMap = Record<string, string>;
