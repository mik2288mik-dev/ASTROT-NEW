jest.mock('../services/apiClient', () => ({ apiFetch: jest.fn(), getApiBaseUrl: () => 'https://api.tvoi-goroskop.ru' }));
jest.mock('../services/sessionService', () => ({ getTelegramInitDataHeaders: () => ({}) }));

import { apiFetch } from '../services/apiClient';
import {
  ensureDailySignHoroscope, ensureWeeklySignHoroscope, ensureMonthlySignHoroscope,
  getCachedDailySignHoroscope, getCachedWeeklySignHoroscope, getCachedMonthlySignHoroscope,
  readLocalSignHoroscope,
} from '../services/astrologyService';

describe('sign horoscope Android client negotiation', () => {
  it.each([
    { load: getCachedDailySignHoroscope, period: 'day', key: '2026-10-03', endpoint: 'sign-daily' },
    { load: getCachedWeeklySignHoroscope, period: 'week', key: '2026-W40', endpoint: 'sign-weekly' },
    { load: getCachedMonthlySignHoroscope, period: 'month', key: '2026-10', endpoint: 'sign-monthly' },
  ])('requests the accepted v5 format for $period and consumes the returned reading', async ({ load, period, key, endpoint }) => {
    const reading = { schemaVersion: 'sign-horoscope-reading-v5', sign: 'Aries', period, periodKey: key,
      headline: 'Свежий заголовок', text: 'Свежий текст текущего периода.' };
    (apiFetch as jest.Mock).mockReset().mockResolvedValue({ status: 200, ok: true,
      json: async () => ({ reading, source: 'cache' }) });
    expect(await load('Aries', key, 'ru')).toEqual(reading);
    const url = new URL((apiFetch as jest.Mock).mock.calls[0][0]);
    expect(url.pathname).toBe(`/api/content/horoscope/${endpoint}`);
    expect(url.searchParams.get('schemaVersion')).toBe('sign-horoscope-reading-v5');
  });
});

describe('sign horoscope date identity', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let entries: Map<string, string>;

  beforeEach(() => {
    entries = new Map();
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => entries.set(key, value),
      removeItem: (key: string) => entries.delete(key),
    } } });
    (apiFetch as jest.Mock).mockReset();
  });

  afterEach(() => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  });

  it.each([
    { ensure: ensureDailySignHoroscope, clientPeriod: 'today' as const, period: 'day', key: '2026-11-02', oldKey: '2026-09-30', error: 'SIGN_HOROSCOPE_NOT_READY' },
    { ensure: ensureWeeklySignHoroscope, clientPeriod: 'week' as const, period: 'week', key: '2026-W45', oldKey: '2026-W40', error: 'SIGN_WEEKLY_NOT_READY' },
    { ensure: ensureMonthlySignHoroscope, clientPeriod: 'month' as const, period: 'month', key: '2026-11', oldKey: '2026-09', error: 'SIGN_MONTHLY_NOT_READY' },
  ])('ignores old local and server $period readings, then uses the actual current reading', async ({ ensure, clientPeriod, period, key, oldKey, error }) => {
    const storageKey = `tvoi-goroskop:sign-horoscope-v4:${clientPeriod}:taurus:${key}:ru`;
    const reading = { schemaVersion: 'sign-horoscope-reading-v5', sign: 'Taurus', period, periodKey: key,
      headline: 'Новый прогноз', text: 'Текст для выбранного периода.' };
    const old = { ...reading, periodKey: oldKey, headline: 'Старый прогноз' };
    entries.set(storageKey, JSON.stringify(old));
    (apiFetch as jest.Mock)
      .mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({ reading: old, stale: true }) })
      .mockResolvedValueOnce({ status: 404, ok: false })
      .mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({ reading, stale: false }) });

    expect(readLocalSignHoroscope(clientPeriod, 'Taurus', key, 'ru')).toBeNull();
    await expect(ensure('Taurus', key, 'ru')).rejects.toMatchObject({ code: error });
    expect(JSON.parse(entries.get(storageKey)!)).toEqual(old);
    await expect(ensure('Taurus', key, 'ru')).rejects.toMatchObject({ code: error });
    await expect(ensure('Taurus', key, 'ru')).resolves.toEqual(reading);
    expect(JSON.parse(entries.get(storageKey)!)).toEqual(reading);
    expect(readLocalSignHoroscope(clientPeriod, 'Taurus', key, 'ru')).toEqual(reading);
    expect(apiFetch).toHaveBeenCalledTimes(3);
  });
});
