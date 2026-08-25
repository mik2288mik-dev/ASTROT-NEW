import type { NextApiRequest, NextApiResponse } from 'next';

const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
const MAX_REQUESTS = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const TOPICS: Record<string, string> = {
  app: 'Работа приложения',
  account: 'Вход и аккаунт',
  payment: 'Оплата и Premium',
  privacy: 'Персональные данные',
  idea: 'Предложение',
  other: 'Другое',
};

type RateEntry = { count: number; resetAt: number };
const rateLimits = new Map<string, RateEntry>();

function clean(value: unknown, maxLength: number): string {
  return String(value || '').trim().slice(0, maxLength);
}

function getClientKey(req: NextApiRequest): string {
  const forwarded = clean(req.headers['x-forwarded-for'], 256).split(',')[0].trim();
  return forwarded || req.socket.remoteAddress || 'unknown';
}

function allowRequest(key: string): boolean {
  const now = Date.now();
  const current = rateLimits.get(key);
  if (!current || current.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (current.count >= MAX_REQUESTS) return false;
  current.count += 1;
  return true;
}

function isSameOrigin(req: NextApiRequest): boolean {
  const origin = clean(req.headers.origin, 512);
  const host = clean(req.headers['x-forwarded-host'] || req.headers.host, 512).toLowerCase();
  if (!origin || !host) return false;
  try {
    return new URL(origin).host.toLowerCase() === host;
  } catch {
    return false;
  }
}

function serverValue(name: string): string {
  const value = clean(process.env[name], 512);
  if (!value || value.includes('_REQUIRED') || /^replace-with/i.test(value)) {
    throw new Error('SUPPORT_DELIVERY_NOT_CONFIGURED');
  }
  return value;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  if (!isSameOrigin(req)) return res.status(403).json({ error: 'ORIGIN_DENIED' });

  const name = clean(req.body?.name, 80);
  const email = clean(req.body?.email, 254).toLowerCase();
  const topic = clean(req.body?.topic, 32);
  const message = clean(req.body?.message, 3000);
  const consent = req.body?.consent === true;
  const company = clean(req.body?.company, 120);

  if (company) return res.status(200).json({ ok: true });
  if (name.length < 2) return res.status(400).json({ error: 'INVALID_NAME' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'INVALID_EMAIL' });
  if (!TOPICS[topic]) return res.status(400).json({ error: 'INVALID_TOPIC' });
  if (message.length < 10) return res.status(400).json({ error: 'INVALID_MESSAGE' });
  if (!consent) return res.status(400).json({ error: 'CONSENT_REQUIRED' });
  if (!allowRequest(getClientKey(req))) return res.status(429).json({ error: 'TOO_MANY_REQUESTS' });

  try {
    const response = await fetch(RESEND_EMAILS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serverValue('RESEND_API_KEY')}`,
      },
      body: JSON.stringify({
        from: serverValue('SUPPORT_EMAIL_FROM'),
        to: [serverValue('SUPPORT_INBOX_EMAIL')],
        reply_to: email,
        subject: `[MEOU] ${TOPICS[topic]}`,
        text: [
          `Имя: ${name}`,
          `Email для ответа: ${email}`,
          `Тема: ${TOPICS[topic]}`,
          '',
          message,
        ].join('\n'),
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return res.status(502).json({ error: 'DELIVERY_FAILED' });
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(503).json({ error: 'DELIVERY_UNAVAILABLE' });
  }
}
