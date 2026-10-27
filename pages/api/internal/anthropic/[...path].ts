import { createHash, timingSafeEqual } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';

const ANTHROPIC_RELAY_CONTEXT = 'nebo-anthropic-relay-v1';

/** The token Timeweb sends; derived from the shared ANTHROPIC_API_KEY so no extra secret is needed. */
function anthropicRelayToken(apiKey: string): string {
  return createHash('sha256').update(`${ANTHROPIC_RELAY_CONTEXT}:${apiKey}`).digest('hex');
}

function authorized(req: NextApiRequest, apiKey: string): boolean {
  const provided = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(anthropicRelayToken(apiKey));
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Anthropic does not serve the Russian host, so on Timeweb the Anthropic SDK
 * points its base URL here and Railway forwards the call, like the OpenAI relay.
 * Only v1/messages (POST) and v1/models (GET, the free key check) pass through.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (process.env.OPENAI_RELAY_DIRECT !== '1') return res.status(404).json({ error: 'NOT_FOUND' });
  const path = ([] as string[]).concat(req.query.path || []).join('/');
  const allowed = (path === 'v1/messages' && req.method === 'POST') || (path === 'v1/models' && req.method === 'GET');
  if (!allowed) return res.status(404).json({ error: 'NOT_FOUND' });

  const apiKey = String(process.env.ANTHROPIC_API_KEY || '').trim();
  if (!apiKey) return res.status(503).json({ error: 'ANTHROPIC_API_KEY_MISSING' });
  if (!authorized(req, apiKey)) return res.status(401).json({ error: 'UNAUTHORIZED' });

  try {
    const response = await fetch(`https://api.anthropic.com/${path}`, {
      method: req.method,
      headers: { 'x-api-key': apiKey, 'anthropic-version': String(req.headers['anthropic-version'] || '2023-06-01'), 'content-type': 'application/json' },
      ...(req.method === 'POST' ? { body: JSON.stringify(req.body || {}) } : {}),
      signal: AbortSignal.timeout(req.method === 'POST' ? 120_000 : 15_000),
    });
    const text = await response.text();
    res.status(response.status);
    res.setHeader('content-type', response.headers.get('content-type') || 'application/json');
    return res.send(text);
  } catch (error) {
    console.error('[anthropic-relay] request failed', error instanceof Error ? error.message : error);
    return res.status(502).json({ error: 'ANTHROPIC_RELAY_FAILED' });
  }
}
