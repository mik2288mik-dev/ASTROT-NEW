const mockQuery = jest.fn();
const mockRelease = jest.fn();

jest.mock('../lib/db', () => ({
  getPool: () => ({
    connect: async () => ({ query: mockQuery, release: mockRelease }),
  }),
}));

import { activatePremium } from '../services/premiumService';

describe('paid Premium activation convergence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('repairs users and canonical entitlement on a duplicate webhook retry', async () => {
    const entitlementEndsAt = '2026-09-13T00:00:00.000Z';
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT premium_until FROM users')) {
        return { rowCount: 1, rows: [{ premium_until: null }] };
      }
      if (sql.includes('INSERT INTO star_payments')) {
        return { rowCount: 0, rows: [] };
      }
      if (sql.includes('FROM star_payments WHERE')) {
        return {
          rowCount: 1,
          rows: [{
            user_id: '42',
            status: 'confirmed',
            refunded_at: null,
            created_at: '2026-08-13T00:00:00.000Z',
            payload_json: { entitlementEndsAt },
          }],
        };
      }
      return { rowCount: 1, rows: [] };
    });

    await expect(activatePremium('42', 'charge-retry', 100, {
      paymentType: 'premium_month',
      durationDays: 30,
    })).resolves.toEqual({
      activated: false,
      alreadyHadPremium: false,
      premiumUntil: entitlementEndsAt,
    });

    const sql = mockQuery.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('UPDATE users');
    expect(sql).toContain('INSERT INTO premium_entitlements');
    expect(sql).toContain("entitlement_state, source");
    expect(mockQuery.mock.calls.some(([, params]) => Array.isArray(params) && params.includes('paid'))).toBe(true);
    expect(sql).toContain('COMMIT');
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('does not resurrect an expired legacy payment when it is replayed', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT premium_until FROM users')) {
        return { rowCount: 1, rows: [{ premium_until: '2025-02-01T00:00:00.000Z' }] };
      }
      if (sql.includes('INSERT INTO star_payments')) {
        return { rowCount: 0, rows: [] };
      }
      if (sql.includes('FROM star_payments WHERE')) {
        return {
          rowCount: 1,
          rows: [{
            user_id: '42',
            status: 'confirmed',
            refunded_at: null,
            created_at: '2025-01-01T00:00:00.000Z',
            payload_json: {},
          }],
        };
      }
      return { rowCount: 1, rows: [] };
    });

    await expect(activatePremium('42', 'legacy-charge-retry', 100, {
      paymentType: 'premium_month',
      durationDays: 30,
    })).resolves.toMatchObject({
      activated: false,
      alreadyHadPremium: false,
      premiumUntil: '2025-01-31T00:00:00.000Z',
    });

    const updateUsersCall = mockQuery.mock.calls.find(([sql]) => String(sql).includes('UPDATE users'));
    expect(updateUsersCall?.[1]).toEqual(['42', '2025-01-31T00:00:00.000Z']);
    const entitlementCall = mockQuery.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO premium_entitlements'));
    expect(entitlementCall?.[1]).toEqual(expect.arrayContaining(['expired']));
  });
});
