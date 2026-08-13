import { canAccessFeature, hasNatalChart } from '../lib/accessMatrix';
import { buildContentCacheKey, getCacheTtlMs, getContentAccess, getContentPolicy, listContentMatrix } from '../lib/contentMatrix';

describe('Lumia content matrix', () => {
  it('defines generation policy for every required content type', () => {
    expect(listContentMatrix().map((item) => item.type)).toEqual([
      'push_daily', 'day_card', 'sign_daily_horoscope', 'sign_weekly_horoscope', 'sign_monthly_horoscope', 'sign_compatibility',
      'blind_spot', 'personal_daily', 'natal_section', 'deep_report',
    ]);
    expect(getContentPolicy('sign_daily_horoscope')).toMatchObject({
      modelTier: 'fast', words: { min: 0, max: 130 }, cacheTtl: '24h', cacheScope: 'shared',
    });
    expect(getContentPolicy('sign_compatibility')).toMatchObject({
      featureKey: 'zodiac_compatibility', modelTier: 'fast', words: { min: 120, max: 180 },
      cacheTtl: 'forever', cacheScope: 'shared', generationPolicy: 'explicit_only',
    });
    expect(getContentPolicy('sign_weekly_horoscope')).toMatchObject({
      featureKey: 'weekly_sign_horoscope',
      words: { min: 0, max: 130 },
      promptVersion: expect.stringContaining('sign_weekly_horoscope.v6'),
    });
    expect(getContentPolicy('sign_monthly_horoscope')).toMatchObject({
      featureKey: 'weekly_sign_horoscope',
      words: { min: 0, max: 130 },
      promptVersion: expect.stringContaining('sign_monthly_horoscope.v4'),
    });
    expect(getCacheTtlMs('sign_compatibility')).toBeNull();
    expect(getContentPolicy('deep_report')).toMatchObject({
      modelTier: 'deep', generationPolicy: 'explicit_only', cacheTtl: 'forever_until_chart_changes',
    });
  });

  it('delegates access decisions to accessMatrix', () => {
    expect(getContentAccess('sign_daily_horoscope')).toMatchObject({ tier: 'free', needsChart: false });
    expect(getContentAccess('sign_weekly_horoscope')).toMatchObject({ tier: 'premium', needsChart: false });
    expect(getContentAccess('sign_monthly_horoscope')).toMatchObject({ tier: 'premium', needsChart: false });
    expect(getContentAccess('natal_section', { natalSection: 'basic_identity' })).toMatchObject({ tier: 'free', needsChart: true });
    expect(getContentAccess('natal_section', { natalSection: 'money' })).toMatchObject({ tier: 'premium', needsChart: true });
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
    expect(canAccessFeature('weekly_sign_horoscope', null, null)).toMatchObject({
      allowed: false,
      status: 'needs_premium',
      hasChart: false,
    });
    expect(canAccessFeature('weekly_sign_horoscope', {
      premiumEntitlement: {
        state: 'paid',
        isPremium: true,
        source: 'rustore_pay',
        startsAt: '2026-08-01T00:00:00.000Z',
        endsAt: '2099-09-01T00:00:00.000Z',
        autoRenew: true,
        productId: 'premium.3m',
        period: 'P3M',
      },
    }, null))
      .toMatchObject({
        allowed: true,
        status: 'allowed',
        hasChart: false,
      });
    expect(canAccessFeature('zodiac_compatibility', null, null).allowed).toBe(true);
    expect(canAccessFeature('personal_daily', { isPremium: true }, { primaryChartId: null })).toMatchObject({ status: 'needs_chart' });
  });
});
