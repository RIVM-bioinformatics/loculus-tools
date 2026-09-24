import {
  describe,
  expect,
  it,
} from 'vitest';

import { getEngineErrorMessage } from './engineErrors';

describe('getEngineErrorMessage', () => {
  it('maps structured engine codes to non-destructive UI copy', () => {
    expect(getEngineErrorMessage({ code: 'DeleteNotGap' })).toBe('Delete failed: the selected position is not a gap.');
    expect(getEngineErrorMessage({ code: 'UnknownCode' })).toBe('The sequence-editor command failed.');
    expect(getEngineErrorMessage(new Error('worker unavailable'))).toBe('worker unavailable');
  });
});
