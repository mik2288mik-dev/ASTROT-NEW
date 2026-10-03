jest.mock('../services/apiClient', () => ({ apiFetch: jest.fn(), getApiBaseUrl: () => 'https://api.tvoi-goroskop.ru' }));
jest.mock('../services/sessionService', () => ({ getTelegramInitDataHeaders: () => ({}) }));

import { apiFetch } from '../services/apiClient';
import { getCachedDailySignHoroscope, getCachedWeeklySignHoroscope, getCachedMonthlySignHoroscope } from '../services/astrologyService';

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
