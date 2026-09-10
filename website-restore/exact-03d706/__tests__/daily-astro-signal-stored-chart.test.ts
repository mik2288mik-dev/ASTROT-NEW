const mockGetUser = jest.fn();
const mockGetPrimary = jest.fn();
const mockGetById = jest.fn();
const mockBuildDailyAstroSignal = jest.fn();
const mockRepair = jest.fn();
const mockReadCache = jest.fn();
const mockWriteCache = jest.fn();

jest.mock('../lib/db', () => ({
  db: {
    users: { get: (...args: unknown[]) => mockGetUser(...args) },
    natal_charts: {
      getPrimary: (...args: unknown[]) => mockGetPrimary(...args),
      getById: (...args: unknown[]) => mockGetById(...args),
    },
    content_interpretations: {
      getByChart: (...args: unknown[]) => mockReadCache(...args),
      upsertByChart: (...args: unknown[]) => mockWriteCache(...args),
    },
  },
}));
jest.mock('../lib/natalChartPersistence', () => ({ repairCanonicalChartRecord: mockRepair }));
jest.mock('../lib/dailyAstroSignal', () => ({
  DAILY_ASTRO_SIGNAL_CALCULATION_VERSION: 'test-v1',
  buildDailyAstroSignal: (...args: unknown[]) => mockBuildDailyAstroSignal(...args),
  isFullSwissDailyAstroSignal: (value: unknown) => !!value,
}));

import { resolveDailyAstroSignalForUser } from '../lib/dailyAstroSignalResolver';
import { canonicalNatalChart } from './fixtures/canonicalNatalChart';

const chartData = canonicalNatalChart({
  calculationVersion: 'swisseph-canonical-previous',
  time: { mode: 'unknown', localTime: null, uncertaintyMinutes: null, rangeStart: null, rangeEnd: null },
});

describe('daily signal uses stored natal chart only', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ id: '42', birth_date: '1990-01-01', birth_place: 'Moscow', birth_time: null });
    mockGetPrimary.mockResolvedValue({ id: 1, user_id: '42', chart_data: chartData, input_hash: 'birth-hash' });
    mockBuildDailyAstroSignal.mockResolvedValue({
      date: '2026-09-04', timezone: 'Europe/Moscow', calculationVersion: 'test-v1', source: 'swisseph',
      points: Array(24).fill({}), windows: Array(6).fill({}), keyMoments: Array(4).fill({}),
    });
    mockReadCache.mockResolvedValue(null);
    mockWriteCache.mockResolvedValue(undefined);
  });

  it('uses an existing unknown-time chart from an older calculator version without natal repair', async () => {
    const result = await resolveDailyAstroSignalForUser({ userId: '42', dateKey: '2026-09-04' });

    expect(result?.status).toBe('ready');
    expect(mockBuildDailyAstroSignal).toHaveBeenCalledWith(expect.objectContaining({ chartData }));
    expect(result?.profile.birthTime).toBe('');
    expect(mockRepair).not.toHaveBeenCalled();
  });

  it.each([null, { id: 1, chart_data: { sun: {}, moon: {} }, input_hash: 'incomplete' }, { id: 1, chart_data: chartData, input_hash: null }])(
    'returns unavailable for absent or incomplete natal data instead of calculating on read',
    async (stored) => {
      mockGetPrimary.mockResolvedValue(stored);

      const result = await resolveDailyAstroSignalForUser({ userId: '42' });

      expect(result?.status).toBe('needs_setup');
      expect(mockRepair).not.toHaveBeenCalled();
      expect(mockBuildDailyAstroSignal).not.toHaveBeenCalled();
    },
  );

  it('reuses the pulse only for the same saved birth input and calculation revision', async () => {
    const cached = new Map<string, any>();
    mockReadCache.mockImplementation(async (_id: number, _tier: string, _surface: string, _variant: string, key: string) => cached.get(key) || null);
    mockWriteCache.mockImplementation(async (_id: number, payload: any) => { cached.set(payload.cacheKey, { content: payload.content }); });

    await resolveDailyAstroSignalForUser({ userId: '42', dateKey: '2026-09-04' });
    const repeated = await resolveDailyAstroSignalForUser({ userId: '42', dateKey: '2026-09-04' });
    expect(repeated?.status === 'ready' && repeated.source).toBe('cache');
    expect(mockBuildDailyAstroSignal).toHaveBeenCalledTimes(1);

    const edited = canonicalNatalChart({ birthDate: '1991-01-01' });
    mockGetPrimary.mockResolvedValue({ id: 1, user_id: '42', chart_data: edited, input_hash: 'changed-birth-hash' });
    await resolveDailyAstroSignalForUser({ userId: '42', dateKey: '2026-09-04' });
    expect(mockBuildDailyAstroSignal).toHaveBeenCalledTimes(2);

    const repaired = { ...edited, calculationMetadata: { ...edited.calculationMetadata, calculatedAt: '2026-09-04T12:01:00.000Z' } };
    mockGetPrimary.mockResolvedValue({ id: 1, user_id: '42', chart_data: repaired, input_hash: 'changed-birth-hash' });
    await resolveDailyAstroSignalForUser({ userId: '42', dateKey: '2026-09-04' });
    expect(mockBuildDailyAstroSignal).toHaveBeenCalledTimes(3);
    expect(cached.size).toBe(3);
    expect(mockRepair).not.toHaveBeenCalled();
  });
});
