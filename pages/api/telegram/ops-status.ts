import { createHash, timingSafeEqual } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getPool } from '../../../lib/db';
import {
  getNeboOpsConfig,
  getNeboOpsWorkerStatus,
  getNeboOwnerChannelConfig,
  isNeboOpsEnabled,
  neboServerLabel,
} from '../../../lib/neboOps';
import { getSchedulerStatus } from '../../../lib/notificationScheduler';
import { getNeboOpsPreferences } from '../../../lib/neboOpsSettings';
import { telegramApiRequest, telegramRelayAuthorized, useTelegramRelay } from '../../../lib/telegramRelay';

/**
 * Read-only health of owner bots and notification delivery for the operator.
 * Authorized with a hash of the ops webhook secret (or the relay credential);
 * the response contains counts and error codes only — never tokens or user data.
 */
function statusAuthorized(req: NextApiRequest): boolean {
  const supplied = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!/^[0-9a-f]{64}$/.test(supplied)) return false;
  const secret = String(process.env.NEBO_OPS_WEBHOOK_SECRET || '').trim();
  if (secret.length >= 32) {
    const expected = Buffer.from(createHash('sha256').update(`nebo-ops-status-v1:${secret}`).digest('hex'));
    const candidate = Buffer.from(supplied);
    if (expected.length === candidate.length && timingSafeEqual(expected, candidate)) return true;
  }
  return telegramRelayAuthorized(supplied);
}

async function telegramReachable(token: string | undefined): Promise<string> {
  if (!token) return 'not_configured';
  try {
    const response = await telegramApiRequest(token, 'getMe', {}, { signal: AbortSignal.timeout(10_000) });
    const data = await response.json().catch(() => null);
    return response.ok && data?.ok === true ? 'ok' : `http_${response.status}`;
  } catch (error) {
    return error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'network_error';
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).end();
  if (!statusAuthorized(req)) return res.status(404).end();

  const ops = getNeboOpsConfig();
  const [telegram, preferences, outbox] = await Promise.all([
    telegramReachable(ops?.token),
    getNeboOpsPreferences(),
    getPool().query(
      `SELECT
         (SELECT COALESCE(jsonb_object_agg(status, n), '{}'::jsonb) FROM (
            SELECT status, COUNT(*)::int AS n FROM nebo_ops_outbox
            WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY status) s) AS by_status_24h,
         (SELECT COALESCE(jsonb_object_agg(code, n), '{}'::jsonb) FROM (
            SELECT COALESCE(last_error_code, 'none') AS code, COUNT(*)::int AS n FROM nebo_ops_outbox
            WHERE created_at > NOW() - INTERVAL '24 hours' AND status <> 'sent' GROUP BY 1) e) AS errors_24h,
         (SELECT COALESCE(jsonb_object_agg(event_type, n), '{}'::jsonb) FROM (
            SELECT event_type, COUNT(*)::int AS n FROM nebo_ops_outbox
            WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY 1) t) AS by_type_24h,
         (SELECT MAX(sent_at) FROM nebo_ops_outbox) AS last_sent_at,
         (SELECT MAX(created_at) FROM nebo_ops_outbox) AS last_queued_at,
         (SELECT MIN(created_at) FROM nebo_ops_outbox WHERE status IN ('pending', 'failed')) AS oldest_waiting_at,
         (SELECT row_to_json(d) FROM (SELECT next_send_at, cooldown_until FROM nebo_ops_delivery_state WHERE id = 1) d) AS delivery_state`,
    ).then((result) => result.rows[0]).catch((error) => ({ error: error instanceof Error ? error.message.slice(0, 200) : 'query_failed' })),
  ]);

  return res.status(200).json({
    server: neboServerLabel(),
    commit: String(process.env.RAILWAY_GIT_COMMIT_SHA || process.env.NEBO_DEPLOY_MARKER || '').slice(0, 12) || null,
    uptimeSeconds: Math.round(process.uptime()),
    now: new Date().toISOString(),
    config: {
      opsEnabled: isNeboOpsEnabled(),
      opsBot: Boolean(ops),
      paymentsBot: Boolean(getNeboOwnerChannelConfig('payments')),
      supportBot: Boolean(getNeboOwnerChannelConfig('support')),
      errorsBot: Boolean(getNeboOwnerChannelConfig('errors')),
      mainBot: Boolean(process.env.BOT_TOKEN),
      telegramViaRelay: useTelegramRelay(),
      publicUrl: String(process.env.NEBO_OPS_PUBLIC_URL || '') || null,
    },
    telegram,
    preferences,
    worker: getNeboOpsWorkerStatus(),
    scheduler: getSchedulerStatus(),
    outbox,
  });
}
