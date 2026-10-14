import { getPool } from './db';
import { enqueueNeboOpsEvent } from './neboOps';
import { collectVersions, compareVersions } from './productMetrics';
import { STEP_LABELS } from './journeyTelemetry';
import { queueNewRuStoreReviews } from './rustoreReviews';

/**
 * Owner events that nobody «sends»: they are noticed by looking at the data.
 * Each person is reported once (the event key dedupes), so restarts never repeat.
 */

async function queue(input: Parameters<typeof enqueueNeboOpsEvent>[1]): Promise<boolean> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const before = await client.query('SELECT 1 FROM nebo_ops_outbox WHERE event_key = $1', [input.eventKey]);
    if (before.rowCount) { await client.query('ROLLBACK'); return false; }
    await enqueueNeboOpsEvent(client, input);
    await client.query('COMMIT');
    return true;
  } catch {
    await client.query('ROLLBACK').catch(() => undefined);
    return false;
  } finally {
    client.release();
  }
}

/** First launch two or more hours ago (within the last day) and still no natal chart. */
export async function queueAbandonedOnboarding(): Promise<number> {
  const rows = (await getPool().query(
    `SELECT u.id, u.created_at,
            (SELECT e.payload_json->>'step' FROM user_app_events e WHERE e.user_id = u.id
               AND e.event_type = 'onboarding_step_view' ORDER BY e.occurred_at DESC LIMIT 1) AS step,
            (SELECT o.payload_json FROM nebo_ops_outbox o WHERE o.user_id = u.id AND o.payload_json ? 'deviceModel'
               ORDER BY o.occurred_at DESC LIMIT 1) AS runtime
     FROM users u
     WHERE u.created_at >= NOW() - INTERVAL '26 hours' AND u.created_at <= NOW() - INTERVAL '2 hours'
       AND NOT EXISTS (SELECT 1 FROM natal_charts c WHERE c.user_id = u.id)
     ORDER BY u.created_at LIMIT 20`,
  )).rows;
  let queued = 0;
  for (const row of rows) {
    const hours = Math.max(2, Math.round((Date.now() - new Date(row.created_at).getTime()) / 3_600_000));
    if (await queue({
      eventKey: `onboarding-abandoned:${row.id}`,
      eventType: 'onboarding_abandoned',
      userId: String(row.id),
      payload: { ...(row.runtime || {}), hoursSince: hours, lastStep: row.step ? STEP_LABELS[String(row.step)] || String(row.step) : undefined },
    })) queued++;
  }
  return queued;
}

/** People who opened the app in the last day on a version older than the newest one in use. */
export async function queueOldVersions(now = new Date()): Promise<number> {
  const { latest } = await collectVersions(now);
  if (!latest) return 0;
  const rows = (await getPool().query(
    `SELECT DISTINCT ON (e.user_id) e.user_id, e.payload_json->>'app_version' AS version
     FROM user_app_events e
     WHERE e.payload_json->>'runtime' = 'native' AND e.payload_json ? 'app_version'
       AND e.occurred_at >= (NOW() AT TIME ZONE 'UTC') - INTERVAL '24 hours'
     ORDER BY e.user_id, e.occurred_at DESC`,
  )).rows;
  let queued = 0;
  for (const row of rows) {
    const version = String(row.version || '');
    if (!version || version === latest || compareVersions(version, latest) >= 0) continue;
    if (await queue({
      eventKey: `old-version:${row.user_id}:${version}`,
      eventType: 'old_version',
      userId: String(row.user_id),
      payload: { appVersion: version, latestVersion: latest },
    })) queued++;
  }
  return queued;
}

let lastVersionsAt = 0;
let lastReviewsAt = 0;

/** Called by the owner-bot worker every ten minutes on the primary server. */
export async function runNeboOpsScans(now = new Date()): Promise<number> {
  let queued = await queueAbandonedOnboarding().catch(() => 0);
  if (now.getTime() - lastVersionsAt >= 60 * 60_000) {
    lastVersionsAt = now.getTime();
    queued += await queueOldVersions(now).catch(() => 0);
  }
  if (now.getTime() - lastReviewsAt >= 30 * 60_000) {
    lastReviewsAt = now.getTime();
    queued += await queueNewRuStoreReviews();
  }
  return queued;
}
