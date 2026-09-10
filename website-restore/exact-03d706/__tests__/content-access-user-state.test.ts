const mockGetPremiumEntitlementState = jest.fn();
const mockGetPrimary = jest.fn();
const mockListActive = jest.fn();
const mockGetUser = jest.fn();

jest.mock('../lib/contentArchitecture', () => ({
  getPremiumEntitlementState: (...args: unknown[]) => mockGetPremiumEntitlementState(...args),
}));

jest.mock('../lib/db', () => ({
  db: {
    natal_charts: { getPrimary: (...args: unknown[]) => mockGetPrimary(...args) },
    content_unlocks: { listActive: (...args: unknown[]) => mockListActive(...args) },
    users: { get: (...args: unknown[]) => mockGetUser(...args) },
  },
}));

import { buildContentAccessUserState } from '../lib/contentAccessUserState';

describe('content access user state adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPrimary.mockResolvedValue({ id: 7 });
    mockListActive.mockResolvedValue([]);
    mockGetUser.mockResolvedValue({ is_admin: false, premium_until: null });
  });

  it('maps a server-authoritative RuStore entitlement to paid state', async () => {
    mockGetPremiumEntitlementState.mockResolvedValue({
      isPremium: true,
      entitlement: {
        status: 'active',
        source: 'rustore_pay',
        endsAt: '2099-09-13T10:00:00.000Z',
      },
    });

    await expect(buildContentAccessUserState('42')).resolves.toMatchObject({
      userId: '42',
      chartId: 7,
      entitlementState: 'paid',
      entitlementEndsAt: '2099-09-13T10:00:00.000Z',
      isPremium: true,
    });
  });

  it('maps the users.premium_until fallback to legacy gift', async () => {
    mockGetPremiumEntitlementState.mockResolvedValue({ isPremium: true, entitlement: null });
    mockGetUser.mockResolvedValue({
      is_admin: false,
      premium_until: '2099-09-13T10:00:00.000Z',
    });

    await expect(buildContentAccessUserState('42')).resolves.toMatchObject({
      entitlementState: 'gift',
      entitlementEndsAt: '2099-09-13T10:00:00.000Z',
      isPremium: true,
    });
  });

  it('preserves the server snapshot state instead of re-inferring it from active status', async () => {
    mockGetPremiumEntitlementState.mockResolvedValue({
      state: 'cancelled_active',
      isPremium: true,
      source: 'rustore',
      startsAt: '2099-01-01T00:00:00.000Z',
      endsAt: '2099-09-13T10:00:00.000Z',
      autoRenew: false,
      productId: 'premium.3m',
      period: 'P3M',
      entitlement: {
        status: 'active',
        source: 'rustore',
        endsAt: '2099-09-13T10:00:00.000Z',
      },
    });

    await expect(buildContentAccessUserState('42')).resolves.toMatchObject({
      entitlementState: 'cancelled_active',
      entitlementEndsAt: '2099-09-13T10:00:00.000Z',
      isPremium: true,
    });
  });
});
