export {};

const fallbackReading = {
  date: '2026-06-03',
  slot: 'day',
  headline: 'Fallback headline',
  summary: 'Fallback summary text.',
  focus: 'Fallback focus.',
  relationships: 'Fallback relationships.',
  money: 'Fallback money.',
  guidance: 'Fallback guidance.',
};

const generatedReading = {
  ...fallbackReading,
  headline: 'Generated headline',
  summary: 'Generated summary text.',
};

const chartData = {
  sun: { sign: 'Pisces', degree: 15 },
  moon: { sign: 'Cancer', degree: 10 },
  rising: { sign: 'Libra', degree: 7 },
};

const cachedInterpretation = {
  id: 20,
  userId: '123',
  chartId: 7,
  accessTier: 'premium',
  contentSurface: 'forecast',
  contentVariant: 'day',
  modelTier: 'premium',
  cacheKey: 'full-day:2026-06-03:day',
  inputHash: 'full-day:2026-06-03:day',
  content: generatedReading,
  promptVersion: null,
  calculationVersion: null,
  validFrom: '2026-06-03T00:00:00.000Z',
  validTo: '2026-06-03T23:59:59.999Z',
  isPersistent: false,
  canRegenerateForLumi: false,
  regenerationCostLumi: null,
  legacySource: 'forecast_v2.day.premium',
  createdAt: '2026-06-03T00:00:00.000Z',
  updatedAt: '2026-06-03T00:00:00.000Z',
};

function savedInterpretation(content: typeof fallbackReading | typeof generatedReading, id = 21) {
  return {
    ...cachedInterpretation,
    id,
    content,
  };
}

function contentLayer(interpretation: any = null) {
  return {
    interpretation,
    source: interpretation ? 'content_v1' : 'miss',
    chartId: 7,
    cacheKey: 'full-day:2026-06-03:day',
  };
}

function createResponse() {
  const res: any = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

function setupMocks(options?: {
  getContentLayer?: jest.Mock;
  upsertByChart?: jest.Mock;
  generatePremiumDaypartForecast?: jest.Mock;
}) {
  const getContentLayer = options?.getContentLayer || jest.fn().mockResolvedValue(contentLayer(null));
  const upsertByChart = options?.upsertByChart || jest.fn(async (_chartId, payload) => (
    savedInterpretation(payload.content, payload.content === generatedReading ? 22 : 21)
  ));
  const generatePremiumDaypartForecast = options?.generatePremiumDaypartForecast || jest.fn().mockResolvedValue(generatedReading);

  jest.doMock('../lib/db', () => ({
    db: {
      users: {
        get: jest.fn().mockResolvedValue({
          id: '123',
          name: 'Test',
          birth_date: '1990-01-01',
          birth_time: '12:00',
          birth_place: 'Moscow',
          language: 'ru',
          is_premium: true,
        }),
      },
      natal_charts: {
        getById: jest.fn().mockResolvedValue({ id: 7, chart_data: chartData }),
        getPrimary: jest.fn().mockResolvedValue({ id: 7, chart_data: chartData }),
      },
      content_interpretations: {
        upsertByChart,
        upsertByUser: jest.fn(async (_userId, payload) => savedInterpretation(payload.content)),
      },
    },
  }));

  jest.doMock('../lib/contentArchitecture', () => ({
    getContentLayer,
    getPremiumEntitlementState: jest.fn().mockResolvedValue({ isPremium: true, entitlement: null }),
  }));

  jest.doMock('../lib/forecastContent', () => ({
    buildPremiumDaypartFallback: jest.fn().mockReturnValue(fallbackReading),
    generatePremiumDaypartForecast,
  }));

  jest.doMock('../lib/serverLocks', () => ({
    tryAcquireLock: jest.fn().mockReturnValue(true),
    releaseLock: jest.fn(),
  }));

  jest.doMock('../lib/logger', () => ({
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
    },
  }));

  return { getContentLayer, upsertByChart, generatePremiumDaypartForecast };
}

async function callHandler(method: 'GET' | 'POST' = 'POST') {
  const { default: handler } = await import('../pages/api/content/forecast/daypart');
  const res = createResponse();
  await handler(
    {
      method,
      query: method === 'GET'
        ? { userId: '123', chartId: '7', slot: 'day', date: '2026-06-03' }
        : {},
      body: method === 'POST'
        ? {
            userId: '123',
            chartId: 7,
            slot: 'day',
            date: '2026-06-03',
            profile: { id: '123', isPremium: true, language: 'ru' },
            chartData,
          }
        : {},
    } as any,
    res
  );
  return res;
}

describe('forecast daypart API fallback-first flow', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('returns cached valid personal forecast without generation', async () => {
    const mocks = setupMocks({
      getContentLayer: jest.fn().mockResolvedValue(contentLayer(cachedInterpretation)),
    });

    const res = await callHandler('POST');

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].source).toBe('content_v1');
    expect(res.json.mock.calls[0][0].persistenceStatus).toBe('saved');
    expect(mocks.upsertByChart).not.toHaveBeenCalled();
    expect(mocks.generatePremiumDaypartForecast).not.toHaveBeenCalled();
  });

  it('saves fallback before generated personal forecast', async () => {
    const mocks = setupMocks({
      getContentLayer: jest.fn().mockResolvedValue(contentLayer(null)),
    });

    const res = await callHandler('POST');

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].source).toBe('generated');
    expect(mocks.upsertByChart).toHaveBeenCalledTimes(2);
    expect(mocks.upsertByChart.mock.calls[0][1].content).toBe(fallbackReading);
    expect(mocks.upsertByChart.mock.calls[1][1].content).toBe(generatedReading);
    expect(mocks.upsertByChart.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.generatePremiumDaypartForecast.mock.invocationCallOrder[0]
    );
  });

  it('returns saved fallback when OpenAI generation fails', async () => {
    const savedFallback = savedInterpretation(fallbackReading);
    const mocks = setupMocks({
      getContentLayer: jest.fn().mockResolvedValue(contentLayer(null)),
      upsertByChart: jest.fn().mockResolvedValue(savedFallback),
      generatePremiumDaypartForecast: jest.fn().mockRejectedValue(new Error('OPENAI_DOWN')),
    });

    const res = await callHandler('POST');

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].source).toBe('fallback');
    expect(res.json.mock.calls[0][0].interpretation.content.summary).toBe(fallbackReading.summary);
    expect(mocks.generatePremiumDaypartForecast).toHaveBeenCalledTimes(1);
  });

  it('does not call OpenAI when fallback persistence fails', async () => {
    const mocks = setupMocks({
      getContentLayer: jest.fn().mockResolvedValue(contentLayer(null)),
      upsertByChart: jest.fn().mockRejectedValue(new Error('DB_WRITE_FAILED')),
    });

    const res = await callHandler('POST');

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].source).toBe('fallback_unsaved');
    expect(res.json.mock.calls[0][0].persistenceStatus).toBe('failed');
    expect(res.json.mock.calls[0][0].interpretation.content.summary).toBe(fallbackReading.summary);
    expect(mocks.generatePremiumDaypartForecast).not.toHaveBeenCalled();
  });
});
