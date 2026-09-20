import type { NextApiRequest, NextApiResponse } from 'next';
import { createHash, timingSafeEqual } from 'crypto';
import { telegramRelayAuthorized } from '../../../lib/telegramRelay';

const ALLOWED_METHODS = new Set([
  'answerCallbackQuery',
  'answerPreCheckoutQuery',
  'createInvoiceLink',
  'getMe',
  'getWebhookInfo',
  'refundStarPayment',
  'sendMessage',
  'sendPhoto',
  'setMyCommands',
  'setWebhook',
]);

function authorized(req: NextApiRequest): boolean {
  const provided = String(req.headers.authorization || '').replace(/^Bearer\s+/iu, '').trim();
  const expected = String(process.env.OPENAI_API_KEY || '').trim();
  if (!provided || !expected) return false;
  // Compare the fixed-length relay hash in constant time before accepting a request.
  const candidate = Buffer.from(provided);
  const reference = Buffer.from(createHash('sha256').update(`nebo-telegram-relay-v1:${expected}`).digest('hex'));
  return candidate.length === reference.length && timingSafeEqual(candidate, reference) && telegramRelayAuthorized(provided);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (process.env.OPENAI_RELAY_DIRECT !== '1') return res.status(404).json({ error: 'NOT_FOUND' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  if (!authorized(req)) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const token = String(req.body?.token || '').trim();
  const method = String(req.body?.method || '').trim();
  if (!/^\d{5,}:[A-Za-z0-9_-]{20,}$/u.test(token) || !ALLOWED_METHODS.has(method)) {
    return res.status(400).json({ error: 'INVALID_TELEGRAM_REQUEST' });
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req.body?.payload && typeof req.body.payload === 'object' ? req.body.payload : {}),
      signal: AbortSignal.timeout(20_000),
    });
    const text = await response.text();
    res.status(response.status);
    res.setHeader('content-type', response.headers.get('content-type') || 'application/json');
    return res.send(text);
  } catch (error) {
    console.error('[telegram-relay] request failed', error instanceof Error ? error.name : 'UNKNOWN');
    return res.status(502).json({ error: 'TELEGRAM_RELAY_FAILED' });
  }
}
