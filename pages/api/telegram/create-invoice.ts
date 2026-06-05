import type { NextApiRequest, NextApiResponse } from 'next';
import {
  buildInvoicePayload,
  type StarsInvoiceType,
} from '../../../lib/starsInvoiceCatalog';
import { AdminAuthError, handleAdminError, requireTelegramUserId } from '../../../lib/adminAuth';

const log = {
  info: (msg: string, data?: any) => console.log(`[API/telegram/create-invoice] ${msg}`, data || ''),
  error: (msg: string, err?: any) => console.error(`[API/telegram/create-invoice] ERROR: ${msg}`, err || ''),
};

const ALLOWED_TYPES = new Set<StarsInvoiceType>(['premium_week']);

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
    requireTelegramUserId(req, String(userId).trim());
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return handleAdminError(res, error);
    }
    throw error;
  }

  if (type === 'lumi_pack') {
    return res.status(410).json({
      error: 'Lumi packs deprecated',
      code: 'LUMI_PACKS_DEPRECATED',
      message: 'Lumi packs are no longer available. Use Premium instead.',
    });
  }

  if (!ALLOWED_TYPES.has(type as StarsInvoiceType)) {
    return res.status(400).json({
      error: 'Invalid invoice type',
      code: 'INVALID_INVOICE_TYPE',
      message: `Unsupported invoice type: ${type}. Only Premium subscriptions are available.`,
    });
  }

  let product;
  try {
    product = buildInvoicePayload({
      userId: String(userId).trim(),
      type: type as StarsInvoiceType,
    });
  } catch (error: any) {
    const code = error?.message || 'INVOICE_BUILD_FAILED';
    log.error('Error building invoice payload', { error: error.message, type, userId });
    return res.status(500).json({
      error: 'Failed to create invoice',
      code,
      message: error.message,
    });
  }

  const paymentNonce = product.payload.n != null ? String(product.payload.n) : null;
  const invoiceResponseBase = {
    invoiceType: type,
    type,
    starsAmount: product.starsAmount,
    paymentNonce,
    payload: product.payload,
  };

  const BOT_TOKEN = process.env.BOT_TOKEN;
  if (!BOT_TOKEN) {
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

    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
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
    });

    const data = await response.json();
    if (!data.ok) {
      log.error('Telegram API error', { description: data.description, error_code: data.error_code });
      return res.status(500).json({
        error: 'Failed to create invoice',
        message: data.description || 'Telegram API error',
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
      message: error.message,
    });
  }
}
