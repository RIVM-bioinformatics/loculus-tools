import { create } from 'zustand';
import type { FastaParseResult } from '../types/fasta';
import type { MetadataParseResult } from '../types/metadata';
import { parseFasta } from '../services/parsers/fastaParser';
import { parseTsv, findBestMatchingColumn } from '../services/parsers/tsvParser';
import { useMetadataStore } from './metadataStore';

interface DatasetState {
  rawFasta: string;
  parsedFasta: FastaParseResult | null;
  rawMetadata: string;
  parsedMetadata: MetadataParseResult | null;
  alignmentErrorDismissed: boolean;

  setFastaContent: (fasta: string) => FastaParseResult;
  setMetadataContent: (tsv: string) => MetadataParseResult;
  setAlignmentErrorDismissed: (dismissed: boolean) => void;
  resetDataset: () => void;
}

export const useDatasetStore = create<DatasetState>((set, get) => ({
  rawFasta: '',
  parsedFasta: null,
  rawMetadata: '',
  parsedMetadata: null,
  alignmentErrorDismissed: false,

  setFastaContent: (fasta: string) => {
    const parsed = parseFasta(fasta);
    set({
      rawFasta: fasta,
      parsedFasta: parsed,
      alignmentErrorDismissed: false,
    });

    const currentMetadata = get().parsedMetadata;
    if (currentMetadata && parsed.sequences.length > 0) {
      const fastaIds = parsed.sequences.map((s) => s.id);
      const { bestColumn, matchCounts } = findBestMatchingColumn(
        currentMetadata.columns,
        currentMetadata.recordsByColumn,
        fastaIds
      );
      useMetadataStore.getState().setColumnMatchCounts(matchCounts);
      useMetadataStore.getState().setMatchKeyColumn(bestColumn);
    }

    return parsed;
  },

  setMetadataContent: (tsv: string) => {
    const parsed = parseTsv(tsv);
    set({
      rawMetadata: tsv,
      parsedMetadata: parsed,
    });

    const currentFasta = get().parsedFasta;
    if (parsed && currentFasta && currentFasta.sequences.length > 0) {
      const fastaIds = currentFasta.sequences.map((s) => s.id);
      const { bestColumn, matchCounts } = findBestMatchingColumn(
        parsed.columns,
        parsed.recordsByColumn,
        fastaIds
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

  setAlignmentErrorDismissed: (dismissed: boolean) => {
    set({ alignmentErrorDismissed: dismissed });
  },

  resetDataset: () => {
    set({
      rawFasta: '',
      parsedFasta: null,
      rawMetadata: '',
      parsedMetadata: null,
      alignmentErrorDismissed: false,
    });
  },
}));
