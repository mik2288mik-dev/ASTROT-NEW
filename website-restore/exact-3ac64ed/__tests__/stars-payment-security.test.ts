import {
  buildInvoicePayload,
  getStarsAmountForInvoiceType,
  parseInvoicePayload,
} from '../lib/starsInvoiceCatalog';
import { PREMIUM_WEEK_STARS } from '../lib/premiumPricing';
import { processTelegramSuccessfulPayment } from '../lib/starsPaymentService';

function mockTelegramAuth() {
  jest.doMock('../lib/adminAuth', () => ({
    AdminAuthError: class AdminAuthError extends Error {
      status = 401;
      code = 'UNAUTHORIZED';
    },
    handleAdminError: jest.fn(),
  }));
  jest.doMock('../lib/auth/appAuth', () => ({
    requireTelegramPaymentUser: jest.fn(async () => ({ userId: '100' })),
  }));
}

describe('stars payment security', () => {
  describe('premium invoice catalog', () => {
    it('builds premium_week invoice with Stars amount', () => {
      const product = buildInvoicePayload({
        userId: '100',
        type: 'premium_week',
      });
      expect(product.starsAmount).toBe(PREMIUM_WEEK_STARS);
      expect(product.payload.a).toBe(PREMIUM_WEEK_STARS);
      expect(product.payload.t).toBe('premium_week');
      expect(JSON.stringify(product.payload).length).toBeLessThanOrEqual(128);
    });

    it('parses premium invoice payload round-trip', () => {
      const built = buildInvoicePayload({
        userId: '100',
        type: 'premium_week',
      });
      const parsed = parseInvoicePayload(JSON.stringify(built.payload));
      expect(parsed?.type).toBe('premium_week');
      expect(parsed?.starsAmount).toBe(getStarsAmountForInvoiceType('premium_week'));
      expect(parsed?.userId).toBe('100');
    });

    it('rejects legacy one-off invoice types in payload parser', () => {
      const parsed = parseInvoicePayload(JSON.stringify({
        u: '100',
        t: 'forecast_full_day',
        a: 80,
      }));
      expect(parsed).toBeNull();
    });
  });
});

describe('create-invoice removed invoice types', () => {
  it('returns 400 for removed pack invoice types', async () => {
    mockTelegramAuth();
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
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_INVOICE_TYPE' }));
  });

  it('returns 400 for removed one-off invoice types', async () => {
    mockTelegramAuth();
    const handler = (await import('../pages/api/telegram/create-invoice')).default;
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    await handler(
      {
        method: 'POST',
        body: { userId: '100', type: 'ask_lumia_one_off' },
        query: {},
      } as any,
      { status } as any
    );
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_INVOICE_TYPE' }));
  });
});

describe('processTelegramSuccessfulPayment', () => {
  it('rejects legacy content unlock invoice types', async () => {
    const result = await processTelegramSuccessfulPayment({
      currency: 'XTR',
      total_amount: 80,
      invoice_payload: JSON.stringify({ u: '100', t: 'forecast_full_day', a: 80 }),
      telegram_payment_charge_id: 'charge-legacy',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('INVALID_PAYLOAD');
  });
});
