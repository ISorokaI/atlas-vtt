import { describe, expect, it } from 'vitest';
import { strokeHolds, visibleGridStroke } from '../../src/app/grid/gridLineStyle';

describe('visibleGridStroke', () => {
  it('keeps a line that is at least a device pixel wide', () => {
    expect(visibleGridStroke(1, 0.7, 1)).toEqual({ width: 1, alpha: 0.7 });
    expect(visibleGridStroke(2, 0.7, 0.5)).toEqual({ width: 2, alpha: 0.7 });
  });

  it('draws a thinner line one device pixel wide and fainter by as much', () => {
    expect(visibleGridStroke(1, 0.8, 0.25)).toEqual({ width: 4, alpha: 0.2 });
  });

  it('redraws when the lines would vanish or stay heavy', () => {
    const drawn = visibleGridStroke(1, 1, 0.5);
    expect(strokeHolds(drawn, visibleGridStroke(1, 1, 0.55))).toBe(true);
    expect(strokeHolds(drawn, visibleGridStroke(1, 1, 0.4))).toBe(false);
    expect(strokeHolds(drawn, visibleGridStroke(1, 1, 1))).toBe(false);
  });
});
