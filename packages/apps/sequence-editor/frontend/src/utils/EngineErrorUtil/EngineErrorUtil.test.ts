// @vitest-environment node
import {
  describe,
  expect,
  it,
} from 'vitest';

import { EngineErrorUtil } from './EngineErrorUtil';

describe('EngineErrorUtil', () => {
  it('recognizes structured engine errors, including ones with context', () => {
    expect(EngineErrorUtil.isStructuredEngineError({ code: 'StaleRevision', message: 'stale' })).toBe(true);
    expect(EngineErrorUtil.isStructuredEngineError({ code: 'AlignmentMismatch', context: { row: 1 }, message: 'bad' })).toBe(true);
  });

  it('rejects values without a string code and message', () => {
    expect(EngineErrorUtil.isStructuredEngineError(new Error('plain'))).toBe(false);
    expect(EngineErrorUtil.isStructuredEngineError({ code: 1, message: 'numeric code' })).toBe(false);
    expect(EngineErrorUtil.isStructuredEngineError({ code: 'NoMessage' })).toBe(false);
    expect(EngineErrorUtil.isStructuredEngineError(null)).toBe(false);
    expect(EngineErrorUtil.isStructuredEngineError('StaleRevision')).toBe(false);
  });

  it('formats structured errors and falls back for other values', () => {
    expect(EngineErrorUtil.getEngineErrorMessage({ code: 'StaleRevision', message: 'stale' })).toBe('StaleRevision - stale');
    expect(EngineErrorUtil.getEngineErrorMessage({ code: 'NoMessage' })).toBe('NoMessage - The sequence-editor command failed.');
    expect(EngineErrorUtil.getEngineErrorMessage(new Error('plain'))).toBe('plain');
  });
});
