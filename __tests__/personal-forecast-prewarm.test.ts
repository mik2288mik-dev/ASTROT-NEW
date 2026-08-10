jest.mock('../services/personalForecastService', () => ({
  loadPersonalForecast: jest.fn(),
}));

import { loadPersonalForecast } from '../services/personalForecastService';
import {
  prewarmUserContent,
  resetPrewarmSessionForTests,
} from '../services/contentPrewarmService';
import { buildPersonalForecastPrewarmTargets } from '../lib/personalForecastPrewarm';
import { chartFixture, personalForecastFixture } from './personal-forecast-fixture';

const mockedLoad = loadPersonalForecast as jest.Mock;
const input = {
  userId: '42',
  chartId: 7,
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
  chartData: chartFixture,
  isPremium: true,
};

describe('personal forecast prewarm', () => {
  beforeEach(() => {
    resetPrewarmSessionForTests();
    mockedLoad.mockReset();
  });

  it('startup cache-only checks only the first-screen day package', async () => {
    mockedLoad.mockResolvedValue({
      forecast: personalForecastFixture(),
      accessTier: 'premium',
      lockedTopicKeys: [],
      source: 'cache',
    });
    const result = await prewarmUserContent({ ...input, mode: 'cache-only' });
    expect(result.planSize).toBe(1);
    expect(mockedLoad).toHaveBeenCalledTimes(1);
    expect(mockedLoad.mock.calls[0][0]).toMatchObject({
      period: 'day',
      options: { cacheOnly: true, force: true },
    });
  });

  it('deduplicates two parallel generate-missing startup calls', async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    mockedLoad
      .mockRejectedValueOnce(Object.assign(new Error('missing'), { status: 404 }))
      .mockImplementationOnce(async () => {
        await gate;
        return {
          forecast: personalForecastFixture(),
          accessTier: 'premium',
          lockedTopicKeys: [],
          source: 'generated',
        };
      });
    const first = prewarmUserContent({ ...input, mode: 'generate-missing' });
    const second = prewarmUserContent({ ...input, mode: 'generate-missing' });
    await Promise.resolve();
    release();
    await Promise.all([first, second]);
    expect(mockedLoad).toHaveBeenCalledTimes(2);
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
