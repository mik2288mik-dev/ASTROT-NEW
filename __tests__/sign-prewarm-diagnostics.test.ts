jest.mock('../lib/horoscope/signCache', () => ({ getCachedSignHoroscopes: jest.fn().mockResolvedValue({}) }));
jest.mock('../lib/horoscope/signOrchestrator', () => ({ fillMissingSignHoroscopes: jest.fn() }));
jest.mock('../lib/contentGenerationLock', () => ({
  buildContentGenerationLockKey: jest.fn(() => 'test-sign-lock'),
  withContentGenerationLock: jest.fn(async ({ generate }) => ({ status: 'ready', value: await generate() })),
}));
jest.mock('../lib/forecastDeliveryMetrics', () => ({ logForecastDeliveryMetric: jest.fn() }));
jest.mock('../lib/errorLogger', () => ({ recordTechnicalError: jest.fn().mockResolvedValue(undefined) }));

import { recordTechnicalError } from '../lib/errorLogger';
import { fillMissingSignHoroscopes } from '../lib/horoscope/signOrchestrator';
import { prewarmSignHoroscopeTarget, prewarmSignMonth } from '../lib/horoscope/signPrewarm';

it('records only safe failure categories without leaking model or database messages', async () => {
  const secret = 'private provider output or database detail';
  (fillMissingSignHoroscopes as jest.Mock).mockResolvedValue({
    failures: [{ sign: 'Aries', kind: 'storage_error', issues: [secret] }],
    generatedSigns: [],
  });
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    const target = { period: 'day' as const, periodKey: '2026-09-01' };
    await expect(prewarmSignHoroscopeTarget(target, 'ru')).rejects.toThrow(
      'SIGN_HOROSCOPE_PREWARM_PARTIAL_FAILURE:Aries=storage_error',
    );
    await prewarmSignMonth({
      targetMonthKey: '2026-09',
      wait: async () => {},
      prewarmTarget: async (item, language) => item.periodKey === '2026-09-01'
        ? prewarmSignHoroscopeTarget(item, language)
        : 'cached',
    });
    const calls = (recordTechnicalError as jest.Mock).mock.calls.flat();
    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: expect.stringContaining('Aries=storage_error') }),
    ]));
    expect(JSON.stringify(calls)).not.toContain(secret);
    expect(JSON.stringify(warning.mock.calls)).not.toContain(secret);
  } finally {
    warning.mockRestore();
  }
});
