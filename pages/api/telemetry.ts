import type { NextApiRequest, NextApiResponse } from 'next';
import { APP_TRACE_VERSION, sanitizeTraceEvent } from '../../lib/appTelemetry';
import { recordAppTrace } from '../../lib/appTelemetryRepository';
import { requireAppUser } from '../../lib/auth/appAuth';
import { consumeAuthRateLimit, getAuthClientKey } from '../../lib/auth/authRateLimit';
import { readClientRuntimeMetadata } from '../../lib/clientRuntimeMetadata';
export const config = { api: { bodyParser: { sizeLimit: '128kb' } } };
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  if (req.body?.version !== APP_TRACE_VERSION || !Array.isArray(req.body.events) || req.body.events.length > 100)
    return res.status(400).json({ error: 'INVALID_TRACE' });
  try {
    let userId: string | null = null;
    let runtime:'native' | 'telegram' | 'web'='web';
    try { const user=await requireAppUser(req, { allowGuest: true });userId=user.userId;
      runtime=user.provider==='native' ? 'native' : user.provider==='telegram' ? 'telegram' : 'web'; }
    catch (error: any) { if (error?.code !== 'APP_AUTH_REQUIRED') throw error; }
    const token = typeof req.body.token === 'string' ? req.body.token : null;
    await consumeAuthRateLimit({ scope: 'product-telemetry', key: token?.slice(0, 36) || getAuthClientKey(req),
      maxAttempts: token ? 240 : 120, windowMs: 5 * 60_000 });
    const events = req.body.events.map((e: unknown) => sanitizeTraceEvent(e)).filter(Boolean);
    // Question contents are never accepted before authentication.
    if (!userId) for (const e of events) delete e.payload.text;
    const nextToken = await recordAppTrace({ token, userId, events,
      metadata: { ...readClientRuntimeMetadata(req.headers || {}, runtime), trace_version: APP_TRACE_VERSION } });
    return res.status(200).json({ token: nextToken });
  } catch (error: any) { return res.status(error?.status || 500).json({ error: error?.code || 'TRACE_FAILED' }); }
}
