import type { NatalChartData } from '../types';

const chart = {
  sun: { planet: 'Sun', sign: 'Pisces', degree: 15, longitude: 345, house: 6, description: '' },
  moon: { planet: 'Moon', sign: 'Cancer', degree: 10, longitude: 100, house: 4, description: '' },
  rising: { planet: 'Ascendant', sign: 'Libra', degree: 7, longitude: 187, house: 1, description: '' },
  mercury: { planet: 'Mercury', sign: 'Aquarius', degree: 20, longitude: 320, house: 10, description: '' },
  venus: { planet: 'Venus', sign: 'Aries', degree: 8, longitude: 8, house: 7, description: '' },
  mars: { planet: 'Mars', sign: 'Capricorn', degree: 11, longitude: 281, house: 1, description: '' },
  jupiter: { planet: 'Jupiter', sign: 'Taurus', degree: 4, longitude: 34, house: 2, description: '' },
  saturn: { planet: 'Saturn', sign: 'Scorpio', degree: 13, longitude: 223, house: 3, description: '' },
  element: 'Water',
  rulingPlanet: 'Neptune',
  latitude: 55.75,
  longitude: 37.62,
  timezone: 'Europe/Moscow',
  houses: Array.from({ length: 12 }, (_, index) => ({
    house: index + 1,
    sign: 'Aries',
    degree: 0,
    longitude: index * 30,
  })),
  aspects: [],
  calculationVersion: 'swisseph-canonical-v1',
  summary: '',
} satisfies NatalChartData;

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
      const hour = date.getUTCHours();
      return {
        date: date.toISOString().slice(0, 10),
        sun: { planet: 'Sun', sign: 'Taurus', degree: (20 + hour * 0.04) % 30 },
        moon: { planet: 'Moon', sign: hour < 12 ? 'Virgo' : 'Libra', degree: (hour * 0.55) % 30 },
        mercury: { planet: 'Mercury', sign: 'Gemini', degree: (8 + hour * 0.09) % 30 },
        venus: { planet: 'Venus', sign: 'Cancer', degree: (11 + hour * 0.05) % 30 },
        mars: { planet: 'Mars', sign: 'Leo', degree: (5 + hour * 0.03) % 30 },
        jupiter: { planet: 'Jupiter', sign: 'Taurus', degree: 15 },
        saturn: { planet: 'Saturn', sign: 'Pisces', degree: 19 },
        moonPhase: 'waxing',
        source: 'swisseph',
      };
    }),
  }));
}

function mockDb(options?: { noSetup?: boolean }) {
  jest.doMock('../lib/db', () => ({
    db: {
      users: {
        get: jest.fn().mockResolvedValue({
          id: '123',
          name: 'User',
          birth_date: options?.noSetup ? '' : '1990-01-01',
          birth_time: '12:00',
          birth_place: options?.noSetup ? '' : 'Moscow',
          language: 'ru',
        }),
      },
      natal_charts: {
        getPrimary: jest.fn().mockResolvedValue(options?.noSetup ? null : {
          id: 7,
          chart_data: chart,
          timezone: 'Europe/Moscow',
        }),
        getById: jest.fn().mockResolvedValue(null),
      },
      content_interpretations: {
        getByChart: jest.fn().mockResolvedValue(null),
        getByUser: jest.fn().mockResolvedValue(null),
        upsertByChart: jest.fn().mockResolvedValue({ id: 1 }),
        upsertByUser: jest.fn().mockResolvedValue({ id: 1 }),
      },
    },
  }));
}

async function callHandler(body: any) {
  const { default: handler } = await import('../pages/api/content/today/pulse');
  const res = createResponse();
  await handler({ method: 'POST', query: {}, body } as any, res);
  return res;
}

describe('today pulse API', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('returns ready pulse from request chart data', async () => {
    mockStableTransits();
    mockDb();
    const res = await callHandler({
      userId: '123',
      date: '2026-05-15',
      profile: { id: '123', language: 'ru' },
      chartData: chart,
      chartId: 7,
    });

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.status).toBe('ready');
    expect(payload.pulse.points).toHaveLength(24);
    expect(payload.pulse.windows).toHaveLength(6);
  });

  it('returns needs_setup when birth data and chart are absent', async () => {
    mockStableTransits();
    mockDb({ noSetup: true });
    const res = await callHandler({
      userId: '123',
      date: '2026-05-15',
      profile: { id: '123', language: 'ru' },
      chartData: null,
    });

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.status).toBe('needs_setup');
    expect(payload.code).toBe('PROFILE_BIRTH_DATA_REQUIRED');
  });
});
