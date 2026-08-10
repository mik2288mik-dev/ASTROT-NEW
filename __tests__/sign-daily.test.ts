import type { SignHoroscopeReadingV2 } from '../types';

describe('sign daily horoscope cache', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('../lib/db');
  });

  it('returns a validated shared cache hit without calculating or generating', async () => {
    const reading: SignHoroscopeReadingV2 = {
      schemaVersion: 'sign-horoscope-reading-v4',
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

    const { getOrGenerateSignDailyHoroscope } = await import('../lib/horoscope/signDaily');
    await expect(getOrGenerateSignDailyHoroscope('Aries', '2026-08-09', 'en')).resolves.toEqual(reading);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
