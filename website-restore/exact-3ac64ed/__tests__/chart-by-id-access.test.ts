const mockGetById = jest.fn();
const mockArchive = jest.fn();
const mockRequireAppUser = jest.fn();
const mockGetPremiumEntitlementState = jest.fn();
const mockRepairCanonicalChartRecord = jest.fn();

jest.mock('../lib/db', () => ({
  db: {
    natal_charts: {
      getById: (...args: unknown[]) => mockGetById(...args),
      archive: (...args: unknown[]) => mockArchive(...args),
    },
  },
}));
jest.mock('../lib/auth/appAuth', () => ({
  requireAppUser: (...args: unknown[]) => mockRequireAppUser(...args),
}));
jest.mock('../lib/contentArchitecture', () => ({
  getPremiumEntitlementState: (...args: unknown[]) => mockGetPremiumEntitlementState(...args),
}));
jest.mock('../lib/natalChartPersistence', () => ({
  repairCanonicalChartRecord: (...args: unknown[]) => mockRepairCanonicalChartRecord(...args),
}));

import handler from '../pages/api/charts/chart/[chartId]';

function response() {
  const res: any = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe('chart by id access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAppUser.mockResolvedValue({ userId: 'owner-1', isGuest: false });
    mockGetPremiumEntitlementState.mockResolvedValue({ isPremium: false, entitlement: null });
  });

  it('never lets a query userId redirect an authenticated chart read', async () => {
    mockGetById.mockResolvedValue({
      id: 7,
      user_id: 'owner-2',
      subject_type: 'self',
      chart_data: { sun: {}, moon: {}, rising: {} },
    });
    const res = response();

    await handler({ method: 'GET', query: { chartId: '7', userId: 'owner-2' }, headers: {} } as any, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Chart not found' });
    expect(mockRequireAppUser).toHaveBeenCalledWith(expect.anything(), { allowGuest: true });
  });

  it('keeps an expired saved person stored but blocks its reading', async () => {
    mockGetById.mockResolvedValue({
      id: 8,
      user_id: 'owner-1',
      subject_type: 'saved_person',
      archived_at: null,
      chart_data: { sun: {}, moon: {}, rising: {} },
    });
    const res = response();

    await handler({ method: 'GET', query: { chartId: '8' }, headers: {} } as any, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'PREMIUM_REQUIRED' }));
    expect(mockArchive).not.toHaveBeenCalled();
  });

  it('repairs the same saved-chart record without dropping approximate-time metadata', async () => {
    mockGetPremiumEntitlementState.mockResolvedValue({ isPremium: true, entitlement: null });
    mockGetById.mockResolvedValue({
      id: 9,
      user_id: 'owner-1',
      name: 'Марина',
      subject_type: 'saved_person',
      is_primary: false,
      birth_date: '1991-06-10',
      birth_time: '12:20',
      birth_time_mode: 'approximate',
      birth_time_uncertainty_minutes: 30,
      birth_time_range_start: null,
      birth_time_range_end: null,
      birth_place: 'Казань',
      chart_data: {},
    });
    mockRepairCanonicalChartRecord.mockResolvedValue({
      source: 'repaired',
      chart: {
        id: 9,
        user_id: 'owner-1',
        name: 'Марина',
        subject_type: 'saved_person',
        is_primary: false,
        birth_date: '1991-06-10',
        birth_time: '12:20',
        birth_time_mode: 'approximate',
        birth_time_uncertainty_minutes: 30,
        birth_time_range_start: null,
        birth_time_range_end: null,
        birth_place: 'Казань',
        chart_data: { schemaVersion: 'natal-chart-v2' },
      },
    });
    const res = response();

    await handler({ method: 'GET', query: { chartId: '9' }, headers: {} } as any, res);

    expect(mockRepairCanonicalChartRecord).toHaveBeenCalledWith('owner-1', 9);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      id: 9,
      birth_time_mode: 'approximate',
      birth_time_uncertainty_minutes: 30,
    }));
  });

  it('refuses to archive the self chart', async () => {
    mockGetById.mockResolvedValue({
      id: 1,
      user_id: 'owner-1',
      subject_type: 'self',
      archived_at: null,
    });
    const res = response();

    await handler({ method: 'DELETE', query: { chartId: '1' }, headers: {} } as any, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SELF_CHART_IMMUTABLE' }));
    expect(mockArchive).not.toHaveBeenCalled();
  });
});
