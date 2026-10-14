import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../lib/admin/rbac';
import { getPool } from '../../../../../lib/db';

/** Тикеты поддержки: список (support.view) + создание от имени юзера (support.act). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      await requireAdminPermission(req, 'support.view');
      const status = typeof req.query.status === 'string' && req.query.status !== 'all' ? req.query.status : null;
      const where = status ? 'WHERE t.status = $1' : '';
      const rows = await getPool().query(
        `SELECT t.id, t.user_id, t.subject, t.status, t.priority, t.assignee_id, t.updated_at,
                u.name AS user_name,
                (SELECT COUNT(*)::int FROM support_messages m WHERE m.ticket_id = t.id) AS messages
           FROM support_tickets t LEFT JOIN users u ON u.id = t.user_id
           ${where}
           ORDER BY t.updated_at DESC NULLS LAST, t.id DESC LIMIT 200`,
        status ? [status] : []
      );
      return res.status(200).json({
        tickets: rows.rows.map((r: any) => ({
          id: Number(r.id), userId: r.user_id != null ? String(r.user_id) : null, userName: r.user_name || null,
          subject: r.subject, status: r.status, priority: r.priority, messages: Number(r.messages),
          updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
        })),
      });
    }
    if (req.method === 'POST') {
      const ctx = await requireAdminPermission(req, 'support.act');
      const userId = String(req.body?.userId || '').trim();
      const subject = String(req.body?.subject || '').trim() || 'Без темы';
      const body = String(req.body?.body || '').trim();
      if (!body) throw new AdminAuthError(400, 'BAD_BODY', 'body is required');
      const pool = getPool();
      const t = await pool.query(
        `INSERT INTO support_tickets (user_id, subject, status, priority) VALUES ($1, $2, 'open', 'normal') RETURNING id`,
        [/^-?\d+$/.test(userId) ? userId : null, subject]
      );
      await pool.query(
        `INSERT INTO support_messages (ticket_id, author_type, author_id, body, internal) VALUES ($1, 'admin', $2, $3, FALSE)`,
        [t.rows[0].id, ctx.userId, body]
      );
      return res.status(200).json({ ok: true, id: Number(t.rows[0].id) });
    }
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
