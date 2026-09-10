import {
  isCanonicalNatalChartDataComplete,
} from '../lib/natalChartCanonical';
import { canonicalNatalChart } from './fixtures/canonicalNatalChart';

function canonicalChart(
  mode: 'exact' | 'approximate' | 'range' | 'unknown',
) {
  return canonicalNatalChart({ time: {
    mode,
    localTime: mode === 'exact' || mode === 'approximate' ? '08:15' : null,
    uncertaintyMinutes: mode === 'approximate' ? 30 : null,
    rangeStart: mode === 'range' ? '08:00' : null,
    rangeEnd: mode === 'range' ? '09:00' : null,
  } });
}

describe('canonical personality snapshot policy', () => {
  test.each(['exact', 'approximate', 'range', 'unknown'] as const)(
    'accepts the complete canonical %s shape',
    (mode) => expect(isCanonicalNatalChartDataComplete(canonicalChart(mode))).toBe(true),
  );

  test.each(['exact', 'approximate', 'range'] as const)(
    'rejects %s snapshots without the calculated house/angle shape',
    (mode) => {
      const chart = canonicalChart(mode);
      chart.angles = undefined as never;
      chart.houses = [];
      expect(isCanonicalNatalChartDataComplete(chart)).toBe(false);
    },
  );

  test('rejects any time-dependent angle in an unknown-time snapshot', () => {
    const chart = canonicalChart('unknown');
    chart.angles.descendant = { sign: 'Libra' } as never;
    expect(isCanonicalNatalChartDataComplete(chart)).toBe(false);
  });

  test('rejects missing, unsupported, or contradictory reliability modes', () => {
    const missing = canonicalChart('unknown');
    missing.birth.time.mode = undefined as never;
    expect(isCanonicalNatalChartDataComplete(missing)).toBe(false);

    const mismatch = canonicalChart('unknown');
    mismatch.chartQuality.birthTimeQuality = 'exact';
    expect(isCanonicalNatalChartDataComplete(mismatch)).toBe(false);
  });
});
