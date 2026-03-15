import type { NextApiRequest, NextApiResponse } from 'next';

const log = {
  info: (msg: string, data?: any) => console.log(`[API/telegram/create-invoice] ${msg}`, data || ''),
  error: (msg: string, err?: any) => console.error(`[API/telegram/create-invoice] ERROR: ${msg}`, err || ''),
};

const PREMIUM_STARS = 250;
const PREMIUM_DAYS = 7;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req.body?.userId ?? req.query.userId) as string;
  if (!userId?.trim()) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const BOT_TOKEN = process.env.BOT_TOKEN;
  if (!BOT_TOKEN) {
    log.info('BOT_TOKEN not set, returning sim mode');
    return res.status(200).json({
      invoiceUrl: null,
      simMode: true,
      message: 'Use simulated payment flow (BOT_TOKEN not configured)',
    });
  }

  try {
    const payload = JSON.stringify({ userId: String(userId).trim(), type: 'premium_week' });
    if (payload.length > 128) {
      return res.status(400).json({ error: 'Payload too long' });
    }

    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'ASTROT Premium',
        description: `Full access for ${PREMIUM_DAYS} days`,
        payload,
        provider_token: '',
        currency: 'XTR',
        prices: [{ label: 'Premium 1 Week', amount: PREMIUM_STARS }],
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
    log.info('Invoice created', { userId, invoiceUrl: invoiceUrl?.substring(0, 50) + '...' });

    return res.status(200).json({
      invoiceUrl,
      simMode: false,
    });
  } catch (error: any) {
    log.error('Error creating invoice', { error: error.message });
    return res.status(500).json({
      error: 'Failed to create invoice',
      message: error.message,
    });
  }
}
