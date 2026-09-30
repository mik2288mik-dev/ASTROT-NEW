import type { SignHoroscopeReadingV2 } from '../types';

describe('sign daily horoscope cache', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('../lib/db');
    jest.dontMock('../services/apiClient');
    jest.dontMock('../services/sessionService');
  });

  it.each([
    ['ensureDailySignHoroscope', '2026-09-30', 'SIGN_HOROSCOPE_NOT_READY'],
    ['ensureWeeklySignHoroscope', '2026-W40', 'SIGN_WEEKLY_NOT_READY'],
    ['ensureMonthlySignHoroscope', '2026-09', 'SIGN_MONTHLY_NOT_READY'],
  ])('%s makes one cache read on a miss without POST or polling', async (method, periodKey, code) => {
    const apiFetch = jest.fn().mockResolvedValue({ status: 404 });
    jest.doMock('../services/apiClient', () => ({ apiFetch, getApiBaseUrl: () => '' }));
    jest.doMock('../services/sessionService', () => ({ getTelegramInitDataHeaders: () => ({}) }));
    const service = await import('../services/astrologyService');
    const load = service[method as 'ensureDailySignHoroscope' | 'ensureWeeklySignHoroscope' | 'ensureMonthlySignHoroscope'];
    await expect(load('Aries', periodKey, 'ru')).rejects.toMatchObject({ status: 404, code });
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(apiFetch.mock.calls[0][1].method).toBe('GET');
  });

  it('deduplicates concurrent sign reads and keeps the same ready text in memory', async () => {
    const reading: SignHoroscopeReadingV2 = {
      schemaVersion: 'sign-horoscope-reading-v5', sign: 'Aries', period: 'day', periodKey: '2026-09-30',
      headline: 'Choose the useful answer', text: 'Ask plainly and agree on the meeting time.',
    };
    const apiFetch = jest.fn().mockResolvedValue({ status: 200, ok: true, json: async () => ({ reading }) });
    jest.doMock('../services/apiClient', () => ({ apiFetch, getApiBaseUrl: () => '' }));
    jest.doMock('../services/sessionService', () => ({ getTelegramInitDataHeaders: () => ({}) }));
    const { ensureDailySignHoroscope } = await import('../services/astrologyService');
    const first = await Promise.all([
      ensureDailySignHoroscope('Aries', reading.periodKey, 'ru'),
      ensureDailySignHoroscope('Aries', reading.periodKey, 'ru'),
    ]);
    expect(first).toEqual([reading, reading]);
    expect(await ensureDailySignHoroscope('Aries', reading.periodKey, 'ru')).toEqual(reading);
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it('returns a validated shared cache hit without calculating or generating', async () => {
    const reading: SignHoroscopeReadingV2 = {
      schemaVersion: 'sign-horoscope-reading-v5',
      sign: 'Aries',
      period: 'day',
      periodKey: '2026-08-09',
      headline: 'Choose the clean answer',
      text: 'The day is direct. Ask plainly and close one useful decision.',
    };
    const query = jest.fn().mockResolvedValue({ rows: [{ payload: reading }] });
    jest.doMock('../lib/db', () => ({
      db: { daily_horoscopes: { get: jest.fn(), set: jest.fn() } },
      getPool: () => ({ query }),
    }));

    const { getCachedSignDailyHoroscope } = await import('../lib/horoscope/signDaily');
    await expect(getCachedSignDailyHoroscope('Aries', '2026-08-09', 'en')).resolves.toEqual(reading);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
