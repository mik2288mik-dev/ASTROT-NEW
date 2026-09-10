import { isReadableNatalChart } from '../lib/readableNatalChart';
import { hasNatalChart } from '../lib/accessMatrix';

const bodies = {
  sun: { sign: 'Aries' },
  moon: { sign: 'Taurus' },
};

describe('readable natal chart boundary', () => {
  it.each([
    ['approximate', 'approximate'],
    ['range', 'approximate'],
    ['unknown', 'unknown'],
  ])('accepts %s time without a reliable Ascendant', (mode, quality) => {
    const chart = {
      ...bodies,
      rising: null,
      birth: { time: { mode } },
      birthTimeQuality: quality,
    };
    expect(isReadableNatalChart(chart)).toBe(true);
    expect(hasNatalChart({ chartData: chart } as never)).toBe(true);
  });

  it('still rejects an exact chart without its required Ascendant', () => {
    expect(isReadableNatalChart({
      ...bodies,
      rising: null,
      birth: { time: { mode: 'exact' } },
      birthTimeQuality: 'exact',
    })).toBe(false);
  });

  it('rejects a chart without the core Sun and Moon positions', () => {
    expect(isReadableNatalChart({ birthTimeQuality: 'unknown' })).toBe(false);
  });
});
