import { createHash, timingSafeEqual } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';

const CONTEXT = 'nebo-openai-relay-v1';

function relayToken(): string {
  const secret = String(process.env.APP_SESSION_SECRET || '').trim();
  if (!secret) throw new Error('APP_SESSION_SECRET_MISSING');
  return createHash('sha256').update(`${CONTEXT}:${secret}`).digest('hex');
}

function authorized(req: NextApiRequest): boolean {
  const raw = String(req.headers.authorization || '');
  const provided = raw.replace(/^Bearer\s+/i, '').trim();
  if (!provided) return false;
  const expected = relayToken();
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  try {
    if (!authorized(req)) return res.status(401).json({ error: 'UNAUTHORIZED' });

    const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
    if (!apiKey) return res.status(503).json({ error: 'OPENAI_API_KEY_MISSING' });

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(req.body || {}),
      signal: AbortSignal.timeout(120_000),
    });

    const text = await response.text();
    res.status(response.status);
    res.setHeader('content-type', response.headers.get('content-type') || 'application/json');
    return res.send(text);
  } catch (error) {
    console.error('[openai-relay] request failed', error instanceof Error ? error.message : error);
    return res.status(502).json({ error: 'OPENAI_RELAY_FAILED' });
  }
}
