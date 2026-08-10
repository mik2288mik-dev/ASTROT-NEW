import type { SignHoroscopeReadingV2 } from '../types';

describe('sign daily horoscope cache', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('../lib/db');
  });

  it('returns a validated shared cache hit without calculating or generating', async () => {
    const reading: SignHoroscopeReadingV2 = {
      schemaVersion: 'sign-horoscope-reading-v3',
      sign: 'Aries',
      period: 'day',
      periodKey: '2026-08-09',
      headline: 'Choose the clean answer',
      mood: { text: 'The day is direct.', evidenceIds: ['sky:one'] },
      relationships: { text: 'Ask plainly.', evidenceIds: ['sky:one'] },
      work: { text: 'Close one decision.', evidenceIds: ['sky:one'] },
      innerState: { text: 'Noise drops after clarity.', evidenceIds: ['sky:one'] },
      advice: { text: 'Send the concrete message.', evidenceIds: ['sky:one'] },
      warning: null,
      astrology: { text: 'Mars is the calculated factor.', evidenceIds: ['sky:one'] },
    };
    const get = jest.fn().mockResolvedValue(JSON.stringify(reading));
    const set = jest.fn();
    jest.doMock('../lib/db', () => ({
      db: { daily_horoscopes: { get, set } },
      getPool: jest.fn(),
    }));

    const { getOrGenerateSignDailyHoroscope } = await import('../lib/horoscope/signDaily');
    await expect(getOrGenerateSignDailyHoroscope('Aries', '2026-08-09', 'en')).resolves.toEqual(reading);
    expect(get).toHaveBeenCalledTimes(1);
    expect(set).not.toHaveBeenCalled();
  });
});
