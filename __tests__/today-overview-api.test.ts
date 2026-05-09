import type { NatalChartData } from '../types';

const chart = {
  sun: { planet: 'Sun', sign: 'Pisces', degree: 15, longitude: 345, description: '' },
  moon: { planet: 'Moon', sign: 'Cancer', degree: 10, longitude: 100, description: '' },
  rising: { planet: 'Ascendant', sign: 'Libra', degree: 7, longitude: 187, description: '' },
  mercury: { planet: 'Mercury', sign: 'Aquarius', degree: 20, longitude: 320, description: '' },
  venus: { planet: 'Venus', sign: 'Aries', degree: 8, longitude: 8, description: '' },
  mars: { planet: 'Mars', sign: 'Capricorn', degree: 11, longitude: 281, description: '' },
  jupiter: null,
  saturn: null,
  element: 'Water',
  rulingPlanet: 'Neptune',
  summary: '',
} satisfies NatalChartData;

describe('today overview API', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('returns 202 while another request is generating the same overview', async () => {
    jest.doMock('../lib/db', () => ({
      db: {
        users: {
          get: jest.fn().mockResolvedValue({
            id: '123',
            name: 'User',
            birth_date: '1990-01-01',
            birth_time: '12:00',
            birth_place: 'Moscow',
            language: 'ru',
          }),
        },
        natal_charts: {
          getPrimary: jest.fn().mockResolvedValue({
            id: 7,
            chart_data: chart,
          }),
          getById: jest.fn(),
        },
        horoscope_reactions: {
          getSummary: jest.fn().mockResolvedValue(null),
        },
      },
    }));
    jest.doMock('../lib/contentArchitecture', () => ({
      getContentLayer: jest.fn().mockResolvedValue({
        interpretation: null,
        chartId: 7,
        cacheKey: '2026-05-09',
        source: 'miss',
      }),
    }));
    jest.doMock('../lib/horoscope/signDaily', () => ({
      getCachedSignDailyHoroscope: jest.fn().mockResolvedValue(null),
      getOrGenerateSignDailyHoroscope: jest.fn(),
      normalizeZodiacKey: jest.fn().mockReturnValue('Pisces'),
    }));
    jest.doMock('../lib/serverLocks', () => ({
      LockKeys: {
        todayOverview: jest.fn().mockReturnValue('today-overview:123:7:2026-05-09'),
      },
      tryAcquireLock: jest.fn().mockReturnValue(false),
      releaseLock: jest.fn(),
    }));

    const { default: handler } = await import('../pages/api/content/today/overview');
    const res: any = {
      setHeader: jest.fn(),
      status: jest.fn(),
      json: jest.fn(),
    };
    res.status.mockReturnValue(res);

    await handler(
      {
        method: 'POST',
        query: {},
        body: {
          userId: '123',
          date: '2026-05-09',
          profile: { language: 'ru' },
          chartData: chart,
        },
      } as any,
      res
    );

    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({
      status: 'generating',
      code: 'GENERATION_IN_PROGRESS',
      retryAfterMs: 2500,
      chartId: 7,
    });
  });
});
