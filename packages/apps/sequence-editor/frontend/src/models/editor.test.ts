import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  editorReducer,
  initialEditorState,
} from './editor';

describe('editorReducer', () => {
  it('increments the data revision and clears stale search after a mutation', () => {
    const withSearch = editorReducer(initialEditorState, {
      type: 'setSearchResults',
      value: {
        num_matches: 0,
        positions: [],
        query: 'AC',
        truncated: false,
      },
    });
    const next = editorReducer(withSearch, {
      dirty: true,
      status: 'Edit applied.',
      type: 'commandSucceeded',
      updateRevision: true,
    });

    expect(next.dataRevision).toBe(1);
    expect(next.dirty).toBe(true);
    expect(next.searchResults).toBeNull();
    expect(next.status).toBe('Edit applied.');
  });

  it('keeps the active cell focused after a rejected edit', () => {
    const focused = { ...initialEditorState, cellFocused: true };
    const next = editorReducer(focused, {
      message: 'Delete failed.',
      type: 'commandFailed',
    });

    expect(next.cellFocused).toBe(true);
    expect(next.error).toBe('Delete failed.');
  });
});
