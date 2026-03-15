import type { NextApiRequest, NextApiResponse } from 'next';

const log = {
  info: (msg: string, data?: any) => console.log(`[API/telegram/setup-webhook] ${msg}`, data || ''),
  error: (msg: string, err?: any) => console.error(`[API/telegram/setup-webhook] ERROR: ${msg}`, err || ''),
};

const WEBHOOK_PATH = '/api/telegram/webhook';

function verifySetupSecret(req: NextApiRequest): boolean {
  const secret = process.env.WEBHOOK_SETUP_SECRET;
  if (!secret) return false;
  const header = req.headers['x-webhook-setup-secret'];
  const querySecret = req.query.secret as string;
  return (typeof header === 'string' && header === secret) || (typeof querySecret === 'string' && querySecret === secret);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!verifySetupSecret(req)) {
    log.error('Setup rejected: invalid or missing WEBHOOK_SETUP_SECRET');
    return res.status(403).json({ error: 'Forbidden' });
  }

  const botToken = process.env.BOT_TOKEN;
  const secretToken = process.env.WEBHOOK_SECRET_TOKEN;
  const baseUrl = process.env.WEBHOOK_BASE_URL || 'https://astrot-production.up.railway.app';
  const webhookUrl = `${baseUrl.replace(/\/$/, '')}${WEBHOOK_PATH}`;

  if (!botToken) {
    return res.status(500).json({ error: 'BOT_TOKEN not configured' });
  }
  if (!secretToken) {
    return res.status(500).json({ error: 'WEBHOOK_SECRET_TOKEN not configured' });
  }

  try {
    const body: { url: string; secret_token?: string } = { url: webhookUrl };
    if (secretToken) body.secret_token = secretToken;

    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await tgRes.json();

    log.info('setWebhook called', { ok: data.ok, url: webhookUrl });

    return res.status(200).json({
      telegram: data,
      webhookUrl,
      registered: data.ok === true,
    });
  } catch (error: any) {
    log.error('setWebhook failed', { error: error.message });
    return res.status(500).json({
      error: 'Failed to call Telegram API',
      message: error.message,
    });
  }
}
