import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminAccess, handleAdminError } from '../../../../../lib/adminAuth';
import { getPool } from '../../../../../lib/db';

/**
 * Таймлайн действий конкретного пользователя — последние события из
 * user_app_events (открытия экранов, клики, показы Premium и т.д.).
 * Read-only, только для админа. Помогает понять путь конкретного человека.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  const { id } = req.query;
  const userId = Array.isArray(id) ? id[0] : id;
  if (!userId) {
    return res.status(400).json({ error: 'USER_ID_REQUIRED', message: 'User ID is required' });
  }

  try {
    await requireAdminAccess(req);

    const limitRaw = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 50;
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1), 200);

    const pool = getPool();
    const result = await pool.query(
      `SELECT event_type, section, source, occurred_at
       FROM user_app_events
       WHERE user_id = $1
       ORDER BY occurred_at DESC
       LIMIT $2`,
      [userId, limit],
    );

    const events = result.rows.map((row) => ({
      eventType: String(row.event_type || ''),
      section: row.section ? String(row.section) : null,
      source: row.source ? String(row.source) : null,
      occurredAt: row.occurred_at ? new Date(row.occurred_at).toISOString() : null,
    }));

    return res.status(200).json({ events });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
