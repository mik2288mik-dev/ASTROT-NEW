import type { ContentSurface, ContentVariant } from '../types';
import { db } from './db';
import { unlockContentLayer } from './contentArchitecture';
import {
  isContentUnlockInvoiceType,
  parseInvoicePayload,
  type ParsedStarsInvoicePayload,
} from './starsInvoiceCatalog';
import { activatePremium } from '../services/premiumService';

const log = {
  info: (message: string, data?: Record<string, unknown>) => {
    console.log(`[StarsPaymentService] ${message}`, data || '');
  },
  warn: (message: string, data?: Record<string, unknown>) => {
    console.warn(`[StarsPaymentService] WARN: ${message}`, data || '');
  },
  error: (message: string, data?: Record<string, unknown>) => {
    console.error(`[StarsPaymentService] ERROR: ${message}`, data || '');
  },
};

export type TelegramSuccessfulPayment = {
  currency: string;
  total_amount: number;
  invoice_payload: string;
  telegram_payment_charge_id: string;
};

async function findExistingUnlockForPayment(
  userId: string,
  contentSurface: ContentSurface,
  contentVariant: ContentVariant,
  chartId: number | null,
  cacheKey: string | null
) {
  if (!cacheKey) return null;
  return db.content_unlocks.getLatestActive(userId, {
    accessTier: 'stars',
    contentSurface,
    contentVariant,
    chartId,
    cacheKey,
  });
}

async function ensureContentUnlockFromPayment(
  paymentRow: NonNullable<Awaited<ReturnType<typeof db.star_payments.getByChargeId>>>,
  parsed: ParsedStarsInvoicePayload
) {
  if (!parsed.contentSurface || !parsed.contentVariant) return null;
  if (!parsed.cacheKey) return null;

  const existingUnlock = await findExistingUnlockForPayment(
    parsed.userId,
    parsed.contentSurface,
    parsed.contentVariant,
    parsed.chartId,
    parsed.cacheKey
  );

  if (existingUnlock) {
    if (!paymentRow.consumed_at) {
      await db.star_payments.markConsumed(paymentRow.id, existingUnlock.id);
    }
    return existingUnlock;
  }

  const unlockResult = await unlockContentLayer({
    userId: parsed.userId,
    chartId: parsed.chartId,
    accessTier: 'stars',
    contentSurface: parsed.contentSurface,
    contentVariant: parsed.contentVariant,
    cacheKey: parsed.cacheKey,
    starsAmount: parsed.starsAmount,
    starsPaymentChargeId: paymentRow.telegram_payment_charge_id,
    paymentVerified: true,
  });

  if (unlockResult.unlock?.id && !paymentRow.consumed_at) {
    await db.star_payments.markConsumed(paymentRow.id, unlockResult.unlock.id);
  }

  return unlockResult.unlock;
}

export async function recordContentUnlockPaymentFromWebhook(
  payment: TelegramSuccessfulPayment,
  parsed: ParsedStarsInvoicePayload
) {
  const recordResult = await db.star_payments.recordFromWebhook({
    telegramPaymentChargeId: payment.telegram_payment_charge_id,
    userId: parsed.userId,
    starsAmount: payment.total_amount,
    paymentType: 'content_unlock',
    contentSurface: parsed.contentSurface,
    contentVariant: parsed.contentVariant,
    chartId: parsed.chartId,
    cacheKey: parsed.cacheKey,
    payloadJson: parsed.raw,
    status: 'confirmed',
  });

  const row = recordResult.row;
  if (!row) {
    throw new Error('STARS_PAYMENT_RECORD_FAILED');
  }

  if (parsed.cacheKey && parsed.contentSurface && parsed.contentVariant) {
    await ensureContentUnlockFromPayment(row, parsed);
  }

  return {
    inserted: recordResult.inserted,
    row,
  };
}

export async function processTelegramSuccessfulPayment(payment: TelegramSuccessfulPayment) {
  if (payment.currency !== 'XTR') {
    log.warn('Rejected payment with invalid currency', { currency: payment.currency });
    return { ok: false as const, reason: 'INVALID_CURRENCY' };
  }

  const parsed = parseInvoicePayload(payment.invoice_payload);
  if (!parsed) {
    log.error('Invalid invoice payload', { payload: payment.invoice_payload });
    return { ok: false as const, reason: 'INVALID_PAYLOAD' };
  }

  if (parsed.starsAmount !== payment.total_amount) {
    log.warn('Payment amount mismatch', {
      userId: parsed.userId,
      type: parsed.type,
      expected: parsed.starsAmount,
      actual: payment.total_amount,
    });
    return { ok: false as const, reason: 'AMOUNT_MISMATCH' };
  }

  if (parsed.type === 'premium_week') {
    const result = await activatePremium(
      parsed.userId,
      payment.telegram_payment_charge_id,
      payment.total_amount,
      {
        paymentType: 'premium_week',
        payloadJson: parsed.raw,
      }
    );
    log.info('Premium payment processed', { userId: parsed.userId, activated: result.activated });
    return { ok: true as const, type: parsed.type, activated: result.activated };
  }

  if (!isContentUnlockInvoiceType(parsed.type)) {
    log.warn('Unsupported invoice type', { type: parsed.type, userId: parsed.userId });
    return { ok: false as const, reason: 'UNSUPPORTED_TYPE' };
  }

  const record = await recordContentUnlockPaymentFromWebhook(payment, parsed);
  log.info('Content unlock payment recorded', {
    userId: parsed.userId,
    type: parsed.type,
    inserted: record.inserted,
    cacheKey: parsed.cacheKey,
  });

  return {
    ok: true as const,
    type: parsed.type,
    inserted: record.inserted,
    paymentId: record.row.id,
  };
}
