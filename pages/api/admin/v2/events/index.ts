import type { NextApiRequest, NextApiResponse } from 'next';
import { getPool } from '../../../../../lib/db';
import { getAdminContext, roleHasPermission } from '../../../../../lib/admin/rbac';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const pool = getPool();
    const ctx = await getAdminContext(req);
    if (!ctx) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }
    if (!roleHasPermission(ctx.role, 'analytics.view') && !roleHasPermission(ctx.role, 'users.view')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'analytics.view or users.view required' });
    }

    const {
      user_id,
      event_type,
      section,
      source,
      search,
      from,
      to,
      limit = '50',
      offset = '0',
    } = req.query;

    const parsedLimit = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 50));
    const parsedOffset = Math.max(0, parseInt(String(offset), 10) || 0);

    const conditions: string[] = ['1=1'];
    const values: any[] = [];
    let paramIdx = 1;

    if (user_id) {
      conditions.push(`user_id = $${paramIdx++}`);
      values.push(String(user_id));
    }

    if (event_type) {
      conditions.push(`event_type = $${paramIdx++}`);
      values.push(String(event_type));
    }

    if (section) {
      conditions.push(`section = $${paramIdx++}`);
      values.push(String(section));
    }

    if (source) {
      conditions.push(`source = $${paramIdx++}`);
      values.push(String(source));
    }

    if (from) {
      conditions.push(`occurred_at >= $${paramIdx++}`);
      values.push(new Date(String(from)));
    }

    if (to) {
      conditions.push(`occurred_at <= $${paramIdx++}`);
      values.push(new Date(String(to)));
    }

    if (search) {
      conditions.push(`(event_type ILIKE $${paramIdx} OR payload_json::text ILIKE $${paramIdx} OR user_id ILIKE $${paramIdx})`);
      values.push(`%${search}%`);
      paramIdx++;
    }

    const whereClause = conditions.join(' AND ');

    // Total count
    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM user_app_events WHERE ${whereClause}`,
      values
    );
    const total = countRes.rows[0]?.total || 0;

    // Events page
    const eventsRes = await pool.query(
      `SELECT id, user_id, event_type, section, source, payload_json, occurred_at, event_id
       FROM user_app_events
       WHERE ${whereClause}
       ORDER BY occurred_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...values, parsedLimit, parsedOffset]
    );

    // Get popular event types and sections for filter suggestions
    const typesRes = await pool.query(
      `SELECT DISTINCT event_type FROM user_app_events WHERE occurred_at >= NOW() - INTERVAL '7 days' ORDER BY event_type LIMIT 50`
    );
    const sectionsRes = await pool.query(
      `SELECT DISTINCT section FROM user_app_events WHERE section IS NOT NULL AND occurred_at >= NOW() - INTERVAL '7 days' ORDER BY section LIMIT 30`
    );

    return res.status(200).json({
      events: eventsRes.rows,
      total,
      limit: parsedLimit,
      offset: parsedOffset,
      filterSuggestions: {
        eventTypes: typesRes.rows.map(r => r.event_type),
        sections: sectionsRes.rows.map(r => r.section),
      },
    });
  } catch (error: any) {
    console.error('API /admin/v2/events error:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
}
