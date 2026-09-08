import { getPool } from './db';
import { creditedActivityMs, type ActivityPulse } from './productActivity';
import type { ClientRuntimeMetadata } from './clientRuntimeMetadata';

/** Existing tables + per-visit transaction lock keep multi-instance retries idempotent. */
export async function recordActivityPulse(userId: string, pulse: ActivityPulse, runtime: ClientRuntimeMetadata) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`activity:${userId}:${pulse.sessionId}`]);
    const prior = await client.query(`SELECT payload_json,
        EXTRACT(EPOCH FROM occurred_at AT TIME ZONE 'UTC') * 1000 AS received_ms,
        EXTRACT(EPOCH FROM clock_timestamp()) * 1000 AS server_now_ms
      FROM user_app_events WHERE user_id = $1 AND event_type = 'activity_heartbeat'
        AND payload_json->>'session_id' = $2 ORDER BY occurred_at DESC, id DESC LIMIT 1`, [userId, pulse.sessionId]);
    const row = prior.rows[0];
    if (row && (pulse.sequence <= Number(row.payload_json.sequence)
      || Number(row.server_now_ms) - Number(row.received_ms) < 1_000)) {
      await client.query('COMMIT');
      return { accepted: false, activeMs: 0 };
    }
    const activeMs = creditedActivityMs(pulse, row ? {
      sequence: Number(row.payload_json.sequence), totalActiveMs: Number(row.payload_json.total_active_ms),
      receivedAt: Number(row.received_ms),
    } : null, row ? Number(row.server_now_ms) : Date.now());
    const inserted = await client.query(`INSERT INTO user_app_events
        (user_id, event_id, event_type, section, source, payload_json)
      VALUES ($1, $2, 'activity_heartbeat', $3, 'app', $4::jsonb)
      ON CONFLICT (event_id) WHERE event_id IS NOT NULL DO NOTHING RETURNING id`,
    [userId, pulse.eventId, pulse.screen, JSON.stringify({
      session_id: pulse.sessionId, sequence: pulse.sequence,
      total_active_ms: pulse.totalActiveMs, active_ms: activeMs, state: pulse.state,
      measurement_version: 1, runtime: runtime.runtime, platform: runtime.osName,
      app_version: runtime.appVersion, distribution_channel: runtime.distributionChannel,
    })]);
    if (inserted.rows.length) {
      await client.query(`INSERT INTO user_sessions (session_id, user_id, telegram_platform, device_label)
        VALUES ($1, $2, $3, $4) ON CONFLICT (session_id, user_id) DO UPDATE SET last_seen_at = CURRENT_TIMESTAMP`,
      [pulse.sessionId, userId, runtime.runtime || null,
        [runtime.deviceManufacturer, runtime.deviceModel || runtime.osName].filter(Boolean).join(' ') || null]);
    }
    await client.query('COMMIT');
    return { accepted: Boolean(inserted.rows.length), activeMs };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally { client.release(); }
}
