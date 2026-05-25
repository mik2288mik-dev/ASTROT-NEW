import type { NatalChartData } from '../types';

const chart: NatalChartData = {
  sun: { planet: 'Sun', sign: 'Pisces', degree: 12, longitude: 342, house: 1, description: '' },
  moon: { planet: 'Moon', sign: 'Cancer', degree: 8, longitude: 98, house: 5, description: '' },
  rising: { planet: 'Ascendant', sign: 'Virgo', degree: 2, longitude: 152, house: 1, description: '' },
  mercury: { planet: 'Mercury', sign: 'Aquarius', degree: 20, longitude: 320, description: '' },
  venus: { planet: 'Venus', sign: 'Aries', degree: 8, longitude: 8, description: '' },
  mars: { planet: 'Mars', sign: 'Capricorn', degree: 11, longitude: 281, description: '' },
  jupiter: null,
  saturn: null,
  element: 'Water',
  rulingPlanet: 'Neptune',
  houses: [],
  aspects: [],
  summary: '',
};

function createResponse() {
  const res: any = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

function mockCommonDb() {
  jest.doMock('../lib/db', () => ({
    db: {
      users: {
        get: jest.fn().mockResolvedValue({
          id: '123',
          name: 'Лина',
          birth_date: '2000-01-01',
          birth_time: '12:00',
          birth_place: 'Москва',
          language: 'ru',
          lumi_balance: 50,
          is_premium: false,
        }),
      },
      natal_charts: {
        getPrimary: jest.fn().mockResolvedValue({ id: 7, chart_data: chart }),
        getById: jest.fn().mockResolvedValue({ id: 7, chart_data: chart }),
      },
      content_unlocks: {
        getLatestActive: jest.fn().mockResolvedValue(null),
      },
      lumi_transactions: {
        getBalance: jest.fn().mockResolvedValue(50),
      },
      content_interpretations: {
        upsertByChart: jest.fn(),
        upsertByUser: jest.fn(),
      },
    },
  }));
}

function mockContentLayer(interpretation: any) {
  jest.doMock('../lib/contentArchitecture', () => ({
    getPremiumEntitlementState: jest.fn().mockResolvedValue({
      isPremium: false,
      entitlement: null,
    }),
    getContentLayer: jest.fn().mockResolvedValue({
      interpretation,
      chartId: 7,
      cacheKey: interpretation?.cacheKey || 'human_v2.daily.2026-05-25.daily_overview',
      source: interpretation ? 'hit' : 'miss',
    }),
    unlockContentLayer: jest.fn(),
  }));
}

function mockHumanGeneration() {
  jest.doMock('../lib/natalHumanInterpretation', () => ({
    buildHumanInputHash: jest.fn().mockReturnValue('hash'),
    buildHumanDailyFallback: jest.fn().mockReturnValue({
      key: 'daily_overview',
      title: 'Карта сегодня',
      access: 'free',
      content: 'Fallback',
    }),
    generateHumanDailySection: jest.fn().mockResolvedValue({
      key: 'daily_overview',
      title: 'Карта сегодня',
      access: 'free',
      content: 'Generated',
    }),
  }));
}

async function callHumanDaily(sectionKey: string) {
  const { default: handler } = await import('../pages/api/content/natal/human-daily');
  const res = createResponse();
  await handler(
    {
      method: 'GET',
      query: { userId: '123', chartId: '7', sectionKey, date: '2026-05-25' },
      body: {},
    } as any,
    res
  );
  return res;
}

describe('human daily API', () => {
  beforeEach(() => {
    jest.resetModules();
    mockCommonDb();
    mockHumanGeneration();
  });

  it('returns daily_overview as a free preview when cached', async () => {
    mockContentLayer({
      id: 1,
      userId: '123',
      chartId: 7,
      accessTier: 'free',
      contentSurface: 'natal',
      contentVariant: 'living',
      modelTier: 'base',
      cacheKey: 'human_v2.daily.2026-05-25.daily_overview',
      inputHash: 'hash',
      content: {
        key: 'daily_overview',
        title: 'Карта сегодня',
        access: 'free',
        content: 'Сегодня лучше выбрать одно понятное дело.',
      },
      promptVersion: 'lumia-human-v2.daily',
      isPersistent: false,
      canRegenerateForLumi: false,
      createdAt: '2026-05-25T00:00:00.000Z',
      updatedAt: '2026-05-25T00:00:00.000Z',
    });

    const res = await callHumanDaily('daily_overview');

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0]).toMatchObject({
      accessTier: 'free_preview',
      isPreview: true,
    });
  });

  it('keeps other daily sections locked for free users', async () => {
    mockContentLayer(null);

    const res = await callHumanDaily('daily_work_business');

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0]).toMatchObject({
      code: 'HUMAN_DAILY_LOCKED',
      lumiCost: 35,
    });
  });
});
