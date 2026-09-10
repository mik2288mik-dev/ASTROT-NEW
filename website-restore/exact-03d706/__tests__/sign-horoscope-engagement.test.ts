import {
  buildHoroscopeEngagementKey,
  getHoroscopeEngagementDateKey,
} from '../lib/horoscope/signEngagement';

describe('sign horoscope engagement identity', () => {
  it('keeps likes and views separate for day, week, and month', () => {
    expect(buildHoroscopeEngagementKey('Pisces', 'today')).toBe('Pisces');
    expect(buildHoroscopeEngagementKey('Pisces', 'week')).toBe('Pisces#week');
    expect(buildHoroscopeEngagementKey('Pisces', 'month')).toBe('Pisces#month');
  });

  it('uses a stable database date for the whole forecast period', () => {
    expect(getHoroscopeEngagementDateKey('today', '2026-08-10')).toBe('2026-08-10');
    expect(getHoroscopeEngagementDateKey('week', '2026-W33')).toBe('2026-08-10');
    expect(getHoroscopeEngagementDateKey('month', '2026-08')).toBe('2026-08-01');
  });

  it('preserves compatibility and arcana engagement keys for the default daily context', () => {
    expect(buildHoroscopeEngagementKey('Pisces_Aries', 'today')).toBe('Aries_Pisces');
    expect(buildHoroscopeEngagementKey('arcana_12', 'today')).toBe('arcana_12');
  });
});
