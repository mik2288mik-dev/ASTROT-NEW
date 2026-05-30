import {
  buildInvoicePayload,
  getStarsAmountForInvoiceType,
  parseInvoicePayload,
} from '../lib/starsInvoiceCatalog';
import { ASK_LUMIA_STARS_COST } from '../lib/questionContent';
import { verifyStarPaymentForUnlock, type StarPaymentRecord } from '../lib/starsPaymentVerify';
import { StarsPaymentError } from '../lib/starsContentUnlock';
import type { AskLumiaState } from '../types';

function createResponse() {
  const res: any = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

function askPayment(overrides: Partial<StarPaymentRecord> = {}) {
  return {
    id: 11,
    telegram_payment_charge_id: 'charge-ask-1',
    user_id: '100',
    stars_amount: ASK_LUMIA_STARS_COST,
    payment_type: 'content_unlock',
    content_surface: 'question',
    content_variant: 'one_off',
    chart_id: null,
    cache_key: null,
    payload_json: { n: '1717000000000', t: 'ask_lumia_one_off' },
    consumed_at: null,
    consumed_by_unlock_id: null,
    status: 'confirmed',
    created_at: '2026-05-29T12:00:00.000Z',
    ...overrides,
  };
}

describe('Ask Lumia Stars one-off flow', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  describe('create-invoice ask_lumia_one_off', () => {
    it('returns invoiceLink, paymentNonce, and starsAmount', async () => {
      const originalToken = process.env.BOT_TOKEN;
      delete process.env.BOT_TOKEN;

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

      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({
        invoiceType: 'ask_lumia_one_off',
        type: 'ask_lumia_one_off',
        starsAmount: ASK_LUMIA_STARS_COST,
        paymentNonce: expect.any(String),
        contentSurface: 'question',
        contentVariant: 'one_off',
        simMode: true,
      }));

      const payload = json.mock.calls[0][0];
      expect(JSON.stringify(payload.payload).length).toBeLessThanOrEqual(128);

      process.env.BOT_TOKEN = originalToken;
    });

    it('stores nonce in invoice payload round-trip', () => {
      const built = buildInvoicePayload({ userId: '100', type: 'ask_lumia_one_off' });
      const parsed = parseInvoicePayload(JSON.stringify(built.payload));
      expect(parsed?.nonce).toBe(String(built.payload.n));
    });
  });

  describe('webhook successful_payment payload', () => {
    it('stores nonce in payload_json via recordFromWebhook', async () => {
      const { recordContentUnlockPaymentFromWebhook } = await import('../lib/starsPaymentService');
      const { db } = await import('../lib/db');

      const recordSpy = jest.spyOn(db.star_payments, 'recordFromWebhook').mockResolvedValue({
        inserted: true,
        row: askPayment(),
      });
      jest.spyOn(db.content_unlocks, 'getLatestActive').mockResolvedValue(null);

      const built = buildInvoicePayload({ userId: '100', type: 'ask_lumia_one_off' });
      await recordContentUnlockPaymentFromWebhook(
        {
          currency: 'XTR',
          total_amount: ASK_LUMIA_STARS_COST,
          invoice_payload: JSON.stringify(built.payload),
          telegram_payment_charge_id: 'charge-ask-1',
        },
        parseInvoicePayload(JSON.stringify(built.payload))!
      );

      expect(recordSpy).toHaveBeenCalledWith(expect.objectContaining({
        payloadJson: expect.objectContaining({ n: built.payload.n }),
        contentSurface: 'question',
        contentVariant: 'one_off',
      }));
    });
  });

  describe('unlockContentAfterStarsPaymentNonce', () => {
    it('finds confirmed unconsumed payment by nonce and consumes unlock', async () => {
      const { db } = await import('../lib/db');
      const { unlockContentAfterStarsPaymentNonce } = await import('../lib/starsContentUnlock');
      const contentArchitecture = await import('../lib/contentArchitecture');
      jest.spyOn(db.star_payments, 'findConfirmedUnconsumedForPayload').mockResolvedValue(askPayment());
      jest.spyOn(db.content_unlocks, 'getLatestActive').mockResolvedValue(null);
      jest.spyOn(contentArchitecture, 'unlockContentLayer').mockResolvedValue({
        unlock: { id: 55, metadata: { starsAmount: ASK_LUMIA_STARS_COST } },
        chartId: null,
        cacheKey: 'q-hash',
        via: 'stars',
      } as any);
      jest.spyOn(db.star_payments, 'markConsumed').mockResolvedValue(true);

      const result = await unlockContentAfterStarsPaymentNonce({
        userId: '100',
        contentSurface: 'question',
        contentVariant: 'one_off',
        cacheKey: 'q-hash',
        starsAmount: ASK_LUMIA_STARS_COST,
        paymentNonce: '1717000000000',
        allowUnscopedCacheKey: true,
      });

      expect(result.unlock?.id).toBe(55);
      expect(contentArchitecture.unlockContentLayer).toHaveBeenCalledWith(expect.objectContaining({ paymentVerified: true }));
    });

    it('throws STARS_PAYMENT_PENDING when webhook payment is missing', async () => {
      const { db } = await import('../lib/db');
      const { unlockContentAfterStarsPaymentNonce } = await import('../lib/starsContentUnlock');

      jest.spyOn(db.star_payments, 'findConfirmedUnconsumedForPayload').mockResolvedValue(null);

      await expect(unlockContentAfterStarsPaymentNonce({
        userId: '100',
        contentSurface: 'question',
        contentVariant: 'one_off',
        cacheKey: 'q-hash',
        starsAmount: ASK_LUMIA_STARS_COST,
        paymentNonce: 'missing-nonce',
        allowUnscopedCacheKey: true,
      })).rejects.toMatchObject({ code: 'STARS_PAYMENT_PENDING' });
    });
  });

  describe('Ask API stars tier', () => {
    const baseState: AskLumiaState = {
      nextTier: 'stars',
      freeStarterAvailable: false,
      isPremium: false,
      starsCost: ASK_LUMIA_STARS_COST,
      starsPaymentRequired: true,
    };

    function mockAskDeps(options?: {
      payment?: ReturnType<typeof askPayment> | null;
      freeState?: AskLumiaState;
      chargeUnlockError?: StarsPaymentError;
    }) {
      jest.doMock('../lib/rateLimit', () => ({
        withRateLimit: (handler: any) => handler,
        RATE_LIMIT_CONFIGS: { FREE: {}, AI_FREE: {} },
      }));
      jest.doMock('../lib/questionContent', () => ({
        ASK_LUMIA_FREE_STARTER_CACHE_KEY: 'starter',
        ASK_LUMIA_STARS_COST,
        generateAskLumiaAnswer: jest.fn().mockResolvedValue('Deep stars answer'),
        getAskLumiaState: jest.fn().mockResolvedValue(options?.freeState || baseState),
        getQuestionCacheKey: jest.fn().mockReturnValue('q-hash'),
        getQuestionVariantForTier: jest.fn().mockReturnValue('one_off'),
        normalizeQuestion: jest.fn((value: string) => value.trim()),
        sanitizeQuestionHistory: jest.fn().mockReturnValue([]),
      }));
      jest.doMock('../lib/personalizationContext', () => ({
        buildPersonalizationContext: jest.fn().mockResolvedValue(null),
        describePersonalizationContext: jest.fn(),
      }));
      jest.doMock('../lib/appSettings', () => ({
        getOpenAIModelForContent: jest.fn().mockResolvedValue({ model: 'gpt-test', modelTier: 'test' }),
      }));
      jest.doMock('../lib/db', () => ({
        db: {
          users: {
            get: jest.fn().mockResolvedValue({ id: '100', language: 'ru' }),
          },
          natal_charts: {
            getPrimary: jest.fn().mockResolvedValue(null),
          },
          astro_questions: {
            findRecentDuplicate: jest.fn().mockResolvedValue(null),
            add: jest.fn().mockResolvedValue(undefined),
          },
          content_interpretations: {
            upsertByUser: jest.fn().mockResolvedValue({ id: 1 }),
          },
          star_payments: {
            findConfirmedUnconsumedForPayload: jest.fn().mockResolvedValue(options?.payment ?? null),
          },
          content_unlocks: {
            getLatestActive: jest.fn().mockResolvedValue(null),
            getById: jest.fn(),
          },
        },
      }));
      jest.doMock('../lib/contentArchitecture', () => ({
        unlockContentLayer: jest.fn().mockResolvedValue({
          unlock: { id: 77, metadata: { starsAmount: ASK_LUMIA_STARS_COST } },
          chartId: null,
          cacheKey: 'q-hash',
          via: 'stars',
        }),
      }));
      jest.doMock('../lib/starsContentUnlock', () => {
        const actual = jest.requireActual('../lib/starsContentUnlock');
        return {
          ...actual,
          unlockContentAfterStarsPaymentNonce: jest.fn().mockResolvedValue({
            unlock: { id: 77, metadata: { starsAmount: ASK_LUMIA_STARS_COST } },
            chartId: null,
            cacheKey: 'q-hash',
            via: 'stars',
          }),
          unlockContentAfterStarsPayment: options?.chargeUnlockError
            ? jest.fn().mockRejectedValue(options.chargeUnlockError)
            : jest.fn(),
        };
      });
    }

    async function callAsk(body: Record<string, unknown>) {
      const { default: handler } = await import('../pages/api/content/question/ask');
      const res = createResponse();
      await handler({ method: 'POST', query: {}, body: { userId: '100', message: 'Will I change jobs?', ...body } } as any, res);
      return res;
    }

    it('returns STARS_PAYMENT_REQUIRED without paymentNonce', async () => {
      mockAskDeps();
      const res = await callAsk({ requestedTier: 'stars' });
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        code: 'STARS_PAYMENT_REQUIRED',
        invoiceType: 'ask_lumia_one_off',
        canCreateInvoice: true,
        starsCost: ASK_LUMIA_STARS_COST,
      }));
    });

    it('returns STARS_PAYMENT_PENDING for unknown nonce', async () => {
      mockAskDeps({ payment: null });
      const res = await callAsk({ requestedTier: 'stars', paymentNonce: '1717000000000' });
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        code: 'STARS_PAYMENT_PENDING',
        retryAfterMs: 1200,
      }));
    });

    it('consumes confirmed payment and returns answer with paymentNonce', async () => {
      mockAskDeps({ payment: askPayment() });
      const res = await callAsk({ requestedTier: 'stars', paymentNonce: '1717000000000' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        answer: 'Deep stars answer',
        tier: 'stars',
      }));

      const { unlockContentAfterStarsPaymentNonce } = await import('../lib/starsContentUnlock');
      expect(unlockContentAfterStarsPaymentNonce).toHaveBeenCalled();
    });

    it('does not accept fake charge id without webhook record', async () => {
      mockAskDeps({ chargeUnlockError: new StarsPaymentError('STARS_PAYMENT_NOT_FOUND') });

      const res = await callAsk({
        requestedTier: 'stars',
        starsPaymentChargeId: 'fake-charge-id',
      });
      expect(res.status).toHaveBeenCalledWith(402);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        code: 'STARS_PAYMENT_NOT_FOUND',
      }));
    });

    it('does not create duplicate unlock when payment already consumed for same target', async () => {
      mockAskDeps({ payment: askPayment({ consumed_at: new Date().toISOString(), consumed_by_unlock_id: 88 }) });
      jest.doMock('../lib/starsContentUnlock', () => {
        const actual = jest.requireActual('../lib/starsContentUnlock');
        return {
          ...actual,
          unlockContentAfterStarsPaymentNonce: jest.fn().mockResolvedValue({
            unlock: { id: 88, metadata: { starsAmount: ASK_LUMIA_STARS_COST } },
            chartId: null,
            cacheKey: 'q-hash',
            via: 'stars',
          }),
          unlockContentAfterStarsPayment: jest.fn(),
        };
      });

      const res = await callAsk({ requestedTier: 'stars', paymentNonce: '1717000000000' });
      expect(res.status).toHaveBeenCalledWith(200);
      const { unlockContentAfterStarsPaymentNonce } = await import('../lib/starsContentUnlock');
      expect(unlockContentAfterStarsPaymentNonce).toHaveBeenCalledTimes(1);
    });

    it('keeps free flow unchanged', async () => {
      mockAskDeps({
        freeState: {
          nextTier: 'free',
          freeStarterAvailable: true,
          isPremium: false,
          starsCost: ASK_LUMIA_STARS_COST,
          starsPaymentRequired: false,
        },
      });
      jest.doMock('../lib/contentArchitecture', () => ({
        unlockContentLayer: jest.fn().mockResolvedValue({ unlock: { id: 1 }, via: 'free' }),
      }));

      const res = await callAsk({ requestedTier: 'free' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ tier: 'free' }));
    });

    it('keeps premium flow unchanged', async () => {
      mockAskDeps({
        freeState: {
          nextTier: 'premium',
          freeStarterAvailable: false,
          isPremium: true,
          starsCost: ASK_LUMIA_STARS_COST,
          starsPaymentRequired: false,
        },
      });
      jest.doMock('../lib/contentArchitecture', () => ({
        unlockContentLayer: jest.fn().mockResolvedValue({ unlock: { id: 2 }, via: 'premium' }),
      }));

      const res = await callAsk({ requestedTier: 'premium' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ tier: 'premium' }));
    });
  });

  describe('requestStarsOneOffPayment client helper', () => {
    it('calls create-invoice and returns paymentNonce', async () => {
      const globalAny = global as any;
      globalAny.window = { confirm: jest.fn().mockReturnValue(true) };

      (global.fetch as jest.Mock) = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            simMode: true,
            paymentNonce: '1717000000001',
            starsAmount: ASK_LUMIA_STARS_COST,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        });

      const { requestStarsOneOffPayment } = await import('../services/telegramService');
      const result = await requestStarsOneOffPayment({ userId: '100', type: 'ask_lumia_one_off' });

      expect(result.status).toBe('paid');
      expect(result.paymentNonce).toBe('1717000000001');
      expect(result.starsAmount).toBe(ASK_LUMIA_STARS_COST);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/telegram/create-invoice',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('askLumiaWithStarsPayment retry flow', () => {
    it('retries STARS_PAYMENT_PENDING before success', async () => {
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
            answer: 'Retried answer',
            createdAt: new Date().toISOString(),
            tier: 'stars',
          }),
        };
      }) as any;

      const { askLumiaWithStarsPayment } = await import('../services/astrologyService');
      const result = await askLumiaWithStarsPayment(
        [],
        'Question?',
        { id: '100', language: 'ru' } as any,
        '1717000000001',
        5
      );
      expect(result.answer).toBe('Retried answer');
      expect(attempts).toBe(3);
    });
  });

  describe('verifyStarPaymentForUnlock ask one-off', () => {
    it('accepts ask lumia payment without cache key when allowUnscopedCacheKey is true', () => {
      const result = verifyStarPaymentForUnlock(
        askPayment(),
        {
          userId: '100',
          telegramPaymentChargeId: 'charge-ask-1',
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

  describe('OracleChat premium-only wiring', () => {
    it('routes post-free users to Premium instead of Stars one-off', () => {
      const fs = require('fs');
      const path = require('path');
      const source = fs.readFileSync(path.join(__dirname, '../views/OracleChat.tsx'), 'utf8');
      expect(source).not.toContain('requestStarsOneOffPayment');
      expect(source).not.toContain('askLumiaWithStarsPayment');
      expect(source).toContain('state_need_premium');
      expect(source).toContain('onPremiumRequired');
    });
  });
});
