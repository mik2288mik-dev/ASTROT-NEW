import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../lib/admin/rbac';
import { recordAdminAction } from '../../../../../lib/admin/audit';
import { getPool } from '../../../../../lib/db';
import { sendTelegramTextMessage } from '../../../../../lib/telegramBot';

const STATUSES = new Set(['open', 'pending', 'closed']);

/** Тикет: детали+переписка (support.view), ответ/смена статуса (support.act). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = Number(req.query.id);
  try {
    if (!Number.isFinite(id)) throw new AdminAuthError(400, 'BAD_ID', 'Valid id required');
    const pool = getPool();

    if (req.method === 'GET') {
      await requireAdminPermission(req, 'support.view');
      const t = await pool.query(`SELECT t.*, u.name AS user_name FROM support_tickets t LEFT JOIN users u ON u.id = t.user_id WHERE t.id = $1`, [id]);
      if (!t.rows[0]) throw new AdminAuthError(404, 'NOT_FOUND', 'Ticket not found');
      const m = await pool.query(`SELECT author_type, author_id, body, internal, created_at FROM support_messages WHERE ticket_id = $1 ORDER BY created_at ASC`, [id]);
      const r = t.rows[0];
      return res.status(200).json({
        ticket: { id: Number(r.id), userId: r.user_id != null ? String(r.user_id) : null, userName: r.user_name || null, subject: r.subject, status: r.status, priority: r.priority },
        messages: m.rows.map((x: any) => ({ authorType: x.author_type, body: x.body, internal: x.internal, createdAt: x.created_at ? new Date(x.created_at).toISOString() : null })),
      });
    }

    if (req.method === 'POST') {
      const ctx = await requireAdminPermission(req, 'support.act');
      const action = String(req.body?.action || '');
      const t = await pool.query(`SELECT user_id, status FROM support_tickets WHERE id = $1`, [id]);
      if (!t.rows[0]) throw new AdminAuthError(404, 'NOT_FOUND', 'Ticket not found');

      if (action === 'reply') {
        const body = String(req.body?.body || '').trim();
        const internal = !!req.body?.internal;
        if (!body) throw new AdminAuthError(400, 'BAD_BODY', 'body is required');
        await pool.query(`INSERT INTO support_messages (ticket_id, author_type, author_id, body, internal) VALUES ($1, 'admin', $2, $3, $4)`,
          [id, ctx.userId, body, internal]);
        await pool.query(`UPDATE support_tickets SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
        // публичный ответ доставляем пользователю в Telegram
        if (!internal && t.rows[0].user_id) {
          await sendTelegramTextMessage(String(t.rows[0].user_id), `Поддержка NEBO:\n\n${body}`).catch(() => undefined);
        }
        await recordAdminAction({ req, actor: ctx, action: 'user_edited', entityType: 'support_ticket', entityId: id, after: { reply: true, internal } });
        return res.status(200).json({ ok: true });
      }
      if (action === 'status') {
        const status = String(req.body?.status || '');
        if (!STATUSES.has(status)) throw new AdminAuthError(400, 'BAD_STATUS', 'status must be open/pending/closed');
        await pool.query(`UPDATE support_tickets SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [status, id]);
        await recordAdminAction({ req, actor: ctx, action: 'user_edited', entityType: 'support_ticket', entityId: id, after: { status } });
        return res.status(200).json({ ok: true });
      }
      throw new AdminAuthError(400, 'BAD_ACTION', 'action must be reply or status');
    }

    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
