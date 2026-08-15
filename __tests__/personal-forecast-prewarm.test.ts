jest.mock('../services/personalForecastService', () => ({
  loadPersonalForecast: jest.fn(),
}));

import { loadPersonalForecast } from '../services/personalForecastService';
import {
  prewarmUserContent,
  resetPrewarmSessionForTests,
} from '../services/contentPrewarmService';
import { buildPersonalForecastPrewarmTargets } from '../lib/personalForecastPrewarm';

const mockedLoad = loadPersonalForecast as jest.Mock;
const input = {
  userId: '42',
  profile: {
    id: '42',
    name: 'Test',
    birthDate: '1990-01-01',
    birthTime: '12:00',
    birthPlace: 'Moscow',
    birthTimezone: 'Europe/Moscow',
    language: 'ru' as const,
    isPremium: true,
    isSetup: true,
    theme: 'light' as const,
  },
  isPremium: true,
};

describe('personal horoscope prewarm', () => {
  beforeEach(() => {
    resetPrewarmSessionForTests();
    mockedLoad.mockReset();
  });

  it('preloads day, week, and month before the reader needs a tab switch', async () => {
    mockedLoad.mockResolvedValue({
      horoscope: { period: 'day' },
      accessTier: 'premium',
      lockedAdviceIndexes: [],
      periodLocked: false,
      source: 'cache',
    });
    const result = await prewarmUserContent({ ...input, mode: 'cache-only' });
    expect(result.planSize).toBe(3);
    expect(mockedLoad).toHaveBeenCalledTimes(3);
    expect(mockedLoad.mock.calls.map(([request]) => request)).toEqual(expect.arrayContaining([
      expect.objectContaining({ period: 'day', options: { cacheOnly: true, force: true } }),
      expect.objectContaining({ period: 'week', options: { cacheOnly: true, force: true } }),
      expect.objectContaining({ period: 'month', options: { cacheOnly: true, force: true } }),
    ]));
  });

  it('preloads only Today for a Free user', async () => {
    mockedLoad.mockResolvedValue({
      horoscope: { period: 'day' },
      accessTier: 'free',
      lockedAdviceIndexes: [1, 2],
      periodLocked: false,
      source: 'cache',
    });
    const result = await prewarmUserContent({
      ...input,
      isPremium: false,
      mode: 'cache-only',
    });
    expect(result.planSize).toBe(1);
    expect(mockedLoad).toHaveBeenCalledTimes(1);
    expect(mockedLoad).toHaveBeenCalledWith(expect.objectContaining({
      period: 'day',
      options: { cacheOnly: true, force: true },
    }));
  });

  it('deduplicates two parallel generate-missing startup calls', async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    mockedLoad.mockImplementation(async (request) => {
      if (request.options?.cacheOnly) {
        throw Object.assign(new Error('missing'), { status: 404 });
      }
      await gate;
      return {
        horoscope: { period: request.period },
        accessTier: 'premium',
        lockedAdviceIndexes: [],
        periodLocked: false,
        source: 'generated',
      };
    });
    const first = prewarmUserContent({ ...input, mode: 'generate-missing' });
    const second = prewarmUserContent({ ...input, mode: 'generate-missing' });
    await Promise.resolve();
    release();
    await Promise.all([first, second]);
    expect(mockedLoad).toHaveBeenCalledTimes(6);
  });

  it('has no natal-chart dependency in its public input', async () => {
    await expect(prewarmUserContent({
      ...input,
      mode: 'cache-only',
    })).resolves.toBeDefined();
    expect(input).not.toHaveProperty('chartData');
    expect(input).not.toHaveProperty('chartId');
  });

  it('does not schedule server-side personal forecast generation', () => {
    const ordinary = buildPersonalForecastPrewarmTargets(
      new Date('2026-07-15T09:00:00.000Z'),
      'Europe/Moscow',
    );
    expect(ordinary).toEqual([]);
    const boundary = buildPersonalForecastPrewarmTargets(
      new Date('2026-12-30T19:30:00.000Z'),
      'Europe/Moscow',
    );
    expect(boundary).toEqual([]);
  });
});
