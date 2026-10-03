import { createHash, timingSafeEqual } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';

const CONTEXT = 'nebo-openai-relay-v1';
const MAX_INPUT_CHARS = 4_096;

export const config = { api: { bodyParser: { sizeLimit: '32kb' }, responseLimit: false }, maxDuration: 120 };

function authorized(req: NextApiRequest, apiKey: string): boolean {
  const provided = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!provided) return false;
  const expected = createHash('sha256').update(`${CONTEXT}:${apiKey}`).digest('hex');
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Speech relay for the Russian server, same auth as /api/internal/openai-responses. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (process.env.OPENAI_RELAY_DIRECT !== '1') return res.status(404).json({ error: 'NOT_FOUND' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) return res.status(503).json({ error: 'OPENAI_API_KEY_MISSING' });
  if (!authorized(req, apiKey)) return res.status(401).json({ error: 'UNAUTHORIZED' });
  const body = (req.body || {}) as { input?: unknown };
  if (typeof body.input !== 'string' || !body.input.trim() || body.input.length > MAX_INPUT_CHARS) {
    return res.status(400).json({ error: 'INPUT_INVALID' });
  }
  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(110_000),
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    res.status(response.status);
    res.setHeader('content-type', response.headers.get('content-type') || 'application/octet-stream');
    return res.send(bytes);
  } catch (error) {
    console.error('[openai-speech-relay] request failed', error instanceof Error ? error.message : error);
    return res.status(502).json({ error: 'OPENAI_RELAY_FAILED' });
  }
}
