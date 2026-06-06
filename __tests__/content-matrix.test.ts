import { canAccessFeature, hasNatalChart } from '../lib/accessMatrix';
import { buildContentCacheKey, getCacheTtlMs, getContentAccess, getContentPolicy, listContentMatrix } from '../lib/contentMatrix';

describe('Lumia content matrix', () => {
  it('defines generation policy for every required content type', () => {
    expect(listContentMatrix().map((item) => item.type)).toEqual([
      'push_daily', 'action_timing', 'day_card', 'sign_daily_horoscope', 'sign_weekly_horoscope', 'sign_compatibility',
      'blind_spot', 'personal_daily', 'natal_section', 'deep_report',
    ]);
    expect(getContentPolicy('sign_daily_horoscope')).toMatchObject({
      modelTier: 'fast', words: { min: 60, max: 80 }, cacheTtl: '24h', cacheScope: 'shared', batchSize: 12,
    });
    expect(getContentPolicy('sign_compatibility')).toMatchObject({
      featureKey: 'zodiac_compatibility', modelTier: 'fast', words: { min: 120, max: 180 },
      cacheTtl: 'forever', cacheScope: 'shared', generationPolicy: 'explicit_only',
    });
    expect(getCacheTtlMs('sign_compatibility')).toBeNull();
    expect(getContentPolicy('deep_report')).toMatchObject({
      modelTier: 'deep', generationPolicy: 'explicit_only', cacheTtl: 'forever_until_chart_changes',
    });
  });

  it('delegates access decisions to accessMatrix', () => {
    expect(getContentAccess('action_timing')).toMatchObject({ tier: 'free', needsChart: false });
    expect(getContentAccess('action_timing', { personal: true })).toMatchObject({ tier: 'pro', needsChart: true });
    expect(getContentAccess('natal_section', { natalSection: 'basic_identity' })).toMatchObject({ tier: 'free', needsChart: true });
    expect(getContentAccess('natal_section', { natalSection: 'money' })).toMatchObject({ tier: 'pro', needsChart: true });
  });

  it('builds shared and personal cache keys without scope collisions', () => {
    expect(buildContentCacheKey('sign_daily_horoscope', { dateKey: '2026-06-06', zodiacSign: 'Aries' }))
      .toBe('sign_daily_horoscope|date:2026-06-06|sign:aries');
    expect(buildContentCacheKey('personal_daily', { dateKey: '2026-06-06', userId: '42', chartId: 7 }))
      .toBe('personal_daily|date:2026-06-06|user:42|chart:7');
    expect(buildContentCacheKey('natal_section', { contentKey: 'love', userId: '42', chartId: 7, chartHash: 'abc' }))
      .toBe('natal_section|love|user:42|chart:7|hash:abc');
  });

  it('requires a complete chart or persisted chart id as strict proof', () => {
    expect(hasNatalChart({ isSetup: true, birthDate: '2000-01-01', birthPlace: 'Moscow' })).toBe(false);
    expect(hasNatalChart({ hasChart: true })).toBe(false);
    expect(hasNatalChart({ primaryChartId: 7 })).toBe(true);
    expect(hasNatalChart({ chartData: { sun: {} as any, moon: {} as any, rising: {} as any } as any })).toBe(true);
  });

  it('keeps generic sign content chart-free and gates personal content', () => {
    expect(canAccessFeature('daily_sign_horoscope', null, null).allowed).toBe(true);
    expect(canAccessFeature('zodiac_compatibility', null, null).allowed).toBe(true);
    expect(canAccessFeature('personal_daily', { isPremium: true }, { primaryChartId: null })).toMatchObject({ status: 'needs_chart' });
  });
});
