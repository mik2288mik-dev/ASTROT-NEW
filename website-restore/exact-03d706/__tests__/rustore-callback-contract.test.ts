import crypto from 'node:crypto';

const mockQuery = jest.fn();

jest.mock('../lib/db', () => ({
  getPool: () => ({ query: (...args: unknown[]) => mockQuery(...args) }),
}));
jest.mock('../lib/contentArchitecture', () => ({
  getPremiumEntitlementState: jest.fn(),
  publicPremiumEntitlementSnapshot: jest.fn(),
}));

import { processRuStoreCallback } from '../lib/rustorePayments';

function encryptPayload(value: unknown, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, encrypted, cipher.getAuthTag()]).toString('base64');
}

describe('RuStore callback ingress contract', () => {
  const key = Buffer.alloc(32, 7);
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      RUSTORE_CONSOLE_APP_ID: '12345',
      RUSTORE_NOTIFICATION_AES_KEY: key.toString('base64'),
      RUSTORE_ALLOWED_PRODUCT_IDS: 'premium.month',
      RUSTORE_PAY_MODE: 'sandbox',
    };
    mockQuery.mockResolvedValue({ rowCount: 1, rows: [{ id: 91 }] });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function callback(data: Record<string, unknown>, notificationType = 'SUBSCRIPTION_EVENT_SANDBOX') {
    return {
      id: `event-${crypto.randomUUID()}`,
      timestamp: '2099-01-01T00:00:00.000Z',
      payload: encryptPayload({
        app_id: 12345,
        notification_type: notificationType,
        data: JSON.stringify(data),
      }, key),
    };
  }

  const validData = {
    product_code: 'premium.month',
    purchase_id: 'purchase-1',
    event_time: '2026-08-13T10:00:00.000Z',
    subscription_event_type: 'PAYMENT_FAILED',
    status_new: 'ACTIVE',
    period_new: 'GRACE',
    autorenewing: true,
  };

  it('queues only a complete allowlisted subscription callback', async () => {
    await expect(processRuStoreCallback(callback(validData))).resolves.toEqual({
      duplicate: false,
      queued: true,
    });
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(mockQuery.mock.calls[0][1])).not.toContain('purchase_token');
  });

  it('does not substitute the delivery timestamp for missing encrypted event_time', async () => {
    const { event_time: _eventTime, ...missingEventTime } = validData;
    await expect(processRuStoreCallback(callback(missingEventTime))).rejects.toMatchObject({
      code: 'RUSTORE_CALLBACK_EVENT_TIME_REQUIRED',
    });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...validData, product_code: 'unpublished.product' }, 'RUSTORE_PRODUCT_NOT_ALLOWED'],
    [{ ...validData, subscription_event_type: 'UNKNOWN' }, 'RUSTORE_CALLBACK_EVENT_TYPE_INVALID'],
    [{ ...validData, status_new: 'UNKNOWN' }, 'RUSTORE_CALLBACK_STATUS_INVALID'],
    [{ ...validData, period_new: 'UNKNOWN' }, 'RUSTORE_CALLBACK_PERIOD_INVALID'],
    [{ ...validData, autorenewing: 'true' }, 'RUSTORE_CALLBACK_AUTORENEW_REQUIRED'],
  ])('rejects a malformed newer event before it can clear a provider overlay', async (data, code) => {
    await expect(processRuStoreCallback(callback(data))).rejects.toMatchObject({ code });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('rejects non-subscription payment callbacks in this subscription lifecycle', async () => {
    await expect(processRuStoreCallback(callback(validData, 'INVOICE_STATUS_SANDBOX')))
      .rejects.toMatchObject({ code: 'RUSTORE_CALLBACK_TYPE_UNSUPPORTED' });
  });
});
