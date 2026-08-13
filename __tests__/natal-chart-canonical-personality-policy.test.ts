import {
  CANONICAL_NATAL_CALCULATION_VERSION,
  NATAL_CHART_SCHEMA_VERSION,
  isCanonicalNatalChartDataComplete,
} from '../lib/natalChartCanonical';

function canonicalChart(
  mode: 'exact' | 'approximate' | 'range' | 'unknown',
) {
  const quality = mode === 'exact' ? 'exact' : mode === 'unknown' ? 'unknown' : 'approximate';
  const angle = { sign: 'Aries', degree: 3, reliability: mode === 'exact' ? 'exact' : 'stable_in_range' };
  return {
    schemaVersion: NATAL_CHART_SCHEMA_VERSION,
    calculationVersion: CANONICAL_NATAL_CALCULATION_VERSION,
    birth: { time: { mode } },
    positions: {
      sun: { sign: 'Aries' },
      moon: { sign: 'Cancer' },
      chiron: { sign: 'Gemini' },
      northNode: { sign: 'Libra' },
    },
    angles: mode === 'unknown'
      ? { ascendant: null, mc: null, descendant: null, ic: null }
      : { ascendant: angle, mc: angle, descendant: angle, ic: angle },
    houses: mode === 'unknown'
      ? []
      : Array.from({ length: 12 }, (_, index) => ({ house: index + 1 })),
    aspects: [],
    chartQuality: { birthTimeMode: mode, birthTimeQuality: quality },
    calculationMetadata: { ephemerisEngine: 'Swiss Ephemeris' },
    birthTimeQuality: quality,
  };
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
