import { createStore } from 'zustand';

import type { ColorMap } from '../models/metadata';

// Distinct categorical color palette for deterministic metadata mapping
const PALETTE = [
  '#0284C7', // Sky Blue
  '#16A34A', // Green
  '#EA580C', // Orange
  '#9333EA', // Purple
  '#DC2626', // Red
  '#0D9488', // Teal
  '#CA8A04', // Amber
  '#4F46E5', // Indigo
  '#DB2777', // Pink
  '#65A30D', // Lime
  '#0891B2', // Cyan
  '#D97706', // Yellow-Orange
  '#7C3AED', // Violet
  '#059669', // Emerald
  '#E11D48', // Rose
  '#2563EB', // Blue
  '#84CC16', // Light Green
  '#94A3B8', // Slate
];

interface MetadataState {
  colorByField: null | string;
  colorMap: ColorMap;
  columnMatchCounts: Record<string, number>;
  matchKeyColumn: null | string;
  resetMetadataState: () => void;
  selectedLabelFields: string[];

  setColorByField: (field: null | string, uniqueValues?: string[], values?: string[]) => void;
  setColumnMatchCounts: (counts: Record<string, number>) => void;
  setMatchKeyColumn: (col: null | string) => void;
  setSelectedLabelFields: (fields: string[]) => void;
  toggleLabelField: (field: string) => void;
  valueCounts: Record<string, number>;
}

export const generateDeterministicColor = (value: string, index = 0): string => {
  if (!value || value === '-' || value.toLowerCase() === 'na' || value.toLowerCase() === 'null') {
    return '#94A3B8'; // Missing value color
  }
  if (index < PALETTE.length) {
    return PALETTE[index];
  }
  // Hash-based HSL color fallback for large number of unique categories
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 45%)`;
};

export const metadataStore = createStore<MetadataState>((set) => ({
  colorByField: null,
  colorMap: {},
  columnMatchCounts: {},
  matchKeyColumn: null,
  resetMetadataState: () => {
    set({
      colorByField: null,
      colorMap: {},
      columnMatchCounts: {},
      matchKeyColumn: null,
      selectedLabelFields: [],
      valueCounts: {},
    });
  },
  selectedLabelFields: [],

  setColorByField: (field: null | string, uniqueValues: string[] = [], values: string[] = []) => {
    if (!field) {
      set({ colorByField: null, colorMap: {}, valueCounts: {} });
      return;
    }

    const counts: Record<string, number> = {};
    values.forEach((v) => {
      if (v) {
        counts[v] = (counts[v] || 0) + 1;
      }
    });

    const newMap: ColorMap = {};
    uniqueValues.forEach((val, idx) => {
      newMap[val] = generateDeterministicColor(val, idx);
    });

    set({
      colorByField: field,
      colorMap: newMap,
      valueCounts: counts,
    });
  },

  setColumnMatchCounts: (counts: Record<string, number>) => {
    set({ columnMatchCounts: counts });
  },

  setMatchKeyColumn: (col: null | string) => {
    set({ matchKeyColumn: col });
  },

  setSelectedLabelFields: (fields: string[]) => {
    set({ selectedLabelFields: fields });
  },

  toggleLabelField: (field: string) => {
    set((state) => {
      const exists = state.selectedLabelFields.includes(field);
      const next = exists
        ? state.selectedLabelFields.filter((f) => f !== field)
        : [...state.selectedLabelFields, field];
      return { selectedLabelFields: next };
    });
  },

  valueCounts: {},
}));
