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

const savedCheckIn = {
  id: 1,
  userId: '123',
  chartId: 7,
  date: '2026-05-20',
  timezone: 'Europe/Moscow',
  focus: 'normal',
  mood: 'steady',
  people: 'quiet',
  forecastFit: 'partial',
  pulseTime: '09:00',
  pulsePhase: 'entry',
  pulseScore: 60,
  pulseLayers: { energy: 60, focus: 60, emotions: 55, money: 55, relationships: 55 },
  createdAt: '2026-05-20T00:00:00.000Z',
  updatedAt: '2026-05-20T00:00:00.000Z',
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

function mockDb() {
  const createAction = jest.fn().mockResolvedValue(1);
  const upsertCheckin = jest.fn().mockResolvedValue(savedCheckIn);
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
      daily_checkins: {
        getForDate: jest.fn().mockResolvedValue(null),
        listRecent: jest.fn().mockResolvedValue([]),
        upsert: upsertCheckin,
      },
      action_timing_events: {
        listRecent: jest.fn().mockResolvedValue([]),
        create: createAction,
      },
      personal_pattern_insights: {
        upsertMany: jest.fn().mockResolvedValue([]),
      },
    },
  }));
  return { createAction, upsertCheckin };
}

async function call(path: 'home' | 'checkin' | 'action-time', body: any) {
  const mod = await import(`../pages/api/content/today/${path}`);
  const res = createResponse();
  await mod.default({ method: 'POST', query: {}, body } as any, res);
  return res;
}

describe('today assistant API', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('returns home assistant payload with pulse and quick actions', async () => {
    mockStableTransits();
    mockDb();
    const res = await call('home', { userId: '123', date: '2026-05-20', profile: { id: '123', language: 'ru' }, chartData: chart, chartId: 7 });
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.status).toBe('ready');
    expect(payload.pulse.points).toHaveLength(24);
    expect(payload.quickActions.length).toBeGreaterThanOrEqual(6);
  });

  it('saves check-in and returns updated learning summary', async () => {
    mockStableTransits();
    const { upsertCheckin } = mockDb();
    const res = await call('checkin', {
      userId: '123',
      date: '2026-05-20',
      profile: { id: '123', language: 'ru' },
      chartData: chart,
      chartId: 7,
      checkIn: { focus: 'normal', mood: 'steady', people: 'quiet', forecastFit: 'partial' },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(upsertCheckin).toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].status).toBe('saved');
  });

  it('returns and persists action timing recommendation', async () => {
    mockStableTransits();
    const { createAction } = mockDb();
    const res = await call('action-time', { userId: '123', date: '2026-05-20', profile: { id: '123', language: 'ru' }, chartData: chart, chartId: 7, actionKey: 'work' });
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.status).toBe('ready');
    expect(payload.recommendation.actionKey).toBe('work');
    expect(createAction).toHaveBeenCalled();
  });
});
