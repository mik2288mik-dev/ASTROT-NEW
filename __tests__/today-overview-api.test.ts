import type { ForecastDailyReading, NatalChartData } from '../types';

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

const forecast: ForecastDailyReading = {
  date: '2026-05-09',
  headline: 'Сегодня важен один честный ритм',
  summary: 'День становится понятнее, когда есть один главный фокус.',
  chance: 'Можно спокойно сдвинуть важное.',
  risk: 'Не отвечай слишком быстро.',
  focus: 'Выбери один приоритет.',
  reading: 'Личный прогноз дня.',
  context: 'Контекст карты.',
  advice: ['Дыши спокойнее', 'Не спеши', 'Сделай главное'],
};

function createResponse() {
  const res: any = {
    setHeader: jest.fn(),
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

function mockStableTransits() {
  jest.doMock('../lib/transits-calculator', () => ({
    getCurrentTransits: jest.fn(async (date: Date) => {
      const day = date.getUTCDate();
      return {
        date: date.toISOString().slice(0, 10),
        sun: { planet: 'Sun', sign: 'Taurus', degree: (day * 3) % 30 },
        moon: { planet: 'Moon', sign: 'Cancer', degree: (day * 7) % 30 },
        mercury: { planet: 'Mercury', sign: 'Gemini', degree: (day * 5) % 30 },
        venus: { planet: 'Venus', sign: 'Taurus', degree: (day * 4) % 30 },
        mars: { planet: 'Mars', sign: 'Leo', degree: (day * 6) % 30 },
        moonPhase: 'Растущая',
      };
    }),
  }));
}

function mockDb(options?: { writeFails?: boolean }) {
  const upsertByChart = jest.fn();
  if (options?.writeFails) upsertByChart.mockRejectedValue(new Error('write failed'));
  else upsertByChart.mockResolvedValue({ id: 1 });

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
      content_interpretations: {
        upsertByChart,
        upsertByUser: jest.fn().mockResolvedValue({ id: 1 }),
      },
    },
  }));
}

function mockContentMiss() {
  jest.doMock('../lib/contentArchitecture', () => ({
    getContentLayer: jest.fn().mockResolvedValue({
      interpretation: null,
      chartId: 7,
      cacheKey: '2026-05-09',
      source: 'miss',
    }),
  }));
}

function mockGeneration() {
  jest.doMock('../lib/forecastContent', () => ({
    generateFreeDailyForecast: jest.fn().mockResolvedValue(forecast),
  }));
  jest.doMock('../lib/appSettings', () => ({
    getOpenAIModelForContent: jest.fn().mockResolvedValue({ model: 'test-model', modelTier: 'base' }),
  }));
  jest.doMock('../lib/horoscope/signDaily', () => ({
    buildSignDailyFallback: jest.fn().mockReturnValue(forecast),
    getCachedSignDailyHoroscope: jest.fn().mockResolvedValue(null),
    getOrGenerateSignDailyHoroscope: jest.fn().mockResolvedValue(forecast),
    normalizeZodiacKey: jest.fn().mockReturnValue('Pisces'),
  }));
}

function mockLock(acquired: boolean) {
  jest.doMock('../lib/serverLocks', () => ({
    LockKeys: {
      todayOverview: jest.fn().mockReturnValue('today-overview:123:7:2026-05-09'),
    },
    tryAcquireLock: jest.fn().mockReturnValue(acquired),
    releaseLock: jest.fn(),
  }));
}

async function callHandler() {
  const { default: handler } = await import('../pages/api/content/today/overview');
  const res = createResponse();

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

  return res;
}

describe('today overview API', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('returns 202 while another request is generating the same overview', async () => {
    mockDb();
    mockContentMiss();
    mockGeneration();
    mockLock(false);

    const res = await callHandler();

    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({
      status: 'generating',
      code: 'GENERATION_IN_PROGRESS',
      retryAfterMs: 2500,
      chartId: 7,
    });
  });

  it('returns a ready overview when live generation falls back locally', async () => {
    mockStableTransits();
    mockDb();
    mockContentMiss();
    mockGeneration();
    mockLock(true);

    const res = await callHandler();

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.status).toBe('ready');
    expect(payload.overview.headline).toBe(forecast.headline);
    expect(payload.overview.bestAction).toBe(forecast.focus);
  });

  it('returns a ready overview even when persistence fails', async () => {
    mockStableTransits();
    mockDb({ writeFails: true });
    mockContentMiss();
    mockGeneration();
    mockLock(true);

    const res = await callHandler();

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.status).toBe('ready');
    expect(payload.overview.summary).toBe(forecast.summary);
  });
});
