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
  // User-facing pushes of the main bot: counts by status and the commonest error texts.
  const pushes = await getPool().query(
    `SELECT
       (SELECT COALESCE(jsonb_object_agg(status, n), '{}'::jsonb) FROM (
          SELECT status, COUNT(*)::int AS n FROM notification_logs
          WHERE created_at > (NOW() AT TIME ZONE 'UTC') - INTERVAL '48 hours' GROUP BY status) s) AS by_status_48h,
       (SELECT COALESCE(jsonb_agg(jsonb_build_object('error', e, 'n', n) ORDER BY n DESC), '[]'::jsonb) FROM (
          SELECT LEFT(REGEXP_REPLACE(error, '\\d{5,}', '#', 'g'), 100) AS e, COUNT(*)::int AS n FROM notification_logs
          WHERE created_at > (NOW() AT TIME ZONE 'UTC') - INTERVAL '48 hours' AND error IS NOT NULL
          GROUP BY 1 ORDER BY 2 DESC LIMIT 6) x) AS top_errors_48h,
       (SELECT MAX(sent_at) FROM notification_logs WHERE status = 'sent') AS last_sent_at,
       (SELECT MAX(created_at) FROM notification_logs) AS last_logged_at`,
  ).then((result) => result.rows[0]).catch((error) => ({ error: error instanceof Error ? error.message.slice(0, 200) : 'query_failed' }));

  // ?visitors=1: distinct accounts seen today (Moscow) per source, to verify «заходили».
  let visitors: unknown = undefined;
  if (req.query.visitors === '1') {
    visitors = await getPool().query(
      `WITH b AS (SELECT (date_trunc('day', NOW() AT TIME ZONE 'Europe/Moscow') AT TIME ZONE 'Europe/Moscow') AS s)
       SELECT
         (SELECT COUNT(DISTINCT user_id) FROM user_app_events, b WHERE occurred_at >= (b.s AT TIME ZONE 'UTC'))::int AS app_events,
         (SELECT COUNT(DISTINCT user_id) FROM app_sessions, b WHERE created_at >= (b.s AT TIME ZONE 'UTC'))::int AS new_auth_sessions,
         (SELECT COUNT(DISTINCT user_id) FROM user_sessions, b WHERE last_seen_at >= (b.s AT TIME ZONE 'UTC'))::int AS session_last_seen,
         (SELECT COUNT(DISTINCT user_id) FROM nebo_ops_outbox, b WHERE event_type IN ('login', 'activity') AND occurred_at >= b.s)::int AS owner_visit_facts,
         (SELECT COUNT(*) FROM users, b WHERE created_at >= b.s)::int AS new_users`,
    ).then((result) => result.rows[0]).catch((error) => ({ error: error instanceof Error ? error.message.slice(0, 200) : 'failed' }));
  }

  // ?visitors=2: every table with a user_id and a timestamp — distinct accounts that left
  // any trace today (Moscow) and in the last 7 days. Independent check of «заходили».
  let traces: unknown = undefined;
  if (req.query.visitors === '2') {
    traces = await (async () => {
      const pool = getPool();
      const columns = (await pool.query(
        `SELECT c.table_name, c.column_name, c.data_type
         FROM information_schema.columns c
         JOIN information_schema.columns u ON u.table_schema = c.table_schema AND u.table_name = c.table_name AND u.column_name = 'user_id'
         JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
         WHERE c.table_schema = 'public'
           AND c.column_name IN ('created_at', 'updated_at', 'occurred_at', 'last_seen_at', 'sent_at', 'requested_at')
           AND c.data_type IN ('timestamp without time zone', 'timestamp with time zone')`,
      )).rows as Array<{ table_name: string; column_name: string; data_type: string }>;
      const start = `(date_trunc('day', NOW() AT TIME ZONE 'Europe/Moscow') AT TIME ZONE 'Europe/Moscow')`;
      const perTable: Record<string, unknown> = {};
      const parts: string[] = [];
      for (const col of columns) {
        if (!/^[a-z_][a-z0-9_]*$/.test(col.table_name) || !/^[a-z_]+$/.test(col.column_name)) continue;
        const bound = (expr: string) => (col.data_type === 'timestamp with time zone' ? `(${expr})` : `((${expr}) AT TIME ZONE 'UTC')`);
        const where = (from: string) => `"${col.column_name}" >= ${bound(from)}`;
        const counts = (await pool.query(
          `SELECT COUNT(DISTINCT user_id) FILTER (WHERE ${where(start)})::int AS today,
                  COUNT(DISTINCT user_id) FILTER (WHERE ${where(`NOW() - INTERVAL '7 days'`)})::int AS week
           FROM "${col.table_name}"`,
        ).catch((error) => ({ rows: [{ today: -1, week: -1, error: String(error?.message || error).slice(0, 120) }] }))).rows[0];
        perTable[`${col.table_name}.${col.column_name}`] = counts;
        parts.push(`SELECT user_id::text AS id, "${col.column_name}" >= ${bound(start)} AS today FROM "${col.table_name}"
                    WHERE user_id IS NOT NULL AND ${where(`NOW() - INTERVAL '7 days'`)}`);
      }
      const total = parts.length ? (await pool.query(
        `SELECT COUNT(DISTINCT id) FILTER (WHERE today)::int AS today, COUNT(DISTINCT id)::int AS week
         FROM (${parts.join(' UNION ALL ')}) x`,
      ).catch((error) => ({ rows: [{ today: -1, week: -1, error: String(error?.message || error).slice(0, 120) }] }))).rows[0] : null;
      return { anyTrace: total, perTable };
    })().catch((error) => ({ error: error instanceof Error ? error.message.slice(0, 200) : 'failed' }));
  }

  // ?push=1: why the planner does or does not queue pushes (dry run, nothing is sent).
  let pushDiagnosis: unknown = undefined;
  if (req.query.push === '1') {
    pushDiagnosis = await (async () => {
      const pool = getPool();
      const queue = (await pool.query(
        `SELECT
           (SELECT COALESCE(jsonb_object_agg(status, n), '{}'::jsonb) FROM (
              SELECT status, COUNT(*)::int AS n FROM scheduled_notifications
              WHERE scheduled_at > (NOW() AT TIME ZONE 'UTC') - INTERVAL '72 hours' GROUP BY status) s) AS by_status_72h,
           (SELECT MAX(sent_at) FROM scheduled_notifications) AS last_sent_at,
           (SELECT MAX(scheduled_at) FROM scheduled_notifications) AS last_scheduled_at`,
      )).rows[0];
      const owner = String(process.env.OWNER_ID || '').trim();
      const ownerUser = owner ? (await pool.query(
        `SELECT COALESCE(
           (SELECT user_id::text FROM account_identities WHERE provider = 'telegram' AND provider_subject = $1 LIMIT 1),
           (SELECT id::text FROM users WHERE id::text = $1 LIMIT 1)) AS id`, [owner],
      )).rows[0]?.id : null;
      const { getNotificationDeliveryHealth, probeOwnerNotifications } = await import('../../../services/notificationRetentionService');
      const [health, probe] = await Promise.all([
        getNotificationDeliveryHealth().catch((error) => ({ error: String(error?.message || error).slice(0, 200) })),
        ownerUser ? probeOwnerNotifications(ownerUser).catch((error) => ({ error: String(error?.message || error).slice(0, 200) })) : null,
      ]);
      return { queue, ownerFound: Boolean(ownerUser), health, ownerProbe: probe };
    })().catch((error) => ({ error: error instanceof Error ? error.message.slice(0, 200) : 'failed' }));
  }

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
    pushes,
    ...(pushDiagnosis === undefined ? {} : { pushDiagnosis }),
    ...(visitors === undefined ? {} : { visitors }),
    ...(traces === undefined ? {} : { traces }),
  });
}
