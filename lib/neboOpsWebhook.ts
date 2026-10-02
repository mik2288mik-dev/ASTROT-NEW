import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Telegram cannot reliably open connections to the Timeweb server, and Timeweb
 * cannot reach Telegram either (outgoing calls already go through the Railway
 * relay). Incoming owner-bot updates therefore follow the same path back:
 * Telegram → Railway (NEBO_OPS_WEBHOOK_FORWARD_URL set there) → Timeweb.
 */

const FORWARD_TIMEOUT_MS = 15_000;

function httpsOrigin(value: unknown): string | null {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}

/** Where Telegram should deliver owner-bot updates and fetch charts. */
export function neboOpsWebhookBase(env: NodeJS.ProcessEnv = process.env): string | null {
  const explicit = httpsOrigin(env.NEBO_OPS_WEBHOOK_BASE);
  if (explicit) return explicit;
  // A server that talks to Telegram through the relay is not reachable from it either.
  if (env.OPENAI_RELAY_DIRECT !== '1') {
    const relay = httpsOrigin(env.NEBO_TELEGRAM_RELAY_URL);
    if (relay) return relay;
  }
  return httpsOrigin(env.NEBO_OPS_PUBLIC_URL)
    || httpsOrigin(env.RAILWAY_PUBLIC_DOMAIN ? `https://${env.RAILWAY_PUBLIC_DOMAIN}` : '');
}

/** On the relay host: pass the update to the server that owns the bots. */
export async function forwardNeboOpsRequest(req: NextApiRequest, res: NextApiResponse): Promise<boolean> {
  const target = httpsOrigin(process.env.NEBO_OPS_WEBHOOK_FORWARD_URL);
  if (!target || process.env.NEBO_OPS_TELEGRAM_ENABLED === '1') return false;
  const path = String(req.url || '').split('#')[0];
  if (!/^\/api\/telegram\/(ops-webhook|owner-channel-webhook|ops-chart)(\?|$)/.test(path)) {
    res.status(404).end();
    return true;
  }
  try {
    const headers: Record<string, string> = {};
    const secret = req.headers['x-telegram-bot-api-secret-token'];
    if (typeof secret === 'string') headers['x-telegram-bot-api-secret-token'] = secret;
    if (req.method === 'POST') headers['content-type'] = 'application/json';
    const response = await fetch(`${target}${path}`, {
      method: req.method === 'POST' ? 'POST' : 'GET',
      headers,
      body: req.method === 'POST' ? JSON.stringify(req.body ?? {}) : undefined,
      signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
      redirect: 'error',
    });
    if (req.method === 'GET') {
      const type = response.headers.get('content-type');
      if (type) res.setHeader('Content-Type', type);
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.status(response.status).send(Buffer.from(await response.arrayBuffer()));
      return true;
    }
    // Telegram only needs an acknowledgement; the owner server answers the user itself.
    res.status(200).json({ ok: true, forwarded: response.status });
  } catch (error) {
    console.warn('[nebo-ops] webhook forward failed:', error instanceof Error ? error.name : 'UNKNOWN');
    // Ask Telegram to retry later rather than silently dropping the owner's command.
    res.status(502).json({ ok: false });
  }
  return true;
}

const seen = (globalThis as typeof globalThis & { __neboOpsSeenUpdates?: Map<string, number> });

/** Telegram re-sends an update it considers unanswered; handle each one once. */
export function isRepeatedTelegramUpdate(bot: string, updateId: unknown): boolean {
  if (typeof updateId !== 'number' || !Number.isSafeInteger(updateId)) return false;
  const map = (seen.__neboOpsSeenUpdates ??= new Map());
  const key = `${bot}:${updateId}`;
  if (map.has(key)) return true;
  map.set(key, Date.now());
  if (map.size > 500) {
    for (const [entry] of map) {
      map.delete(entry);
      if (map.size <= 400) break;
    }
  }
  return false;
}

/** Acknowledge Telegram immediately; slow reports continue in the background. */
export function acknowledgeAndRun(res: NextApiResponse, work: () => Promise<void>, label: string): void {
  res.status(200).json({ ok: true });
  void work().catch((error) => {
    console.warn(`[nebo-ops] ${label} failed:`, error instanceof Error ? error.message : 'UNKNOWN');
  });
}
