import { MatrixType } from '../engine/protocol';
import type {
  SearchMatch,
  SearchResult,
} from '../engine/protocol';

export const filterSearchResults = (
  result: SearchResult,
  includeRecordNames: boolean,
): SearchResult => {
  const positions = result.positions.filter((position) => (
    position.matrix_type === MatrixType.Nucleotide
    || (includeRecordNames && position.matrix_type === MatrixType.RecordName)
  ));
  return {
    ...result,
    num_matches: positions.length,
    positions,
  };
};

export const wrapSearchIndex = (index: number, change: number, count: number): number => {
  if (count === 0) {
    return 0;
  }
  return (index + change + count) % count;
};

export const searchHitAt = (result: null | SearchResult, index: number): null | SearchMatch => (
  result?.positions[index] ?? null
);

export const searchHitContainsCell = (
  hit: SearchMatch,
  query: string,
  row: number,
  col: number,
): boolean => (
  hit.matrix_type === MatrixType.Nucleotide
  && hit.row === row
  && col >= hit.col
  && col < hit.col + Math.max(1, query.length)
);
