import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  getVisibleGridRange,
  hitTestGridPoint,
  rangeContains,
  scrollPositionForCell,
} from './grid';

describe('grid geometry helpers', () => {
  it('computes a half-open visible and overscanned cache range', () => {
    const range = getVisibleGridRange(180, 44, 900, 480, 100, 1000);

    expect(range.visible.startCol).toBe(10);
    expect(range.visible.startRow).toBe(0);
    expect(range.cache.startCol).toBe(0);
    expect(rangeContains(range.cache, range.visible)).toBe(true);
  });

  it('hit-tests cells and row labels in the overlay coordinate system', () => {
    expect(hitTestGridPoint(220, 50, { left: 0, top: 0 }, 0, 0)).toMatchObject({ col: 1, row: 1, surface: 'cell' });
    expect(hitTestGridPoint(50, 50, { left: 0, top: 0 }, 0, 0).surface).toBe('gutter');
  });

  it('scrolls a focused cell only as far as necessary', () => {
    expect(scrollPositionForCell({ col: 20, row: 20 }, 0, 0, 900, 480)).toEqual({ left: 0, top: 8 });
  });
});
