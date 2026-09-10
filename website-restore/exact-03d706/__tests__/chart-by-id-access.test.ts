const mockGetById = jest.fn();
const mockGetAll = jest.fn();
const mockArchive = jest.fn();
const mockRequireAppUser = jest.fn();
const mockGetPremiumEntitlementState = jest.fn();
const mockRepairCanonicalChartRecord = jest.fn();

jest.mock('../lib/db', () => ({
  db: {
    natal_charts: {
      getById: (...args: unknown[]) => mockGetById(...args),
      getAll: (...args: unknown[]) => mockGetAll(...args),
      archive: (...args: unknown[]) => mockArchive(...args),
    },
  },
}));
jest.mock('../lib/natalChartV2Repository', () => ({ natalChartV2Repository: {
  getById: (...args: unknown[]) => mockGetById(...args),
  getAll: (...args: unknown[]) => mockGetAll(...args),
} }));
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
import { canonicalNatalChart } from './fixtures/canonicalNatalChart';

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
    mockGetAll.mockResolvedValue([{ id: 7, user_id: 'owner-1', subject_type: 'saved_person' }, { id: 8, user_id: 'owner-1', subject_type: 'saved_person' }]);
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
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'CHART_NOT_FOUND' }));
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

  it('reports a damaged saved-chart record without repairing or changing approximate-time metadata', async () => {
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
    mockGetAll.mockResolvedValue([{ id: 9, user_id: 'owner-1', subject_type: 'saved_person' }]);
    const res = response();

    await handler({ method: 'GET', query: { chartId: '9' }, headers: {} } as any, res);

    expect(mockRepairCanonicalChartRecord).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'CHART_REPAIR_REQUIRED' }));
    expect(await mockGetById.mock.results[0].value).toMatchObject({
      birth_time_mode: 'approximate',
      birth_time_uncertainty_minutes: 30,
      chart_data: {},
    });
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

  it('reads the first Free saved person and rejects an incomplete snapshot without repair', async () => {
    mockGetById.mockResolvedValue({ id: 7, user_id: 'owner-1', subject_type: 'saved_person', input_hash: 'saved', chart_data: canonicalNatalChart() });
    const allowed = response();
    await handler({ method: 'GET', query: { chartId: '7' }, headers: {} } as any, allowed);
    expect(allowed.status).toHaveBeenCalledWith(200);
    expect(allowed.json).toHaveBeenCalledWith(expect.objectContaining({ access_locked: false }));
    mockGetById.mockResolvedValue({ id: 7, user_id: 'owner-1', subject_type: 'saved_person', chart_data: {} });
    const incomplete = response();
    await handler({ method: 'GET', query: { chartId: '7' }, headers: {} } as any, incomplete);
    expect(incomplete.status).toHaveBeenCalledWith(409);
    expect(incomplete.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'CHART_REPAIR_REQUIRED' }));
    expect(mockArchive).not.toHaveBeenCalled();
  });
});
