import type { NextApiRequest, NextApiResponse } from 'next';
import { answerTelegramCallbackQuery } from '../../../lib/telegramBot';
import { processTelegramSuccessfulPayment } from '../../../lib/starsPaymentService';
import { handleNotificationCallback } from '../../../services/notificationRetentionService';

const log = {
  info: (msg: string, data?: any) => console.log(`[API/telegram/webhook] ${msg}`, data || ''),
  warn: (msg: string, data?: any) => console.warn(`[API/telegram/webhook] WARN: ${msg}`, data || ''),
  error: (msg: string, err?: any) => console.error(`[API/telegram/webhook] ERROR: ${msg}`, err || ''),
};

/**
 * Verify webhook authenticity per Telegram Bot API:
 * https://core.telegram.org/bots/api#setwebhook
 * secret_token is sent in header "X-Telegram-Bot-Api-Secret-Token"
 * When BOT_TOKEN is set (production), WEBHOOK_SECRET_TOKEN must be set and match.
 */
function verifyWebhookSecret(req: NextApiRequest): boolean {
  const secret = process.env.WEBHOOK_SECRET_TOKEN;
  const header = req.headers['x-telegram-bot-api-secret-token'];
  if (process.env.BOT_TOKEN) {
    if (!secret) {
      log.error('WEBHOOK_SECRET_TOKEN required when BOT_TOKEN is set');
      return false;
    }
    return typeof header === 'string' && header === secret;
  }
  return true;
}

interface SuccessfulPayment {
  currency: string;
  total_amount: number;
  invoice_payload: string;
  telegram_payment_charge_id: string;
}

interface Message {
  message_id: number;
  from?: { id: number; first_name?: string; username?: string };
  chat?: { id: number };
  successful_payment?: SuccessfulPayment;
}

interface TelegramUpdate {
  update_id: number;
  message?: Message;
  pre_checkout_query?: unknown;
  callback_query?: {
    id: string;
    data?: string;
    from?: { id: number };
    message?: { chat?: { id: number }; message_id?: number };
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!verifyWebhookSecret(req)) {
    log.error('Webhook rejected: invalid or missing X-Telegram-Bot-Api-Secret-Token');
    return res.status(403).json({ error: 'Forbidden' });
  }

  const update = req.body as TelegramUpdate;
  if (!update) {
    return res.status(400).json({ error: 'Invalid update' });
  }

  if (update.pre_checkout_query) {
    log.info('Pre-checkout query received - approving');
    const BOT_TOKEN = process.env.BOT_TOKEN;
    if (BOT_TOKEN) {
      try {
        const preCheckoutId = (update.pre_checkout_query as { id: string }).id;
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pre_checkout_query_id: preCheckoutId, ok: true }),
        });
      } catch (e: any) {
        log.error('Failed to answer pre-checkout', { error: e.message });
      }
    }
    return res.status(200).json({ ok: true });
  }

  if (update.callback_query) {
    const callback = update.callback_query;
    const data = String(callback.data || '');
    if (data.startsWith('notif:') && callback.from?.id) {
      try {
        const result = await handleNotificationCallback({
          callbackQueryId: callback.id,
          userId: String(callback.from.id),
          data,
        });
        if (process.env.BOT_TOKEN) {
          await answerTelegramCallbackQuery(callback.id, result.message).catch(() => undefined);
        }
      } catch (error: any) {
        log.error('Failed to process notification callback', { error: error.message });
        if (process.env.BOT_TOKEN) {
          await answerTelegramCallbackQuery(callback.id, 'Не удалось обработать действие').catch(() => undefined);
        }
      }
      return res.status(200).json({ ok: true });
    }
    return res.status(200).json({ ok: true });
  }

  const message = update.message;
  const payment = message?.successful_payment;
  if (!payment) {
    return res.status(200).json({ ok: true });
  }

  let paymentPayload: { userId?: string; type?: string } | null = null;
  try {
    paymentPayload = JSON.parse(payment.invoice_payload);
  } catch {
    log.error('Invalid invoice payload', { payload: payment.invoice_payload });
    return res.status(200).json({ ok: true });
  }

  try {
    const result = await processTelegramSuccessfulPayment(payment);
    if (!result.ok) {
      log.warn('Telegram payment not processed', { reason: result.reason });
    }
  } catch (error: any) {
    log.error('Failed to process Telegram payment', {
      userId: paymentPayload?.userId,
      type: paymentPayload?.type,
      error: error.message,
    });
  }

  return res.status(200).json({ ok: true });
}
