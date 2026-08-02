const mockGetById = jest.fn();
const mockArchive = jest.fn();
const mockRequireAppUser = jest.fn();
const mockGetPremiumEntitlementState = jest.fn();

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
  createOrReuseCanonicalChart: jest.fn(),
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
