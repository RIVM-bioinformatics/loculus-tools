import { create } from 'zustand';

import type { FastaParseResult } from '../models/fasta';
import type { MetadataParseResult } from '../models/metadata';
import { FastaUtil } from '../utils/FastaUtil';
import { TvsUtil } from '../utils/TvsUtil';

import { useMetadataStore } from './metadataStore';

interface DatasetState {
  parsedFasta: FastaParseResult | null;
  parsedMetadata: MetadataParseResult | null;
  rawFasta: string;
  rawMetadata: string;

  resetDataset: () => void;
  setFastaContent: (fasta: string) => FastaParseResult;
  setMetadataContent: (tsv: string) => MetadataParseResult;
}

export const useDatasetStore = create<DatasetState>((set, get) => ({
  parsedFasta: null,
  parsedMetadata: null,
  rawFasta: '',
  rawMetadata: '',

  resetDataset: () => {
    set({
      parsedFasta: null,
      parsedMetadata: null,
      rawFasta: '',
      rawMetadata: '',
    });
  },

  setFastaContent: (fasta: string) => {
    const parsed = FastaUtil.parseFasta(fasta);
    set({
      parsedFasta: parsed,
      rawFasta: fasta,
    });

    const currentMetadata = get().parsedMetadata;
    if (currentMetadata && parsed.sequences.length > 0) {
      const fastaIds = parsed.sequences.map((s) => s.id);
      const { bestColumn, matchCounts } = TvsUtil.findBestMatchingColumn(
        currentMetadata.columns,
        currentMetadata.recordsByColumn,
        fastaIds,
      );
      useMetadataStore.getState().setColumnMatchCounts(matchCounts);
      useMetadataStore.getState().setMatchKeyColumn(bestColumn);
    }

    return parsed;
  },

  setMetadataContent: (tsv: string) => {
    const parsed = TvsUtil.parseTsv(tsv);
    set({
      parsedMetadata: parsed,
      rawMetadata: tsv,
    });

    const currentFasta = get().parsedFasta;
    if (parsed && currentFasta && currentFasta.sequences.length > 0) {
      const fastaIds = currentFasta.sequences.map((s) => s.id);
      const { bestColumn, matchCounts } = TvsUtil.findBestMatchingColumn(
        parsed.columns,
        parsed.recordsByColumn,
        fastaIds,
      );
      useMetadataStore.getState().setColumnMatchCounts(matchCounts);
      useMetadataStore.getState().setMatchKeyColumn(bestColumn);
    } else if (parsed && parsed.columns.length > 0) {
      // Default to best candidate
      const prioritized = ['displayName', 'accessionVersion', 'accession', 'SampleID', 'id', 'strain'];
      const defaultCol = prioritized.find((p) => parsed.columns.includes(p)) || parsed.columns[0];
      useMetadataStore.getState().setMatchKeyColumn(defaultCol);
    }

    return parsed;
  },
}));
