import type { NextApiRequest, NextApiResponse } from 'next';
import {
  buildInvoicePayloadForPlan,
  type StarsInvoiceType,
} from '../../../lib/starsInvoiceCatalog';
import { AdminAuthError, handleAdminError } from '../../../lib/adminAuth';
import { requireTelegramPaymentUser } from '../../../lib/auth/appAuth';
import { getManagedPremiumPlan } from '../../../lib/premiumPlanSettings';
import {
  getTelegramBotToken,
  getTelegramWebhookSecret,
  isTelegramWebhookEnabled,
} from '../../../lib/telegramWebhookMode';

const log = {
  info: (msg: string, data?: any) => console.log(`[API/telegram/create-invoice] ${msg}`, data || ''),
  error: (msg: string, err?: any) => console.error(`[API/telegram/create-invoice] ERROR: ${msg}`, err || ''),
};

const ALLOWED_TYPES = new Set<StarsInvoiceType>(['premium_week', 'premium_month', 'premium_quarter', 'premium_year']);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req.body?.userId ?? req.query.userId) as string;
  const type = (req.body?.type ?? req.query.type ?? 'premium_week') as string;

  if (!userId?.trim()) {
    return res.status(400).json({ error: 'userId is required' });
  }
  try {
    await requireTelegramPaymentUser(req, String(userId).trim());
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return handleAdminError(res, error);
    }
    throw error;
  }

  if (!ALLOWED_TYPES.has(type as StarsInvoiceType)) {
    return res.status(400).json({
      error: 'Invalid invoice type',
      code: 'INVALID_INVOICE_TYPE',
      message: `Unsupported invoice type: ${type}. Only Premium subscriptions are available.`,
    });
  }

  const botToken = getTelegramBotToken();
  const realPaymentsReady = !!botToken
    && isTelegramWebhookEnabled()
    && !!getTelegramWebhookSecret();
  if (!realPaymentsReady && (process.env.NODE_ENV === 'production' || !!botToken)) {
    return res.status(503).json({
      error: 'Telegram payments unavailable',
      code: 'TELEGRAM_PAYMENTS_UNAVAILABLE',
    });
  }

  let product;
  let plan;
  try {
    plan = await getManagedPremiumPlan(type as StarsInvoiceType);
    if (!plan) {
      return res.status(400).json({
        error: 'Inactive invoice type',
        code: 'INVOICE_TYPE_INACTIVE',
        message: `Invoice type is not active: ${type}.`,
      });
    }
    product = buildInvoicePayloadForPlan({
      userId: String(userId).trim(),
      type: type as StarsInvoiceType,
    }, plan);
  } catch (error: any) {
    const code = error?.message || 'INVOICE_BUILD_FAILED';
    log.error('Error building invoice payload', { error: error.message, type, userId });
    return res.status(500).json({
      error: 'Failed to create invoice',
      code: process.env.NODE_ENV === 'production' ? 'INVOICE_BUILD_FAILED' : code,
      ...(process.env.NODE_ENV === 'production' ? {} : { message: error.message }),
    });
  }

  const paymentNonce = product.payload.n != null ? String(product.payload.n) : null;
  const invoiceResponseBase = {
    invoiceType: type,
    type,
    starsAmount: product.starsAmount,
    plan,
    planDays: plan.days,
    paymentNonce,
    payload: product.payload,
  };

  if (!botToken) {
    log.info('BOT_TOKEN not set, returning sim mode');
    return res.status(200).json({
      ...invoiceResponseBase,
      invoiceUrl: null,
      invoiceLink: null,
      simMode: true,
      message: 'Use simulated payment flow (BOT_TOKEN not configured)',
    });
  }

  try {
    const payload = JSON.stringify(product.payload);
    if (payload.length > 128) {
      return res.status(400).json({ error: 'Payload too long', code: 'PAYLOAD_TOO_LONG' });
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/createInvoiceLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: product.title,
        description: product.description,
        payload,
        provider_token: '',
        currency: 'XTR',
        prices: [{ label: product.label, amount: product.starsAmount }],
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const data = await response.json();
    if (!data.ok) {
      log.error('Telegram API error', { description: data.description, error_code: data.error_code });
      return res.status(500).json({
        error: 'Failed to create invoice',
        ...(process.env.NODE_ENV === 'production'
          ? {}
          : { message: data.description || 'Telegram API error' }),
      });
    }

    const invoiceUrl = data.result;
    log.info('Invoice created', {
      userId,
      type,
      starsAmount: product.starsAmount,
      paymentNonce,
      invoiceUrl: invoiceUrl?.substring(0, 50) + '...',
    });

    return res.status(200).json({
      ...invoiceResponseBase,
      invoiceUrl,
      invoiceLink: invoiceUrl,
      simMode: false,
    });
  } catch (error: any) {
    log.error('Error creating invoice', { error: error.message, type, userId });
    return res.status(500).json({
      error: 'Failed to create invoice',
      ...(process.env.NODE_ENV === 'production' ? {} : { message: error.message }),
    });
  }
}
