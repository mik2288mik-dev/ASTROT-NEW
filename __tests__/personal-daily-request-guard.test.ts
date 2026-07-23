import {
  installPersonalDailyRequestGuard,
  sanitizePersonalDailyPostBody,
} from '../lib/personalDailyRequestGuard';

describe('personal daily request guard', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    delete (globalThis as Record<string, unknown>).__yourHoroscopePersonalDailyRequestGuardInstalled__;
    jest.restoreAllMocks();
  });

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

  it('does not modify unrelated request bodies', () => {
    const body = JSON.stringify({ profile: { name: 'Mik' }, chartData: { sun: 'Cancer' } });
    expect(sanitizePersonalDailyPostBody(body)).toBe('{}');
  });

  it('keeps invalid and non-string bodies untouched', () => {
    expect(sanitizePersonalDailyPostBody('not-json')).toBe('not-json');
    expect(sanitizePersonalDailyPostBody(null)).toBeNull();
  });

  it('sanitizes only POST requests to the personal daily endpoint', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    installPersonalDailyRequestGuard();

    await global.fetch('/api/content/natal/human-daily?userId=123', {
      method: 'POST',
      body: JSON.stringify({
        userId: '123',
        chartId: 7,
        sectionKey: 'daily_overview',
        date: '2026-07-23',
        profile: { name: 'Mik' },
        chartData: { oversized: 'x'.repeat(50_000) },
      }),
    });

    const sentBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(sentBody).toEqual({
      userId: '123',
      chartId: 7,
      sectionKey: 'daily_overview',
      date: '2026-07-23',
    });
  });
});
