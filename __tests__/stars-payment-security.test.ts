import {
  buildInvoicePayload,
  getStarsAmountForInvoiceType,
  parseInvoicePayload,
} from '../lib/starsInvoiceCatalog';
import { verifyStarPaymentForUnlock, type StarPaymentRecord } from '../lib/starsPaymentVerify';
import { canAccessContent, type UserState } from '../lib/contentAccessMatrix';
import { FORECAST_FULL_DAY_STARS_COST } from '../lib/forecastFullDay';

function payment(overrides: Partial<StarPaymentRecord> = {}): StarPaymentRecord {
  return {
    id: 1,
    telegram_payment_charge_id: 'charge-1',
    user_id: '100',
    stars_amount: FORECAST_FULL_DAY_STARS_COST,
    payment_type: 'content_unlock',
    content_surface: 'forecast',
    content_variant: 'full',
    chart_id: 7,
    cache_key: '2026-05-29',
    payload_json: {},
    consumed_at: null,
    consumed_by_unlock_id: null,
    status: 'confirmed',
    ...overrides,
  };
}

function dbStarPaymentRow(overrides: Partial<ReturnType<typeof payment>> & { created_at?: string } = {}) {
  const { created_at, ...paymentFields } = overrides;
  return {
    ...payment(paymentFields),
    created_at: created_at ?? '2026-05-29T12:00:00.000Z',
  };
}

describe('stars payment security', () => {
  describe('verifyStarPaymentForUnlock', () => {
    const baseOptions = {
      userId: '100',
      telegramPaymentChargeId: 'charge-1',
      starsAmount: FORECAST_FULL_DAY_STARS_COST,
      contentSurface: 'forecast' as const,
      contentVariant: 'full' as const,
      chartId: 7,
      cacheKey: '2026-05-29',
    };

    it('rejects fake charge id when payment is missing', () => {
      const result = verifyStarPaymentForUnlock(null, baseOptions);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('STARS_PAYMENT_NOT_FOUND');
    });

    it('rejects payment for another user', () => {
      const result = verifyStarPaymentForUnlock(payment({ user_id: '999' }), baseOptions);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('STARS_PAYMENT_USER_MISMATCH');
    });

    it('rejects wrong stars amount', () => {
      const result = verifyStarPaymentForUnlock(payment({ stars_amount: 1 }), baseOptions);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('STARS_PAYMENT_AMOUNT_MISMATCH');
    });

    it('rejects already consumed payment without unlock id', () => {
      const result = verifyStarPaymentForUnlock(
        payment({ consumed_at: new Date().toISOString(), consumed_by_unlock_id: null }),
        baseOptions
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('STARS_PAYMENT_ALREADY_CONSUMED');
    });

    it('accepts confirmed unconsumed payment', () => {
      const result = verifyStarPaymentForUnlock(payment(), baseOptions);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.alreadyConsumed).toBe(false);
    });

    it('accepts ask lumia payment without cache key when allowUnscopedCacheKey is true', () => {
      const result = verifyStarPaymentForUnlock(
        payment({
          content_surface: 'question',
          content_variant: 'one_off',
          cache_key: null,
          stars_amount: getStarsAmountForInvoiceType('ask_lumia_one_off'),
        }),
        {
          userId: '100',
          telegramPaymentChargeId: 'charge-1',
          starsAmount: getStarsAmountForInvoiceType('ask_lumia_one_off'),
          contentSurface: 'question',
          contentVariant: 'one_off',
          cacheKey: 'question-hash',
          allowUnscopedCacheKey: true,
        }
      );
      expect(result.ok).toBe(true);
    });
  });

  describe('legacy lumi unlock access', () => {
    it('still maps legacy lumi unlock as stars access', () => {
      const user: UserState = {
        userId: 'user-1',
        chartId: 1,
        isPremium: false,
        unlockedContent: [{ surface: 'forecast', variant: 'full', accessTier: 'lumi', cacheKey: '2026-05-29' }],
      };
      expect(canAccessContent(user, 'forecast', 'morning', '2026-05-29')).toBe(true);
    });
  });

  describe('create-invoice catalog', () => {
    it('builds forecast_full_day invoice with Stars amount', () => {
      const product = buildInvoicePayload({
        userId: '100',
        type: 'forecast_full_day',
        chartId: 7,
        date: '2026-05-29',
      });
      expect(product.starsAmount).toBe(FORECAST_FULL_DAY_STARS_COST);
      expect(product.payload.a).toBe(FORECAST_FULL_DAY_STARS_COST);
      expect(product.payload.t).toBe('forecast_full_day');
      expect(product.cacheKey).toBe('2026-05-29');
      expect(JSON.stringify(product.payload).length).toBeLessThanOrEqual(128);
    });

    it('parses invoice payload round-trip', () => {
      const built = buildInvoicePayload({
        userId: '100',
        type: 'ask_lumia_one_off',
      });
      const parsed = parseInvoicePayload(JSON.stringify(built.payload));
      expect(parsed?.type).toBe('ask_lumia_one_off');
      expect(parsed?.starsAmount).toBe(getStarsAmountForInvoiceType('ask_lumia_one_off'));
      expect(parsed?.contentSurface).toBe('question');
      expect(parsed?.contentVariant).toBe('one_off');
    });
  });
});

describe('create-invoice lumi_pack deprecation', () => {
  it('returns 410 for lumi_pack type', async () => {
    const handler = (await import('../pages/api/telegram/create-invoice')).default;
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    await handler(
      {
        method: 'POST',
        body: { userId: '100', type: 'lumi_pack', packId: 'starter' },
        query: {},
      } as any,
      { status } as any
    );
    expect(status).toHaveBeenCalledWith(410);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: 'LUMI_PACKS_DEPRECATED' }));
  });
});

describe('webhook duplicate successful_payment', () => {
  it('uses recordFromWebhook idempotency without requiring a second insert', async () => {
    const { db } = await import('../lib/db');
    const recordSpy = jest.spyOn(db.star_payments, 'recordFromWebhook');
    const getUnlockSpy = jest.spyOn(db.content_unlocks, 'getLatestActive');
    const unlockSpy = jest.spyOn(await import('../lib/contentArchitecture'), 'unlockContentLayer');

    const existingPayment = dbStarPaymentRow({ id: 42, telegram_payment_charge_id: 'charge-dup' });
    recordSpy.mockResolvedValue({ inserted: false, row: existingPayment });
    getUnlockSpy.mockResolvedValue({
      id: 99,
      userId: '100',
      chartId: 7,
      accessTier: 'stars',
      contentSurface: 'forecast',
      contentVariant: 'full',
      unlockType: 'stars',
      cacheKey: '2026-05-29',
      lumiSpent: 0,
      metadata: {},
      unlockedAt: new Date().toISOString(),
      expiresAt: null,
      revokedAt: null,
    } as any);
    unlockSpy.mockResolvedValue({
      unlock: { id: 99 },
      chartId: 7,
      cacheKey: '2026-05-29',
      via: 'stars',
    } as any);
    jest.spyOn(db.star_payments, 'markConsumed').mockResolvedValue(true);

    const { recordContentUnlockPaymentFromWebhook } = await import('../lib/starsPaymentService');
    const parsed = parseInvoicePayload(JSON.stringify({
      u: '100',
      t: 'forecast_full_day',
      s: 'forecast',
      v: 'full',
      k: '2026-05-29',
      a: FORECAST_FULL_DAY_STARS_COST,
    }))!;

    await recordContentUnlockPaymentFromWebhook(
      {
        currency: 'XTR',
        total_amount: FORECAST_FULL_DAY_STARS_COST,
        invoice_payload: JSON.stringify(parsed.raw),
        telegram_payment_charge_id: 'charge-dup',
      },
      parsed
    );

    expect(recordSpy).toHaveBeenCalledTimes(1);
    expect(unlockSpy).not.toHaveBeenCalled();

    recordSpy.mockRestore();
    getUnlockSpy.mockRestore();
    unlockSpy.mockRestore();
  });
});

describe('deprecated client payment recording', () => {
  it('forbids recordStarsPaymentIfNew', async () => {
    const { recordStarsPaymentIfNew, StarsPaymentError } = await import('../lib/starsContentUnlock');
    await expect(recordStarsPaymentIfNew()).rejects.toBeInstanceOf(StarsPaymentError);
  });
});
