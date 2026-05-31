import { db } from './db';
import { parseInvoicePayload } from './starsInvoiceCatalog';
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

  if (parsed.type !== 'premium_week') {
    log.warn('Unsupported invoice type (legacy content purchases removed)', {
      type: parsed.type,
      userId: parsed.userId,
    });
    return { ok: false as const, reason: 'UNSUPPORTED_TYPE' };
  }

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
