import {
  buildInvoicePayload,
  getStarsAmountForInvoiceType,
  parseInvoicePayload,
} from '../lib/starsInvoiceCatalog';
import { FORECAST_FULL_DAY_STARS_COST } from '../lib/forecastFullDay';
import {
  canAccessForecastDaypart,
  hasExistingUnlock,
} from '../lib/contentAccessUserState';
import type { UserState } from '../lib/contentAccessMatrix';

function createResponse() {
  const res: any = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

function forecastPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: 21,
    telegram_payment_charge_id: 'charge-forecast-1',
    user_id: '100',
    stars_amount: FORECAST_FULL_DAY_STARS_COST,
    payment_type: 'content_unlock',
    content_surface: 'forecast',
    content_variant: 'full',
    chart_id: 7,
    cache_key: '2026-05-29',
    payload_json: { n: '1717000000100', t: 'forecast_full_day', k: '2026-05-29' },
    consumed_at: null,
    consumed_by_unlock_id: null,
    status: 'confirmed',
    created_at: '2026-05-29T12:00:00.000Z',
    ...overrides,
  };
}

describe('forecast full day Stars one-off flow', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  describe('create-invoice forecast_full_day', () => {
    it('returns paymentNonce, invoiceType, and forecast metadata', async () => {
      const originalToken = process.env.BOT_TOKEN;
      delete process.env.BOT_TOKEN;

      const handler = (await import('../pages/api/telegram/create-invoice')).default;
      const json = jest.fn();
      const status = jest.fn(() => ({ json }));
      await handler(
        {
          method: 'POST',
          body: { userId: '100', type: 'forecast_full_day', date: '2026-05-29', chartId: 7 },
          query: {},
        } as any,
        { status } as any
      );

      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({
        invoiceType: 'forecast_full_day',
        paymentNonce: expect.any(String),
        starsAmount: FORECAST_FULL_DAY_STARS_COST,
        contentSurface: 'forecast',
        contentVariant: 'full',
        cacheKey: '2026-05-29',
        simMode: true,
      }));

      const payload = json.mock.calls[0][0];
      expect(JSON.stringify(payload.payload).length).toBeLessThanOrEqual(128);

      process.env.BOT_TOKEN = originalToken;
    });
  });

  describe('webhook payload', () => {
    it('stores nonce in payload_json for forecast_full_day', async () => {
      const { recordContentUnlockPaymentFromWebhook } = await import('../lib/starsPaymentService');
      const { db } = await import('../lib/db');

      const recordSpy = jest.spyOn(db.star_payments, 'recordFromWebhook').mockResolvedValue({
        inserted: true,
        row: forecastPayment(),
      });
      jest.spyOn(db.content_unlocks, 'getLatestActive').mockResolvedValue(null);
      jest.spyOn(await import('../lib/contentArchitecture'), 'unlockContentLayer').mockResolvedValue({
        unlock: { id: 88 },
        via: 'stars',
      } as any);
      jest.spyOn(db.star_payments, 'markConsumed').mockResolvedValue(true);

      const built = buildInvoicePayload({
        userId: '100',
        type: 'forecast_full_day',
        date: '2026-05-29',
        chartId: 7,
      });
      const parsed = parseInvoicePayload(JSON.stringify(built.payload))!;

      await recordContentUnlockPaymentFromWebhook(
        {
          currency: 'XTR',
          total_amount: FORECAST_FULL_DAY_STARS_COST,
          invoice_payload: JSON.stringify(built.payload),
          telegram_payment_charge_id: 'charge-forecast-1',
        },
        parsed
      );

      expect(recordSpy).toHaveBeenCalledWith(expect.objectContaining({
        payloadJson: expect.objectContaining({ n: built.payload.n, k: '2026-05-29' }),
        contentSurface: 'forecast',
        contentVariant: 'full',
        cacheKey: '2026-05-29',
      }));
    });
  });

  describe('access bridge', () => {
    it('grants morning/day/evening access from one forecast/full unlock', () => {
      const user: UserState = {
        userId: '100',
        chartId: 7,
        isPremium: false,
        unlockedContent: [{
          surface: 'forecast',
          variant: 'full',
          accessTier: 'stars',
          cacheKey: '2026-05-29',
        }],
      };

      expect(hasExistingUnlock(user, 'forecast', 'full', '2026-05-29')).toBe(true);
      expect(canAccessForecastDaypart(user, 'morning', '2026-05-29')).toBe(true);
      expect(canAccessForecastDaypart(user, 'day', '2026-05-29')).toBe(true);
      expect(canAccessForecastDaypart(user, 'evening', '2026-05-29')).toBe(true);
    });
  });

  describe('forecast/daypart API stars tier', () => {
    function mockDaypartDeps(options?: {
      payment?: ReturnType<typeof forecastPayment> | null;
      isPremium?: boolean;
      withUnlock?: boolean;
    }) {
      jest.doMock('../lib/db', () => ({
        db: {
          users: {
            get: jest.fn().mockResolvedValue({
              id: '100',
              language: 'ru',
              is_premium: !!options?.isPremium,
            }),
          },
          natal_charts: {
            getPrimary: jest.fn().mockResolvedValue({ id: 7, chart_data: { sun: { sign: 'Aries' } } }),
            getById: jest.fn().mockResolvedValue({ id: 7, chart_data: { sun: { sign: 'Aries' } } }),
          },
          star_payments: {
            findConfirmedUnconsumedForPayload: jest.fn().mockImplementation(async (opts: {
              cacheKey?: string | null;
            }) => {
              const payment = options?.payment ?? null;
              if (!payment) return null;
              if (opts.cacheKey && payment.cache_key && payment.cache_key !== opts.cacheKey) {
                return null;
              }
              return payment;
            }),
          },
          content_unlocks: {
            listActive: jest.fn().mockResolvedValue([]),
            getLatestActive: jest.fn().mockResolvedValue(null),
            getById: jest.fn(),
          },
          content_interpretations: {
            upsertByChart: jest.fn().mockResolvedValue({
              content: {
                headline: 'Morning headline',
                summary: 'Summary',
                focus: 'Focus',
              },
            }),
            getByChart: jest.fn().mockResolvedValue(null),
          },
        },
      }));
      jest.doMock('../lib/contentArchitecture', () => ({
        getPremiumEntitlementState: jest.fn().mockResolvedValue({
          isPremium: !!options?.isPremium,
          entitlement: { isPremium: !!options?.isPremium },
        }),
        getContentLayer: jest.fn().mockResolvedValue({
          interpretation: null,
          source: 'missing',
          chartId: 7,
          cacheKey: '2026-05-29:morning',
        }),
        unlockContentLayer: jest.fn().mockResolvedValue({
          unlock: { id: 99 },
          via: 'stars',
        }),
      }));
      jest.doMock('../lib/contentAccessUserState', () => {
        const actual = jest.requireActual('../lib/contentAccessUserState');
        let unlocked = !!options?.withUnlock;
        return {
          ...actual,
          buildContentAccessUserState: jest.fn(async () => {
            const state = {
              userId: '100',
              chartId: 7,
              isPremium: !!options?.isPremium,
              unlockedContent: unlocked ? [{
                surface: 'forecast',
                variant: 'full',
                accessTier: 'stars',
                cacheKey: '2026-05-29',
              }] : [],
            };
            return state;
          }),
        };
      });
      jest.doMock('../lib/forecastContent', () => ({
        generatePremiumDaypartForecast: jest.fn().mockResolvedValue({
          headline: 'Morning headline',
          summary: 'Summary',
          focus: 'Focus',
        }),
      }));
      jest.doMock('../lib/appSettings', () => ({
        getOpenAIModelForContent: jest.fn().mockResolvedValue({ model: 'gpt-test', modelTier: 'test' }),
      }));
      jest.doMock('../lib/starsContentUnlock', () => {
        const actual = jest.requireActual('../lib/starsContentUnlock');
        return {
          ...actual,
          unlockContentAfterStarsPaymentNonce: jest.fn().mockImplementation(async () => {
            const { buildContentAccessUserState } = await import('../lib/contentAccessUserState');
            (buildContentAccessUserState as jest.Mock).mockImplementation(async () => ({
              userId: '100',
              chartId: 7,
              isPremium: false,
              unlockedContent: [{
                surface: 'forecast',
                variant: 'full',
                accessTier: 'stars',
                cacheKey: '2026-05-29',
              }],
            }));
            return {
              unlock: { id: 99 },
              chartId: 7,
              cacheKey: '2026-05-29',
              via: 'stars',
            };
          }),
          unlockContentAfterStarsPayment: jest.fn(),
        };
      });
    }

    async function callDaypart(body: Record<string, unknown>) {
      const { default: handler } = await import('../pages/api/content/forecast/daypart');
      const res = createResponse();
      await handler({
        method: 'POST',
        query: {},
        body: {
          userId: '100',
          chartId: 7,
          slot: 'morning',
          date: '2026-05-29',
          profile: { language: 'ru' },
          chartData: { sun: { sign: 'Aries' } },
          ...body,
        },
      } as any, res);
      return res;
    }

    it('returns STARS_PAYMENT_REQUIRED without paymentNonce', async () => {
      mockDaypartDeps();
      const res = await callDaypart({});
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        code: 'STARS_PAYMENT_REQUIRED',
        invoiceType: 'forecast_full_day',
        canCreateInvoice: true,
        starsCost: FORECAST_FULL_DAY_STARS_COST,
        cacheKey: '2026-05-29',
      }));
    });

    it('returns STARS_PAYMENT_PENDING for unknown paymentNonce', async () => {
      mockDaypartDeps({ payment: null });
      const res = await callDaypart({ paymentNonce: '1717000000100' });
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        code: 'STARS_PAYMENT_PENDING',
        retryAfterMs: 1200,
      }));
    });

    it('consumes confirmed payment and returns daypart reading', async () => {
      mockDaypartDeps({ payment: forecastPayment() });
      const res = await callDaypart({ paymentNonce: '1717000000100' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        accessTier: 'stars',
        starsPaymentRequired: false,
      }));
    });

    it('does not unlock payment with mismatched cacheKey', async () => {
      mockDaypartDeps({ payment: forecastPayment({ cache_key: '2026-05-28' }) });

      const res = await callDaypart({ paymentNonce: '1717000000100', date: '2026-05-29' });
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        code: 'STARS_PAYMENT_PENDING',
      }));
    });

    it('keeps premium flow unchanged', async () => {
      mockDaypartDeps({ isPremium: true });
      jest.doMock('../lib/contentArchitecture', () => ({
        getPremiumEntitlementState: jest.fn().mockResolvedValue({
          isPremium: true,
          entitlement: { isPremium: true },
        }),
        getContentLayer: jest.fn().mockResolvedValue({
          interpretation: {
            content: { headline: 'Premium morning', summary: 'Summary', focus: 'Focus' },
          },
          source: 'cache',
          chartId: 7,
          cacheKey: '2026-05-29:morning',
        }),
        unlockContentLayer: jest.fn(),
      }));

      const res = await callDaypart({});
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ accessTier: 'premium' }));
    });
  });

  describe('client helpers', () => {
    it('requestStarsOneOffPayment supports forecast_full_day', async () => {
      const globalAny = global as any;
      globalAny.window = { confirm: jest.fn().mockReturnValue(true) };

      (global.fetch as jest.Mock) = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            simMode: true,
            paymentNonce: '1717000000200',
            starsAmount: FORECAST_FULL_DAY_STARS_COST,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        });

      const { requestStarsOneOffPayment } = await import('../services/telegramService');
      const result = await requestStarsOneOffPayment({
        userId: '100',
        type: 'forecast_full_day',
        date: '2026-05-29',
        chartId: 7,
      });

      expect(result.status).toBe('paid');
      expect(result.paymentNonce).toBe('1717000000200');
    });

    it('getFullDaypartForecastWithStarsPayment retries STARS_PAYMENT_PENDING', async () => {
      let attempts = 0;
      global.fetch = jest.fn(async () => {
        attempts += 1;
        if (attempts < 3) {
          return {
            ok: false,
            status: 409,
            statusText: 'Conflict',
            json: async () => ({
              code: 'STARS_PAYMENT_PENDING',
              message: 'pending',
              retryAfterMs: 1,
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            interpretation: {
              content: {
                headline: 'Day headline',
                summary: 'Summary',
                focus: 'Focus',
              },
            },
          }),
        };
      }) as any;

      const { getFullDaypartForecastWithStarsPayment } = await import('../services/astrologyService');
      const result = await getFullDaypartForecastWithStarsPayment(
        { id: '100', language: 'ru' } as any,
        { sun: { sign: 'Aries' } } as any,
        'day',
        '1717000000200',
        { date: '2026-05-29' }
      );

      expect(result.reading.headline).toBe('Day headline');
      expect(attempts).toBe(3);
    });
  });

  describe('Horoscope wiring', () => {
    it('uses Premium-only gating for locked forecast layers', () => {
      const fs = require('fs');
      const path = require('path');
      const source = fs.readFileSync(path.join(__dirname, '../views/Horoscope.tsx'), 'utf8');
      expect(source).not.toContain('requestStarsOneOffPayment');
      expect(source).not.toContain('getFullDaypartForecastWithStarsPayment');
      expect(source).toContain('Открыть в Premium');
    });
  });

  describe('invoice catalog', () => {
    it('builds forecast_full_day payload with date cacheKey', () => {
      const built = buildInvoicePayload({
        userId: '100',
        type: 'forecast_full_day',
        date: '2026-05-29',
        chartId: 7,
      });
      expect(built.contentSurface).toBe('forecast');
      expect(built.contentVariant).toBe('full');
      expect(built.cacheKey).toBe('2026-05-29');
      expect(getStarsAmountForInvoiceType('forecast_full_day')).toBe(FORECAST_FULL_DAY_STARS_COST);
      const parsed = parseInvoicePayload(JSON.stringify(built.payload));
      expect(parsed?.nonce).toBe(String(built.payload.n));
    });
  });
});
