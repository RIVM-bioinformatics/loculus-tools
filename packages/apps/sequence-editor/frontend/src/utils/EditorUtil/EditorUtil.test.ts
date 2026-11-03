// @vitest-environment node
import 'reflect-metadata';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  EditorSelection,
  EngineMeta,
} from '../../models/editor.models';

import { EditorUtil } from './EditorUtil';

describe('EditorUtil.getRowsToDelete', () => {
  const dummyMeta: EngineMeta = {
    alignmentWidth: 10,
    redoDepth: 0,
    sequenceCount: 5,
    undoDepth: 0,
  };

  it('returns undefined when selection is null', () => {
    expect(EditorUtil.getRowsToDelete(null, dummyMeta)).toBeUndefined();
  });

  it('returns undefined when sequenceCount is 0', () => {
    const emptyMeta: EngineMeta = { ...dummyMeta, sequenceCount: 0 };
    const selection: EditorSelection = { rows: [0] };
    expect(EditorUtil.getRowsToDelete(selection, emptyMeta)).toBeUndefined();
  });

  it('returns selected rows deduplicated and sorted in ascending order', () => {
    const selection: EditorSelection = { rows: [3, 1, 3, 2] };
    expect(EditorUtil.getRowsToDelete(selection, dummyMeta)).toEqual([1, 2, 3]);
  });

  it('allows selecting and deleting all rows', () => {
    const selection: EditorSelection = { rows: [4, 3, 2, 1, 0] };
    expect(EditorUtil.getRowsToDelete(selection, dummyMeta)).toEqual([0, 1, 2, 3, 4]);
  });

  it('filters out-of-bounds row indices', () => {
    const selection: EditorSelection = { rows: [-1, 2, 5, 10] };
    expect(EditorUtil.getRowsToDelete(selection, dummyMeta)).toEqual([2]);
  });

  it('returns undefined if all selected row indices are out of bounds', () => {
    const selection: EditorSelection = { rows: [-1, 5, 10] };
    expect(EditorUtil.getRowsToDelete(selection, dummyMeta)).toBeUndefined();
  });

  it('extracts rows from cell block selection', () => {
    const selection: EditorSelection = {
      cells: { endCol: 8, endRow: 3, startCol: 2, startRow: 1 },
    };
    expect(EditorUtil.getRowsToDelete(selection, dummyMeta)).toEqual([1, 2, 3]);
  });

  it('extracts rows from reversed cell block selection (dragged bottom to top)', () => {
    const selection: EditorSelection = {
      cells: { endCol: 2, endRow: 1, startCol: 8, startRow: 3 },
    };
    expect(EditorUtil.getRowsToDelete(selection, dummyMeta)).toEqual([1, 2, 3]);
  });

  it('returns undefined for pure column selection', () => {
    const selection: EditorSelection = { cols: [0, 1, 2] };
    expect(EditorUtil.getRowsToDelete(selection, dummyMeta)).toBeUndefined();
  });
});
