import { getPool } from './db';
import { hasDatabaseUrl } from './database-url';
import { getRecentErrors } from './errorTracking';

export type ProductionObservabilitySnapshot = {
  ok: boolean;
  checkedAt: string;
  errors: {
    recentInMemory: number;
    latest?: { timestamp: string; error: string; endpoint?: string };
  };
  notifications: {
    queueAvailable: boolean;
    scheduledDue: number | null;
    sendingStale: number | null;
    sent24h: number | null;
    failed24h: number | null;
    latestFailure?: string | null;
  };
  alerts: string[];
};

function latestInMemoryError() {
  const latest = getRecentErrors(1)[0];
  if (!latest) return undefined;
  return {
    timestamp: new Date(latest.timestamp).toISOString(),
    error: latest.message || latest.error,
    endpoint: latest.endpoint,
  };
}

export async function getProductionObservabilitySnapshot(): Promise<ProductionObservabilitySnapshot> {
  const alerts: string[] = [];
  const recentErrors = getRecentErrors(20);
  const snapshot: ProductionObservabilitySnapshot = {
    ok: true,
    checkedAt: new Date().toISOString(),
    errors: {
      recentInMemory: recentErrors.length,
      latest: latestInMemoryError(),
    },
    notifications: {
      queueAvailable: false,
      scheduledDue: null,
      sendingStale: null,
      sent24h: null,
      failed24h: null,
      latestFailure: null,
    },
    alerts,
  };

  if (!hasDatabaseUrl()) {
    snapshot.ok = false;
    alerts.push('DATABASE_URL_NOT_CONFIGURED');
    return snapshot;
  }

  try {
    const pool = getPool();
    const table = await pool.query(
      `SELECT EXISTS (
         SELECT FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'scheduled_notifications'
       ) AS exists`
    );
    snapshot.notifications.queueAvailable = table.rows[0]?.exists === true;
    if (!snapshot.notifications.queueAvailable) {
      snapshot.ok = false;
      alerts.push('SCHEDULED_NOTIFICATIONS_TABLE_MISSING');
      return snapshot;
    }

    const metrics = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'scheduled' AND scheduled_at <= NOW())::int AS scheduled_due,
         COUNT(*) FILTER (WHERE status = 'sending' AND locked_at < NOW() - INTERVAL '15 minutes')::int AS sending_stale,
         COUNT(*) FILTER (WHERE status = 'sent' AND sent_at >= NOW() - INTERVAL '24 hours')::int AS sent_24h,
         COUNT(*) FILTER (WHERE status = 'failed' AND updated_at >= NOW() - INTERVAL '24 hours')::int AS failed_24h,
         (SELECT error FROM scheduled_notifications
          WHERE status = 'failed' AND error IS NOT NULL
          ORDER BY updated_at DESC LIMIT 1) AS latest_failure
       FROM scheduled_notifications`
    );
    const row = metrics.rows[0] || {};
    snapshot.notifications.scheduledDue = Number(row.scheduled_due ?? 0);
    snapshot.notifications.sendingStale = Number(row.sending_stale ?? 0);
    snapshot.notifications.sent24h = Number(row.sent_24h ?? 0);
    snapshot.notifications.failed24h = Number(row.failed_24h ?? 0);
    snapshot.notifications.latestFailure = row.latest_failure || null;

    if ((snapshot.notifications.sendingStale || 0) > 0) alerts.push('STALE_NOTIFICATION_DISPATCH_LOCKS');
    if ((snapshot.notifications.failed24h || 0) > 0) alerts.push('NOTIFICATION_FAILURES_LAST_24H');
    snapshot.ok = alerts.length === 0;
    return snapshot;
  } catch (error: any) {
    snapshot.ok = false;
    alerts.push(`OBSERVABILITY_QUERY_FAILED:${error?.message || 'unknown'}`);
    return snapshot;
  }
}
