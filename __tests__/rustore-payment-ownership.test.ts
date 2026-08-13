import { generateKeyPairSync } from 'node:crypto';

const mockGetPool = jest.fn();
const mockGetPremiumEntitlementState = jest.fn();

jest.mock('../lib/db', () => ({
  getPool: (...args: unknown[]) => mockGetPool(...args),
}));
jest.mock('../lib/contentArchitecture', () => ({
  getPremiumEntitlementState: (...args: unknown[]) => mockGetPremiumEntitlementState(...args),
  publicPremiumEntitlementSnapshot: (value: unknown) => value,
}));

import {
  RuStorePaymentError,
  validateRuStorePurchase,
} from '../lib/rustorePayments';

describe('RuStore purchase ownership', () => {
  const originalFetch = global.fetch;
  const privateKey = generateKeyPairSync('rsa', { modulusLength: 2048 })
    .privateKey.export({ format: 'der', type: 'pkcs8' })
    .toString('base64');

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RUSTORE_PACKAGE_NAME = 'ru.example.app';
    process.env.RUSTORE_ALLOWED_PRODUCT_IDS = 'premium_month';
    process.env.RUSTORE_KEY_ID = 'test-key';
    process.env.RUSTORE_PRIVATE_KEY_BASE64 = privateKey;
    mockGetPremiumEntitlementState.mockResolvedValue({ state: 'paid', isPremium: true });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('rejects a provider response without externalAccountId before touching the ledger', async () => {
    const queries: string[] = [];
    const client = {
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
        return { rowCount: 1, rows: [] };
      }),
      release: jest.fn(),
    };
    mockGetPool.mockReturnValue({ connect: jest.fn(async () => client) });
    global.fetch = jest.fn(async (input) => new Response(JSON.stringify(
      String(input).includes('/public/auth')
        ? { code: 'OK', body: { jwe: 'public-token', ttl: 900 } }
        : {
            code: 'OK',
            timestamp: new Date().toISOString(),
            body: {
              paymentState: 1,
              autoRenewing: true,
              expiryTimeMillis: Date.now() + 86_400_000,
            },
          },
    ), { status: 200 })) as typeof fetch;

    await expect(validateRuStorePurchase({
      userId: '101',
      productId: 'premium_month',
      purchaseId: 'purchase-without-owner',
    })).rejects.toMatchObject({
      code: 'RUSTORE_PURCHASE_ACCOUNT_REQUIRED',
    });
    expect(queries.some((sql) => sql.includes('INSERT INTO store_purchases'))).toBe(false);
    expect(queries.some((sql) => sql.includes('INSERT INTO premium_entitlements'))).toBe(false);
  });

  it('cannot grant when a concurrent insert established another purchase owner', async () => {
    global.fetch = jest.fn(async (input) => new Response(JSON.stringify(
      String(input).includes('/public/auth')
        ? { code: 'OK', body: { jwe: 'public-token', ttl: 900 } }
        : {
            code: 'OK',
            timestamp: new Date().toISOString(),
            body: {
              paymentState: 1,
              autoRenewing: true,
              externalAccountId: '101',
              expiryTimeMillis: Date.now() + 86_400_000,
            },
          },
    ), { status: 200 })) as typeof fetch;

    let insertAttempted = false;
    const queries: string[] = [];
    const client = {
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
        if (sql.includes('INSERT INTO store_purchases')) {
          insertAttempted = true;
          return { rowCount: 0, rows: [] };
        }
        if (sql.includes('SELECT user_id') && sql.includes('store_purchases')) {
          return insertAttempted
            ? { rowCount: 1, rows: [{ user_id: '202' }] }
            : { rowCount: 0, rows: [] };
        }
        return { rowCount: 1, rows: [] };
      }),
      release: jest.fn(),
    };
    mockGetPool.mockReturnValue({ connect: jest.fn(async () => client) });

    await expect(validateRuStorePurchase({
      userId: '101',
      productId: 'premium_month',
      purchaseId: 'one-purchase-one-owner',
    })).rejects.toMatchObject({
      code: 'RUSTORE_PURCHASE_OWNED_BY_ANOTHER_USER',
    });

    expect(queries.findIndex((sql) => sql.includes('INSERT INTO store_purchases')))
      .toBeLessThan(queries.findIndex((sql) => sql.includes('SELECT user_id')));
    expect(queries.some((sql) => sql.includes('INSERT INTO premium_entitlements'))).toBe(false);
  });

  it('uses the mandatory RuStore response timestamp as the ledger freshness token', async () => {
    const providerTimestamp = '2026-08-13T10:00:00.000654321Z';
    global.fetch = jest.fn(async (input) => new Response(JSON.stringify(
      String(input).includes('/public/auth')
        ? { code: 'OK', body: { jwe: 'public-token', ttl: 900 } }
        : {
            code: 'OK',
            timestamp: providerTimestamp,
            body: {
              paymentState: 1,
              autoRenewing: true,
              externalAccountId: '101',
              expiryTimeMillis: Date.now() + 86_400_000,
            },
          },
    ), { status: 200 })) as typeof fetch;

    const paramsBySql: Array<{ sql: string; params: unknown[] | undefined }> = [];
    const client = {
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        paramsBySql.push({ sql, params });
        if (sql.includes('SELECT user_id') && sql.includes('store_purchases')) {
          return {
            rowCount: 1,
            rows: [{
              user_id: '101',
              status: 'paid',
              entitlement_state: 'paid',
              auto_renewing: true,
              expires_at: new Date(Date.now() + 86_400_000),
              last_validated_at: null,
              provider_event_time: null,
              provider_period: null,
              provider_status: null,
              provider_subscription_event_type: null,
            }],
          };
        }
        return { rowCount: 1, rows: [] };
      }),
      release: jest.fn(),
    };
    mockGetPool.mockReturnValue({ connect: jest.fn(async () => client) });

    await validateRuStorePurchase({
      userId: '101',
      productId: 'premium_month',
      purchaseId: 'provider-timestamp-ordering',
    });

    const ledgerUpdate = paramsBySql.find(({ sql }) => sql.includes('UPDATE store_purchases'));
    expect(ledgerUpdate?.params?.[9]).toBe(providerTimestamp);
  });

  it('lets PostgreSQL compare same-millisecond provider timestamps at full precision', async () => {
    const olderTimestamp = '2026-08-13T10:00:00.000123456Z';
    global.fetch = jest.fn(async (input) => new Response(JSON.stringify(
      String(input).includes('/public/auth')
        ? { code: 'OK', body: { jwe: 'public-token', ttl: 900 } }
        : {
            code: 'OK',
            timestamp: olderTimestamp,
            body: {
              paymentState: 0,
              autoRenewing: false,
              externalAccountId: '101',
              expiryTimeMillis: Date.now() - 1,
            },
          },
    ), { status: 200 })) as typeof fetch;

    const queries: Array<{ sql: string; params?: unknown[] }> = [];
    const client = {
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        queries.push({ sql, params });
        if (sql.includes('INSERT INTO store_purchases')) return { rowCount: 0, rows: [] };
        if (sql.includes('SELECT user_id') && sql.includes('store_purchases')) {
          return {
            rowCount: 1,
            rows: [{
              user_id: '101',
              status: 'paid',
              entitlement_state: 'paid',
              auto_renewing: true,
              expires_at: new Date(Date.now() + 86_400_000),
              last_validated_at: '2026-08-13T10:00:00.000987654Z',
              provider_event_time: null,
              provider_event_time_raw: null,
              provider_period: null,
              provider_status: null,
              provider_subscription_event_type: null,
              stored_validation_is_newer: true,
              validation_timestamp_is_equal: false,
              incoming_provider_event_is_newer: false,
              provider_event_timestamp_is_equal: false,
            }],
          };
        }
        return { rowCount: 1, rows: [] };
      }),
      release: jest.fn(),
    };
    mockGetPool.mockReturnValue({ connect: jest.fn(async () => client) });

    await expect(validateRuStorePurchase({
      userId: '101',
      productId: 'premium_month',
      purchaseId: 'same-ms-ordering',
    })).resolves.toMatchObject({ status: 'paid' });

    const ledgerRead = queries.find(({ sql }) => sql.includes('stored_validation_is_newer'));
    expect(ledgerRead?.params).toEqual(['same-ms-ordering', olderTimestamp, null]);
    expect(queries.some(({ sql }) => sql.includes('UPDATE store_purchases'))).toBe(false);
  });
});
