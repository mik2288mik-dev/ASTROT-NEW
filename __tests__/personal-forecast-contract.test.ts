import {
  FIXED_FORECAST_TOPIC_KEYS,
  PERSONAL_FORECAST_FREE_READING_TOPIC,
  buildPersonalForecastCacheKey,
  buildPersonalForecastChartFingerprint,
  getNextPersonalForecastPeriodKey,
  getPersonalForecastPeriodKey,
  getPreviousPersonalForecastPeriodKey,
  isPersonalForecastPackage,
  resolvePersonalForecastWindow,
  slicePersonalForecastForAccess,
} from '../lib/personalForecastContract';
import {
  chartFixture,
  personalForecastFixture,
} from './personal-forecast-fixture';

describe('personal forecast V2 contract', () => {
  it('keeps exactly seven fixed topics and validates 2-3 dynamic topics', () => {
    expect(FIXED_FORECAST_TOPIC_KEYS).toEqual([
      'overview',
      'love',
      'work',
      'money',
      'mood_energy',
      'communication',
      'luck',
    ]);
    expect(isPersonalForecastPackage(personalForecastFixture())).toBe(true);
    expect(isPersonalForecastPackage({
      ...personalForecastFixture(),
      dynamic: personalForecastFixture().dynamic.slice(0, 1),
    })).toBe(false);
  });

  it('rejects missing or unknown evidence IDs', () => {
    const missing = personalForecastFixture();
    missing.love.astrology.evidence_ids = ['missing'];
    expect(isPersonalForecastPackage(missing)).toBe(false);
  });

  it('uses timezone-aware day, ISO week, month and year keys', () => {
    const instant = new Date('2026-12-31T22:30:00.000Z');
    expect(getPersonalForecastPeriodKey('day', instant, 'Europe/Moscow')).toBe('2027-01-01');
    expect(getPersonalForecastPeriodKey('month', instant, 'Europe/Moscow')).toBe('2027-01');
    expect(getPersonalForecastPeriodKey('year', instant, 'Europe/Moscow')).toBe('2027');
    expect(getPersonalForecastPeriodKey('week', instant, 'Europe/Moscow')).toMatch(/^2026-W53$|^2027-W01$/);
  });

  it('resolves full period boundaries and adjacent period keys', () => {
    const month = resolvePersonalForecastWindow('month', '2026-02', 'Europe/Moscow');
    expect(month.periodStart).toBe('2026-02-01');
    expect(month.periodEnd).toBe('2026-02-28');
    expect(getNextPersonalForecastPeriodKey('month', '2026-02', 'Europe/Moscow')).toBe('2026-03');
    expect(getPreviousPersonalForecastPeriodKey('month', '2026-02', 'Europe/Moscow')).toBe('2026-01');
  });

  it('changes cache identity for chart, period, language and model', () => {
    const base = {
      userId: '42',
      chartId: 7,
      chartData: chartFixture,
      period: 'day' as const,
      periodKey: '2026-07-26',
      timezone: 'Europe/Moscow',
      language: 'ru' as const,
      modelId: 'gpt-4.1',
    };
    const values = [
      buildPersonalForecastCacheKey(base),
      buildPersonalForecastCacheKey({ ...base, periodKey: '2026-07-27' }),
      buildPersonalForecastCacheKey({ ...base, language: 'en' }),
      buildPersonalForecastCacheKey({ ...base, modelId: 'gpt-4.1-mini' }),
      buildPersonalForecastCacheKey({
        ...base,
        chartData: {
          ...chartFixture,
          calculationVersion: 'changed',
        },
      }),
    ];
    expect(new Set(values).size).toBe(values.length);
    expect(buildPersonalForecastChartFingerprint(chartFixture)).toBe(
      buildPersonalForecastChartFingerprint(chartFixture),
    );
    expect(values[0]).toMatch(/^personal-forecast-v2:/);
  });

  it('shows all cards to Free but exposes only overview and one fixed reading', () => {
    const full = personalForecastFixture();
    const sliced = slicePersonalForecastForAccess(full, false);
    expect(PERSONAL_FORECAST_FREE_READING_TOPIC).toBe('love');
    expect(sliced.forecast.overview.reading).toBeTruthy();
    expect(sliced.forecast.love.reading).toBeTruthy();
    expect(sliced.forecast.work.card).toBe(full.work.card);
    expect(sliced.forecast.work.reading).toBe('');
    expect(sliced.forecast.dynamic).toHaveLength(2);
    expect(sliced.forecast.dynamic[0].text.card).toBeTruthy();
    expect(sliced.forecast.dynamic[0].text.reading).toBe('');
  });
});
