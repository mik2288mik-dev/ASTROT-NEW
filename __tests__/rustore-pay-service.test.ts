import fs from 'node:fs';
import path from 'node:path';

const originalEnv = process.env;

function response(body: unknown, ok = true) {
  return {
    ok,
    json: jest.fn().mockResolvedValue(body),
  };
}

function loadService(nativeBridge: Record<string, jest.Mock>) {
  const apiFetch = jest.fn();
  jest.doMock('@capacitor/core', () => ({
    Capacitor: { getPlatform: () => 'android' },
    registerPlugin: () => nativeBridge,
  }));
  jest.doMock('../lib/distributionChannel', () => ({
    canUseRuStorePay: () => true,
  }));
  jest.doMock('../services/apiClient', () => ({ apiFetch }));

  return {
    apiFetch,
    service: require('../services/rustorePayService') as typeof import('../services/rustorePayService'),
  };
}

describe('RuStore Pay client service', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_RUSTORE_PRODUCT_PREMIUM_MONTH: 'premium.month',
      NEXT_PUBLIC_RUSTORE_PRODUCT_PREMIUM_QUARTER: 'premium.quarter',
      NEXT_PUBLIC_RUSTORE_PRODUCT_PREMIUM_YEAR: 'premium.year',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('exposes only subscription catalog entries and preserves subscriptionInfo periods', async () => {
    const nativeBridge = {
      getProducts: jest.fn().mockResolvedValue({
        products: [
          {
            productId: 'premium.month',
            title: 'Month',
            amountLabel: '299 ₽',
            type: 'SUBSCRIPTION',
            subscriptionInfo: {
              periods: [{ type: 'MainPeriod', duration: 'P1M', currency: 'RUB', price: 29900 }],
            },
          },
          {
            productId: 'premium.quarter',
            title: 'Not a subscription',
            amountLabel: '499 ₽',
            type: 'CONSUMABLE',
          },
        ],
      }),
    };
    const { service } = loadService(nativeBridge);

    await expect(service.loadRuStoreProducts()).resolves.toEqual({
      premium_month: {
        productId: 'premium.month',
        title: 'Month',
        amountLabel: '299 ₽',
        type: 'SUBSCRIPTION',
        subscriptionInfo: {
          periods: [{ type: 'MainPeriod', duration: 'P1M', currency: 'RUB', price: 29900 }],
        },
      },
    });
  });

  it('refuses checkout when the catalog product is not SUBSCRIPTION', async () => {
    const nativeBridge = {
      getAvailability: jest.fn().mockResolvedValue({ available: true }),
      getProducts: jest.fn().mockResolvedValue({
        products: [{ productId: 'premium.month', type: 'CONSUMABLE', amountLabel: '299 ₽' }],
      }),
      purchase: jest.fn(),
    };
    const { apiFetch, service } = loadService(nativeBridge);
    apiFetch.mockResolvedValueOnce(response({ identities: [{ provider: 'email' }] }));

    await expect(service.requestRuStorePayment({ id: 42 } as never, 'premium_month')).resolves.toEqual({
      status: 'unavailable',
      reason: 'RUSTORE_PRODUCT_NOT_SUBSCRIPTION',
    });
    expect(nativeBridge.purchase).not.toHaveBeenCalled();
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it('does not open checkout without a canonical account id', async () => {
    const nativeBridge = {
      getAvailability: jest.fn(),
      getProducts: jest.fn(),
      purchase: jest.fn(),
    };
    const { apiFetch, service } = loadService(nativeBridge);

    await expect(service.requestRuStorePayment({} as never, 'premium_month')).resolves.toEqual({
      status: 'unavailable',
      reason: 'RUSTORE_ACCOUNT_ID_REQUIRED',
    });
    expect(nativeBridge.getAvailability).not.toHaveBeenCalled();
    expect(nativeBridge.purchase).not.toHaveBeenCalled();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('does not claim cancellation when the SDK cannot reconcile purchase status', async () => {
    const nativeBridge = {
      getAvailability: jest.fn().mockResolvedValue({ available: true }),
      getProducts: jest.fn().mockResolvedValue({
        products: [{
          productId: 'premium.month',
          type: 'SUBSCRIPTION',
          amountLabel: '299 ₽',
          subscriptionInfo: { periods: [{ type: 'MainPeriod', duration: 'P1M' }] },
        }],
      }),
      purchase: jest.fn().mockRejectedValue({ code: 'RUSTORE_PURCHASE_STATUS_UNKNOWN' }),
    };
    const { apiFetch, service } = loadService(nativeBridge);
    apiFetch.mockResolvedValueOnce(response({ identities: [{ provider: 'email' }] }));

    await expect(service.requestRuStorePayment({ id: 42 } as never, 'premium_month')).resolves.toEqual({
      status: 'failed',
      reason: 'RUSTORE_PURCHASE_STATUS_UNKNOWN',
    });
  });

  it('waits for an actual terminal SDK purchase state before reporting cancellation', async () => {
    jest.useFakeTimers();
    const nativeBridge = {
      getAvailability: jest.fn().mockResolvedValue({ available: true }),
      getProducts: jest.fn().mockResolvedValue({
        products: [{
          productId: 'premium.month',
          type: 'SUBSCRIPTION',
          amountLabel: '299 â‚½',
          subscriptionInfo: { periods: [{ type: 'MainPeriod', duration: 'P1M' }] },
        }],
      }),
      purchase: jest.fn().mockResolvedValue({
        productId: 'premium.month',
        productType: 'SUBSCRIPTION',
        purchaseId: 'purchase-pending',
        status: 'CREATED',
      }),
      getPurchases: jest.fn()
        .mockResolvedValueOnce({ purchases: [{
          productId: 'premium.month',
          productType: 'SUBSCRIPTION',
          purchaseId: 'purchase-pending',
          status: 'INVOICE_CREATED',
        }] })
        .mockResolvedValueOnce({ purchases: [{
          productId: 'premium.month',
          productType: 'SUBSCRIPTION',
          purchaseId: 'purchase-pending',
          status: 'CANCELLED',
        }] }),
    };
    const { apiFetch, service } = loadService(nativeBridge);
    apiFetch.mockResolvedValueOnce(response({ identities: [{ provider: 'email' }] }));

    const result = service.requestRuStorePayment({ id: 42 } as never, 'premium_month');
    await jest.runAllTimersAsync();
    await expect(result).resolves.toEqual({ status: 'cancelled' });
    expect(nativeBridge.getPurchases).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('keeps checkout locked until RuStore returns a terminal state', async () => {
    jest.useFakeTimers();
    let status = 'PROCESSING';
    const pendingPurchase = {
      productId: 'premium.month',
      productType: 'SUBSCRIPTION',
      purchaseId: 'purchase-still-pending',
      status: 'PROCESSING',
    };
    const nativeBridge = {
      getAvailability: jest.fn().mockResolvedValue({ available: true }),
      getProducts: jest.fn().mockResolvedValue({
        products: [{
          productId: 'premium.month',
          type: 'SUBSCRIPTION',
          amountLabel: '299 ₽',
          subscriptionInfo: { periods: [{ type: 'MainPeriod', duration: 'P1M' }] },
        }],
      }),
      purchase: jest.fn().mockResolvedValue(pendingPurchase),
      getPurchases: jest.fn().mockImplementation(async () => ({
        purchases: [{ ...pendingPurchase, status }],
      })),
    };
    const { apiFetch, service } = loadService(nativeBridge);
    apiFetch.mockResolvedValueOnce(response({ identities: [{ provider: 'email' }] }));

    const result = service.requestRuStorePayment({ id: 42 } as never, 'premium_month');
    let settled = false;
    void result.finally(() => { settled = true; });
    await jest.advanceTimersByTimeAsync(8_000);
    expect(settled).toBe(false);
    expect(nativeBridge.purchase).toHaveBeenCalledTimes(1);
    status = 'CANCELLED';
    await jest.advanceTimersByTimeAsync(1_000);
    await expect(result).resolves.toEqual({ status: 'cancelled' });
    // One identity lookup plus repeated server validation while the provider
    // remains non-terminal. None of those client-side polls can grant Premium.
    expect(apiFetch.mock.calls.length).toBeGreaterThan(1);
    jest.useRealTimers();
  });

  it('refuses a subscription catalog entry that includes a trial period', async () => {
    const nativeBridge = {
      getAvailability: jest.fn().mockResolvedValue({ available: true }),
      getProducts: jest.fn().mockResolvedValue({
        products: [{
          productId: 'premium.month',
          type: 'SUBSCRIPTION',
          amountLabel: '0 ₽',
          subscriptionInfo: {
            periods: [
              { type: 'TrialPeriod', duration: 'P14D', currency: 'RUB', price: 0 },
              { type: 'MainPeriod', duration: 'P1M', currency: 'RUB', price: 29900 },
            ],
          },
        }],
      }),
      purchase: jest.fn(),
    };
    const { apiFetch, service } = loadService(nativeBridge);
    apiFetch.mockResolvedValueOnce(response({ identities: [{ provider: 'email' }] }));

    await expect(service.requestRuStorePayment({ id: 42 } as never, 'premium_month')).resolves.toEqual({
      status: 'unavailable',
      reason: 'RUSTORE_TRIAL_NOT_SUPPORTED',
    });
    expect(nativeBridge.purchase).not.toHaveBeenCalled();
  });

  it('refuses a subscription catalog entry that includes an undisclosed promo period', async () => {
    const nativeBridge = {
      getAvailability: jest.fn().mockResolvedValue({ available: true }),
      getProducts: jest.fn().mockResolvedValue({
        products: [{
          productId: 'premium.month',
          type: 'SUBSCRIPTION',
          amountLabel: '99 ₽',
          subscriptionInfo: {
            periods: [
              { type: 'PromoPeriod', duration: 'P7D', currency: 'RUB', price: 9900 },
              { type: 'MainPeriod', duration: 'P1M', currency: 'RUB', price: 29900 },
            ],
          },
        }],
      }),
      purchase: jest.fn(),
    };
    const { apiFetch, service } = loadService(nativeBridge);
    apiFetch.mockResolvedValueOnce(response({ identities: [{ provider: 'email' }] }));

    await expect(service.requestRuStorePayment({ id: 42 } as never, 'premium_month')).resolves.toEqual({
      status: 'unavailable',
      reason: 'RUSTORE_PROMO_NOT_SUPPORTED',
    });
    expect(nativeBridge.purchase).not.toHaveBeenCalled();
  });

  it('does not validate or grant a purchase whose result is not SUBSCRIPTION', async () => {
    const nativeBridge = {
      getAvailability: jest.fn().mockResolvedValue({ available: true }),
      getProducts: jest.fn().mockResolvedValue({
        products: [{
          productId: 'premium.month',
          type: 'SUBSCRIPTION',
          amountLabel: '299 ₽',
          subscriptionInfo: { periods: [{ type: 'MainPeriod', duration: 'P1M' }] },
        }],
      }),
      purchase: jest.fn().mockResolvedValue({
        productId: 'premium.month',
        productType: 'CONSUMABLE',
        purchaseId: 'purchase-1',
      }),
    };
    const { apiFetch, service } = loadService(nativeBridge);
    apiFetch.mockResolvedValueOnce(response({ identities: [{ provider: 'email' }] }));

    await expect(service.requestRuStorePayment({ id: 42 } as never, 'premium_month')).resolves.toEqual({
      status: 'failed',
      reason: 'RUSTORE_PURCHASE_PRODUCT_TYPE_INVALID',
    });
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it('returns the backend-authoritative entitlement snapshot after checkout validation', async () => {
    const nativeBridge = {
      getAvailability: jest.fn().mockResolvedValue({ available: true }),
      getProducts: jest.fn().mockResolvedValue({
        products: [{
          productId: 'premium.month',
          type: 'SUBSCRIPTION',
          amountLabel: '299 ₽',
          subscriptionInfo: { periods: [{ type: 'MainPeriod', duration: 'P1M' }] },
        }],
      }),
      purchase: jest.fn().mockResolvedValue({
        productId: 'premium.month',
        productType: 'SUBSCRIPTION',
        purchaseId: 'purchase-1',
      }),
    };
    const { apiFetch, service } = loadService(nativeBridge);
    const entitlement = {
      state: 'paid',
      isPremium: true,
      source: 'rustore',
      startsAt: '2026-08-13T00:00:00.000Z',
      endsAt: '2026-09-13T00:00:00.000Z',
      autoRenew: true,
      productId: 'premium.month',
      period: 'P1M',
    } as const;
    apiFetch
      .mockResolvedValueOnce(response({ identities: [{ provider: 'email' }] }))
      .mockResolvedValueOnce(response({ purchaseActive: true, entitlement }));

    await expect(service.requestRuStorePayment({ id: 42 } as never, 'premium_month')).resolves.toEqual({
      status: 'completed',
      entitlement,
    });
  });

  it('settles every restore validation and never grants before backend confirmation', async () => {
    const nativeBridge = {
      getPurchases: jest.fn().mockResolvedValue({
        purchases: [
          { productId: 'premium.month', productType: 'SUBSCRIPTION', purchaseId: 'purchase-1', status: 'ACTIVE' },
          { productId: 'premium.year', productType: 'SUBSCRIPTION', purchaseId: 'purchase-2', status: 'ACTIVE' },
          { productId: 'other.product', productType: 'CONSUMABLE', purchaseId: 'purchase-3' },
        ],
      }),
    };
    const { apiFetch, service } = loadService(nativeBridge);
    apiFetch
      .mockResolvedValueOnce(response({
        purchaseActive: true,
        entitlement: {
          state: 'paid',
          isPremium: true,
          source: 'rustore',
          startsAt: '2026-08-13T00:00:00.000Z',
          endsAt: '2026-09-13T00:00:00.000Z',
          autoRenew: true,
          productId: 'premium.month',
          period: 'P1M',
        },
      }))
      .mockRejectedValueOnce(new Error('network unavailable'));

    await expect(service.restoreRuStorePurchases()).resolves.toEqual([
      {
        status: 'completed',
        entitlement: {
          state: 'paid',
          isPremium: true,
          source: 'rustore',
          startsAt: '2026-08-13T00:00:00.000Z',
          endsAt: '2026-09-13T00:00:00.000Z',
          autoRenew: true,
          productId: 'premium.month',
          period: 'P1M',
        },
      },
      { status: 'pending', reason: 'RUSTORE_SERVER_VALIDATION_PENDING' },
    ]);
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  it('fails closed when backend omits the canonical entitlement snapshot', async () => {
    const nativeBridge = {
      getPurchases: jest.fn().mockResolvedValue({
        purchases: [{ productId: 'premium.month', productType: 'SUBSCRIPTION', purchaseId: 'purchase-1', status: 'ACTIVE' }],
      }),
    };
    const { apiFetch, service } = loadService(nativeBridge);
    apiFetch.mockResolvedValueOnce(response({ purchaseActive: true, entitlement: { isPremium: true } }));

    await expect(service.restoreRuStorePurchases()).resolves.toEqual([
      { status: 'failed', reason: 'RUSTORE_ENTITLEMENT_SNAPSHOT_INVALID' },
    ]);
  });

  it('server-validates PAUSED restores once and finishes without granting Premium', async () => {
    const nativeBridge = {
      getPurchases: jest.fn().mockResolvedValue({
        purchases: [{
          productId: 'premium.month',
          productType: 'SUBSCRIPTION',
          purchaseId: 'purchase-hold',
          status: 'PAUSED',
        }],
      }),
    };
    const { apiFetch, service } = loadService(nativeBridge);
    apiFetch.mockResolvedValueOnce(response({
      purchaseActive: false,
      entitlement: {
        state: 'expired',
        isPremium: false,
        source: 'rustore',
        startsAt: '2026-08-13T00:00:00.000Z',
        endsAt: '2026-09-13T00:00:00.000Z',
        autoRenew: true,
        productId: 'premium.month',
        period: 'P1M',
      },
    }));

    await expect(service.restoreRuStorePurchases()).resolves.toEqual([
      { status: 'failed', reason: 'RUSTORE_SUBSCRIPTION_PAUSED' },
    ]);
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it('returns an explicit restore failure when the native purchase query fails', async () => {
    const nativeBridge = {
      getPurchases: jest.fn().mockRejectedValue(new Error('RuStore unavailable')),
    };
    const { service } = loadService(nativeBridge);

    await expect(service.restoreRuStorePurchases()).resolves.toEqual([
      { status: 'failed', reason: 'RUSTORE_RESTORE_FAILED' },
    ]);
  });

  it('opens the RuStore subscription-management destination through the native bridge', async () => {
    const nativeBridge = {
      openSubscriptionManagement: jest.fn().mockResolvedValue({ opened: true }),
    };
    const { service } = loadService(nativeBridge);

    await expect(service.openRuStoreSubscriptionManagement()).resolves.toBe(true);
    expect(nativeBridge.openSubscriptionManagement).toHaveBeenCalledTimes(1);
  });

  it('passes subscription periods and the management deep link through the native plugin', () => {
    const native = fs.readFileSync(
      path.join(process.cwd(), 'android/app/src/rustore/java/ru/tvoygoroskop/app/rustore/RuStorePayPlugin.java'),
      'utf8',
    );
    expect(native).toContain('getSubscriptionInfo()');
    expect(native).toContain('MainPeriod');
    expect(native).toContain('RUSTORE_PROMO_NOT_SUPPORTED');
    expect(native).toContain('payload.put("status", "CANCELLED")');
    expect(native).toContain('openSubscriptionManagement');
    expect(native).toContain('rustore://profile/subscriptions');
  });
});
