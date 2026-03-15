import type { NextApiRequest, NextApiResponse } from 'next';

const log = {
  info: (msg: string, data?: any) => console.log(`[API/telegram/webhook-info] ${msg}`, data || ''),
  error: (msg: string, err?: any) => console.error(`[API/telegram/webhook-info] ERROR: ${msg}`, err || ''),
};

function verifySetupSecret(req: NextApiRequest): boolean {
  const secret = process.env.WEBHOOK_SETUP_SECRET;
  if (!secret) return false;
  const header = req.headers['x-webhook-setup-secret'];
  const querySecret = req.query.secret as string;
  return (typeof header === 'string' && header === secret) || (typeof querySecret === 'string' && querySecret === secret);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!verifySetupSecret(req)) {
    log.error('Request rejected: invalid or missing WEBHOOK_SETUP_SECRET');
    return res.status(403).json({ error: 'Forbidden' });
  }

  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    return res.status(500).json({ error: 'BOT_TOKEN not configured' });
  }

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
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
      message: error.message,
    });
  }
}
