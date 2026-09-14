import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError } from '../../../../lib/adminAuth';
import { getAdminContext, roleHasPermission } from '../../../../lib/admin/rbac';
import { getPool } from '../../../../lib/db';
import { INTERACTIVE_EVENT_TYPES } from '../../../../lib/admin/activityAnalytics';
import { eventLabel } from '../../../../lib/admin/eventTaxonomy';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const ctx = await getAdminContext(req);
    if (!roleHasPermission(ctx.role, 'analytics.view') && !roleHasPermission(ctx.role, 'users.view')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'analytics.view permission required' });
    }

    const pool = getPool();

    // Parallel fetch of real-time pulse data
    const [onlineStats, recentRegistrations, recentEvents, recentPayments, recentErrors, recentAiDefects] = await Promise.all([
      // 1. Active in last 5 and 15 minutes
      pool.query(`
        SELECT
          COUNT(DISTINCT user_id) FILTER (WHERE occurred_at >= NOW() - INTERVAL '5 minutes')::int AS active_5m,
          COUNT(DISTINCT user_id) FILTER (WHERE occurred_at >= NOW() - INTERVAL '15 minutes')::int AS active_15m,
          COUNT(*)::int AS events_15m
        FROM user_app_events
        WHERE occurred_at >= NOW() - INTERVAL '15 minutes'
          AND event_type = ANY($1::text[])
      `, [INTERACTIVE_EVENT_TYPES]),

      // 2. Recent 8 registrations
      pool.query(`
        SELECT id, name, auth_provider, created_at, is_premium, current_device
        FROM users
        ORDER BY created_at DESC
        LIMIT 8
      `),

      // 3. Recent 12 key events
      pool.query(`
        SELECT e.id, e.user_id, e.event_type, e.section, e.source, e.occurred_at, u.name as user_name
        FROM user_app_events e
        LEFT JOIN users u ON u.id = e.user_id
        WHERE e.event_type NOT IN ('activity_heartbeat')
        ORDER BY e.occurred_at DESC
        LIMIT 12
      `),

      // 4. Recent 6 payments
      pool.query(`
        SELECT id, user_id, total_amount as amount, currency, status, created_at, 'telegram_stars' as provider
        FROM stars_payments
        ORDER BY created_at DESC
        LIMIT 6
      `),

      // 5. Recent 6 technical errors
      pool.query(`
        SELECT id, endpoint, http_status, error_code, message, occurrences_count, last_seen_at
        FROM app_technical_errors
        ORDER BY last_seen_at DESC
        LIMIT 6
      `).catch(() => ({ rows: [] })),

      // 6. Recent 6 AI defects
      pool.query(`
        SELECT id, scenario, model, category, error_code, message, occurrences_count, last_seen_at
        FROM app_ai_defects
        ORDER BY last_seen_at DESC
        LIMIT 6
      `).catch(() => ({ rows: [] })),
    ]);

    const active5m = onlineStats.rows[0]?.active_5m || 0;
    const active15m = onlineStats.rows[0]?.active_15m || 0;
    const events15m = onlineStats.rows[0]?.events_15m || 0;

    return res.status(200).json({
      pulse: {
        active5m,
        active15m,
        events15m,
        generatedAt: new Date().toISOString(),
      },
      recentRegistrations: recentRegistrations.rows.map((row) => ({
        id: String(row.id),
        name: row.name || 'Гость',
        provider: row.auth_provider || 'guest',
        createdAt: row.created_at,
        isPremium: Boolean(row.is_premium),
        device: row.current_device || null,
      })),
      recentEvents: recentEvents.rows.map((row) => ({
        id: Number(row.id),
        userId: String(row.user_id),
        userName: row.user_name || null,
        eventType: row.event_type,
        label: eventLabel(row.event_type),
        section: row.section || null,
        source: row.source || null,
        occurredAt: row.occurred_at,
      })),
      recentPayments: recentPayments.rows.map((row) => ({
        id: Number(row.id),
        userId: String(row.user_id),
        amount: Number(row.amount || 0),
        currency: row.currency || 'XTR',
        status: row.status,
        createdAt: row.created_at,
        provider: row.provider,
      })),
      recentErrors: recentErrors.rows.map((row) => ({
        id: Number(row.id),
        endpoint: row.endpoint,
        httpStatus: row.http_status,
        errorCode: row.error_code,
        message: row.message,
        count: Number(row.occurrences_count || 1),
        lastSeenAt: row.last_seen_at,
      })),
      recentAiDefects: recentAiDefects.rows.map((row) => ({
        id: Number(row.id),
        scenario: row.scenario,
        model: row.model,
        category: row.category,
        errorCode: row.error_code,
        message: row.message,
        count: Number(row.occurrences_count || 1),
        lastSeenAt: row.last_seen_at,
      })),
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
