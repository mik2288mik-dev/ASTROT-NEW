const mockUserGet = jest.fn();
const mockChartGetById = jest.fn();
const mockPrimaryGet = jest.fn();
const mockRepairCanonicalChartRecord = jest.fn();
const mockRepairCanonicalChartForUser = jest.fn();
const mockChartGetAll = jest.fn();
const mockRequireAppUser = jest.fn();
const mockGetPremiumEntitlementState = jest.fn();

jest.mock('../lib/db', () => ({
  db: {
    users: { get: (...args: unknown[]) => mockUserGet(...args) },
    natal_charts: {
      getById: (...args: unknown[]) => mockChartGetById(...args),
      getPrimary: (...args: unknown[]) => mockPrimaryGet(...args),
      getAll: (...args: unknown[]) => mockChartGetAll(...args),
    },
  },
}));
jest.mock('../lib/natalChartPersistence', () => ({
  repairCanonicalChartForUser: (...args: unknown[]) => mockRepairCanonicalChartForUser(...args),
  repairCanonicalChartRecord: (...args: unknown[]) => mockRepairCanonicalChartRecord(...args),
}));
jest.mock('../lib/astrologyHistoryPersistence', () => ({
  persistNatalReadingHistory: jest.fn(),
}));
jest.mock('../lib/contentArchitecture', () => ({
  getContentLayer: jest.fn(),
  getPremiumEntitlementState: (...args: unknown[]) => mockGetPremiumEntitlementState(...args),
}));
jest.mock('../lib/auth/appAuth', () => ({ requireAppUser: (...args: unknown[]) => mockRequireAppUser(...args) }));

import { ensureValidContext, resolveReadingContext } from '../lib/natalReading/apiHelper';
import { isCanonicalNatalChartDataComplete } from '../lib/natalChartCanonical';
import { canonicalNatalChart } from './fixtures/canonicalNatalChart';

const primaryChartData = {
  schemaVersion: 'natal-chart-data-v2',
  positions: { sun: { sign: 'Aries' } },
  chartQuality: { birthTimeQuality: 'exact' },
  calculationVersion: 'primary-v1',
};
const savedChartData = canonicalNatalChart({ time: { mode: 'unknown', localTime: null, uncertaintyMinutes: null, rangeStart: null, rangeEnd: null } });

describe('saved-person natal report context', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAppUser.mockResolvedValue({ userId: 'owner-1' });
    mockGetPremiumEntitlementState.mockResolvedValue({ isPremium: false });
    mockChartGetAll.mockResolvedValue([
      { id: 1, subject_type: 'self' },
      { id: 77, subject_type: 'saved_person' },
      { id: 78, subject_type: 'saved_person' },
    ]);
    mockUserGet.mockResolvedValue({
      id: 'owner-1', name: 'Owner', birth_date: '1990-01-01', birth_time: '12:00',
      birth_place: 'Moscow', language: 'ru', is_setup: true, is_premium: true,
    });
    mockPrimaryGet.mockResolvedValue({
      id: 1, user_id: 'owner-1', is_primary: true, subject_type: 'self',
      name: 'Owner', birth_date: '1990-01-01', birth_time: '12:00', birth_place: 'Moscow',
      chart_data: primaryChartData, input_hash: 'primary-birth-hash',
    });
    mockChartGetById.mockResolvedValue({
      id: 77, user_id: 'owner-1', is_primary: false, subject_type: 'saved_person',
      name: 'Лена', birth_date: '1994-02-03', birth_time: null, birth_place: 'Казань',
      relation_label: 'подруга', archived_at: null, chart_data: savedChartData, input_hash: 'saved-birth-hash',
    });
  });

  it('uses the requested saved chart and its subject profile instead of the owner primary chart', async () => {
    expect(isCanonicalNatalChartDataComplete(savedChartData)).toBe(true);
    const context = await resolveReadingContext('owner-1', 77);

    expect(mockChartGetById).toHaveBeenCalledWith(77);
    expect(mockPrimaryGet).not.toHaveBeenCalled();
    expect(mockRepairCanonicalChartRecord).not.toHaveBeenCalled();
    expect(context).toMatchObject({
      chartId: 77,
      chartData: savedChartData,
      chartInputHash: 'saved-birth-hash',
      chartSubjectType: 'saved_person',
      relationLabel: 'подруга',
      profile: {
        id: 'owner-1',
        name: 'Лена',
        birthDate: '1994-02-03',
        birthTime: '',
        birthPlace: 'Казань',
      },
    });
    expect(context?.chartData).not.toBe(primaryChartData);
  });

  it('can read an existing primary snapshot without repairing or invoking calculation', async () => {
    mockPrimaryGet.mockResolvedValueOnce({
      id: 1,
      user_id: 'owner-1',
      is_primary: true,
      subject_type: 'self',
      name: 'Owner',
      birth_date: '1990-01-01',
      birth_time: '12:00',
      birth_place: 'Moscow',
      chart_data: primaryChartData,
    });

    const context = await resolveReadingContext(
      'owner-1',
      null,
      undefined,
      undefined,
      { repairCanonical: false },
    );

    expect(context?.chartData).toBe(primaryChartData);
    expect(mockRepairCanonicalChartForUser).not.toHaveBeenCalled();
    expect(mockRepairCanonicalChartRecord).not.toHaveBeenCalled();
  });

  it('normalizes PostgreSQL Date values before exposing the profile', async () => {
    const storedBirthDate = new Date('1990-01-01T00:00:00.000Z');
    mockUserGet.mockResolvedValueOnce({
      id: 'owner-1', name: 'Owner', birth_date: storedBirthDate, birth_time: '12:00',
      birth_place: 'Moscow', language: 'ru', is_setup: true, is_premium: true,
    });
    mockPrimaryGet.mockResolvedValueOnce({
      id: 1, user_id: 'owner-1', is_primary: true, subject_type: 'self',
      name: 'Owner', birth_date: storedBirthDate, birth_time: '12:00', birth_place: 'Moscow',
      chart_data: primaryChartData,
    });

    const context = await resolveReadingContext('owner-1', null);

    expect(context?.profile.birthDate).toBe('1990-01-01');
  });

  it('never calculates a missing primary chart while opening a reading', async () => {
    mockPrimaryGet.mockResolvedValueOnce(null);

    const context = await resolveReadingContext('owner-1', null);

    expect(context?.chartData).toBeNull();
    expect(mockRepairCanonicalChartForUser).not.toHaveBeenCalled();
    expect(mockRepairCanonicalChartRecord).not.toHaveBeenCalled();
  });

  it('returns incomplete saved data for an explicit repair response, without changing it', async () => {
    const context = await resolveReadingContext('owner-1', null);

    expect(context?.chartData).toBe(primaryChartData);
    expect(mockRepairCanonicalChartForUser).not.toHaveBeenCalled();
    expect(mockRepairCanonicalChartRecord).not.toHaveBeenCalled();
  });

  it('does not treat a calculator version change as a reason to calculate again', async () => {
    const oldSnapshot = { ...savedChartData, calculationVersion: 'swisseph-canonical-v1' };
    mockChartGetById.mockResolvedValueOnce({
      id: 77, user_id: 'owner-1', subject_type: 'saved_person', archived_at: null,
      name: 'Лена', chart_data: oldSnapshot,
    });

    const context = await resolveReadingContext('owner-1', 77);

    expect(context?.chartData).toBe(oldSnapshot);
    expect(mockRepairCanonicalChartForUser).not.toHaveBeenCalled();
    expect(mockRepairCanonicalChartRecord).not.toHaveBeenCalled();
  });

  it('returns CHART_REPAIR_REQUIRED for an incomplete reading snapshot', async () => {
    const res: any = { status: jest.fn(), json: jest.fn() };
    res.status.mockReturnValue(res);

    const result = await ensureValidContext({ method: 'GET', query: {} } as any, res);

    expect(result).toBeNull();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'CHART_REPAIR_REQUIRED' }));
    expect(mockRepairCanonicalChartForUser).not.toHaveBeenCalled();
    expect(mockRepairCanonicalChartRecord).not.toHaveBeenCalled();
  });

  it('requires repair for a complete chart missing its persisted input hash', async () => {
    mockPrimaryGet.mockResolvedValueOnce({
      id: 1, user_id: 'owner-1', subject_type: 'self', chart_data: savedChartData, input_hash: null,
    });
    const res: any = { status: jest.fn(), json: jest.fn() };
    res.status.mockReturnValue(res);

    const result = await ensureValidContext({ method: 'GET', query: {} } as any, res);

    expect(result).toBeNull();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'CHART_REPAIR_REQUIRED' }));
    expect(mockRepairCanonicalChartForUser).not.toHaveBeenCalled();
    expect(mockRepairCanonicalChartRecord).not.toHaveBeenCalled();
  });

  it('allows the first saved person in Free and locks additional people without deleting them', async () => {
    const res: any = { status: jest.fn(), json: jest.fn() };
    res.status.mockReturnValue(res);

    const first = await ensureValidContext({ method: 'GET', query: { chartId: '77' } } as any, res);
    expect(first?.ctx.chartId).toBe(77);
    expect(mockChartGetAll).toHaveBeenCalledWith('owner-1');

    mockChartGetById.mockResolvedValueOnce({
      id: 78, user_id: 'owner-1', subject_type: 'saved_person', chart_data: savedChartData,
    });
    const second = await ensureValidContext({ method: 'GET', query: { chartId: '78' } } as any, res);
    expect(second).toBeNull();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockRepairCanonicalChartForUser).not.toHaveBeenCalled();
    expect(mockRepairCanonicalChartRecord).not.toHaveBeenCalled();
  });
});
