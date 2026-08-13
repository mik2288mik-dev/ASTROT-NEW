const mockGetAll = jest.fn();
const mockRequireAppUser = jest.fn();
const mockGetPremiumEntitlementState = jest.fn();
const mockRepairCanonicalChartForUser = jest.fn();

jest.mock('../lib/db', () => ({
  db: {
    natal_charts: {
      getAll: (...args: unknown[]) => mockGetAll(...args),
      getById: jest.fn(),
    },
  },
}));
jest.mock('../lib/natalChartV2Repository', () => ({
  natalChartV2Repository: {
    getAll: (...args: unknown[]) => mockGetAll(...args),
    setIdentityMetadata: jest.fn(),
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
  ensureCanonicalPrimaryChart: jest.fn(),
  repairCanonicalChartForUser: (...args: unknown[]) => mockRepairCanonicalChartForUser(...args),
}));
jest.mock('../lib/serverLocks', () => ({
  tryAcquireLock: jest.fn(),
  releaseLock: jest.fn(),
  LockKeys: {
    primaryChartCalculation: jest.fn(),
    contentGeneration: jest.fn(),
  },
}));

import handler from '../pages/api/charts/index';

function response() {
  const res: any = { setHeader: jest.fn(), status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

const self = {
  id: 1,
  user_id: '101',
  name: 'Me',
  subject_type: 'self',
  is_primary: true,
  archived_at: null,
  chart_data: { sun: { sign: 'Aries' }, moon: {}, rising: {} },
};

const savedPeople = Array.from({ length: 5 }, (_, index) => ({
  id: index + 2,
  user_id: '101',
  name: `Person ${index + 1}`,
  subject_type: 'saved_person',
  is_primary: false,
  archived_at: null,
  relation_label: 'Friend',
  chart_data: { sun: { sign: 'Libra' }, moon: {}, rising: {} },
  aspects: [{ type: 'trine' }],
  input_hash: `hash-${index + 1}`,
}));

describe('chart list entitlement access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAppUser.mockResolvedValue({ userId: '101', isGuest: false });
    mockGetAll.mockResolvedValue([self, ...savedPeople]);
  });

  it('keeps five saved people after expiry but locks and redacts their calculations', async () => {
    mockGetPremiumEntitlementState.mockResolvedValue({ isPremium: false, entitlement: null });
    const res = response();

    await handler({ method: 'GET', query: { userId: 'someone-else' }, headers: {} } as any, res);

    expect(mockGetAll).toHaveBeenCalledWith('101');
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload).toMatchObject({
      chartSlots: 1,
      canAddMore: false,
      canAddSavedPeople: false,
      isPremium: false,
    });
    expect(payload.charts).toHaveLength(6);
    expect(payload.charts[0]).toMatchObject({ id: 1, access_locked: false, chart_data: self.chart_data });
    for (const chart of payload.charts.slice(1)) {
      expect(chart).toMatchObject({ subject_type: 'saved_person', access_locked: true });
      expect(chart).not.toHaveProperty('chart_data');
      expect(chart).not.toHaveProperty('aspects');
      expect(chart).not.toHaveProperty('input_hash');
    }
  });

  it('unlocks all five additional charts on Premium and reports six active slots', async () => {
    mockGetPremiumEntitlementState.mockResolvedValue({ isPremium: true, entitlement: { id: 9 } });
    const res = response();

    await handler({ method: 'GET', query: {}, headers: {} } as any, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload).toMatchObject({
      chartSlots: 6,
      canAddMore: false,
      canAddSavedPeople: false,
      isPremium: true,
    });
    expect(payload.charts).toHaveLength(6);
    expect(payload.charts.slice(1)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 2, access_locked: false, chart_data: savedPeople[0].chart_data }),
    ]));
  });

  it('can list existing snapshots for personality selection without repairing the primary chart', async () => {
    mockGetPremiumEntitlementState.mockResolvedValue({ isPremium: true, entitlement: { id: 9 } });
    const res = response();

    await handler({ method: 'GET', query: { repairPrimary: '0' }, headers: {} } as any, res);

    expect(mockRepairCanonicalChartForUser).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].charts).toHaveLength(6);
  });
});
