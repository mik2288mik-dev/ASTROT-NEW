import { sanitizePersonalDailyPostBody } from '../lib/personalDailyRequestGuard';

describe('personal daily request guard', () => {
  it('removes redundant profile and chartData from the generation body', () => {
    const sanitized = sanitizePersonalDailyPostBody(JSON.stringify({
      userId: '123',
      chartId: 7,
      sectionKey: 'daily_overview',
      date: '2026-07-23',
      profile: { name: 'Mik' },
      chartData: { oversized: 'x'.repeat(50_000) },
    }));

    expect(JSON.parse(String(sanitized))).toEqual({
      userId: '123',
      chartId: 7,
      sectionKey: 'daily_overview',
      date: '2026-07-23',
    });
  });

  it('preserves the fields required by the authenticated generation endpoint', () => {
    const sanitized = sanitizePersonalDailyPostBody(JSON.stringify({
      userId: '123',
      chartId: 7,
      sectionKey: 'daily_love',
      date: '2026-07-23',
      accessTier: 'premium',
      profile: { name: 'Mik' },
      chartData: { sun: 'Cancer' },
    }));

    expect(JSON.parse(String(sanitized))).toEqual({
      userId: '123',
      chartId: 7,
      sectionKey: 'daily_love',
      date: '2026-07-23',
      accessTier: 'premium',
    });
  });

  it('keeps invalid and non-string bodies untouched', () => {
    expect(sanitizePersonalDailyPostBody('not-json')).toBe('not-json');
    expect(sanitizePersonalDailyPostBody(null)).toBeNull();
  });
});
