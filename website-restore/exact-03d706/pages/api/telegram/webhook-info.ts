import crypto from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getTelegramBotToken,
  isTelegramWebhookEnabled,
} from '../../../lib/telegramWebhookMode';

const log = {
  info: (msg: string, data?: any) => console.log(`[API/telegram/webhook-info] ${msg}`, data || ''),
  error: (msg: string, err?: any) => console.error(`[API/telegram/webhook-info] ERROR: ${msg}`, err || ''),
};

function verifySetupSecret(req: NextApiRequest): boolean {
  const secret = String(process.env.WEBHOOK_SETUP_SECRET || '');
  if (!secret) return false;
  const header = req.headers['x-webhook-setup-secret'];
  const candidate = Array.isArray(header) ? header[0] || '' : typeof header === 'string' ? header : '';
  const actual = Buffer.from(candidate);
  const expected = Buffer.from(secret);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isTelegramWebhookEnabled()) {
    return res.status(503).json({ error: 'TELEGRAM_WEBHOOK_DISABLED' });
  }

  if (!verifySetupSecret(req)) {
    log.error('Request rejected: invalid or missing WEBHOOK_SETUP_SECRET');
    return res.status(403).json({ error: 'Forbidden' });
  }

  const botToken = getTelegramBotToken();
  if (!botToken) {
    return res.status(500).json({ error: 'BOT_TOKEN not configured' });
  }

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`, {
      signal: AbortSignal.timeout(10_000),
    });
    const data = await tgRes.json();

    log.info('getWebhookInfo called', { ok: data.ok });

    return res.status(200).json({
      telegram: data,
      webhookUrl: data.result?.url || null,
      hasWebhook: !!data.result?.url,
    });
  } catch (error: any) {
    log.error('getWebhookInfo failed', { error: error.message });
    return res.status(500).json({
      error: 'Failed to call Telegram API',
      ...(process.env.NODE_ENV === 'production' ? {} : { message: error.message }),
    });
  }
}
