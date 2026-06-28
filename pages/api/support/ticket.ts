import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../lib/adminAuth';
import { requireAppUser } from '../../../lib/auth/appAuth';
import { getPool } from '../../../lib/db';

/**
 * Пользователь создаёт обращение в поддержку. Требует app-сессию (telegram/web-guest).
 * Тикет и первое сообщение попадают в админку (раздел «Поддержка»).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const appUser = await requireAppUser(req, { allowGuest: true });
    const subject = String(req.body?.subject || '').trim().slice(0, 200) || 'Обращение';
    const body = String(req.body?.body || '').trim().slice(0, 4000);
    if (body.length < 3) throw new AdminAuthError(400, 'BAD_BODY', 'Опишите проблему');

    const pool = getPool();
    const t = await pool.query(
      `INSERT INTO support_tickets (user_id, subject, status, priority) VALUES ($1, $2, 'open', 'normal') RETURNING id`,
      [/^-?\d+$/.test(appUser.userId) ? appUser.userId : null, subject]
    );
    await pool.query(
      `INSERT INTO support_messages (ticket_id, author_type, author_id, body, internal) VALUES ($1, 'user', $2, $3, FALSE)`,
      [t.rows[0].id, /^-?\d+$/.test(appUser.userId) ? appUser.userId : null, body]
    );
    return res.status(200).json({ ok: true, ticketId: Number(t.rows[0].id) });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
