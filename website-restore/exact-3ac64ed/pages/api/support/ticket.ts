import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../lib/adminAuth';
import { requireAppUser } from '../../../lib/auth/appAuth';
import { consumeAuthRateLimit } from '../../../lib/auth/authRateLimit';
import { getPool } from '../../../lib/db';
import {
  buildSupportSubject,
  parseSupportTicketPayload,
  serializeSupportMetadata,
  SupportPayloadError,
} from '../../../lib/supportDelivery';
import {
  enqueueSupportDeliveryOutbox,
  processSupportDeliveryOutbox,
} from '../../../lib/supportOutbox';

const SUPPORT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const SUPPORT_RATE_LIMIT_MAX_ATTEMPTS = 5;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '16kb',
    },
  },
};

/**
 * Пользователь создаёт обращение в поддержку. Требует app-сессию (telegram/web-guest).
 * Тикет и первое сообщение попадают в админку (раздел «Поддержка»).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  res.setHeader('Cache-Control', 'no-store');
  try {
    let payload;
    try {
      payload = parseSupportTicketPayload(req.body);
    } catch (error) {
      if (error instanceof SupportPayloadError) {
        throw new AdminAuthError(400, error.code, error.message);
      }
      throw error;
    }
    const appUser = await requireAppUser(req, { allowGuest: true });
    await consumeAuthRateLimit({
      scope: 'support_ticket_user',
      key: appUser.userId,
      maxAttempts: SUPPORT_RATE_LIMIT_MAX_ATTEMPTS,
      windowMs: SUPPORT_RATE_LIMIT_WINDOW_MS,
    });

    const pool = getPool();
    const client = await pool.connect();
    let ticketId: number;
    try {
      await client.query('BEGIN');
      const ticket = await client.query(
        `INSERT INTO support_tickets (user_id, subject, status, priority, tags)
         VALUES ($1, $2, 'open', 'normal', $3) RETURNING id`,
        [appUser.userId, buildSupportSubject(payload.category), serializeSupportMetadata(payload)],
      );
      ticketId = Number(ticket.rows[0]?.id);
      if (!Number.isSafeInteger(ticketId) || ticketId < 1) throw new Error('SUPPORT_TICKET_ID_INVALID');
      await client.query(
        `INSERT INTO support_messages (ticket_id, author_type, author_id, body, internal)
         VALUES ($1, 'user', $2, $3, FALSE)`,
        [ticketId, appUser.userId, payload.message],
      );
      await enqueueSupportDeliveryOutbox(client, ticketId);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }

    await processSupportDeliveryOutbox(2, ticketId).catch(() => undefined);
    return res.status(201).json({ ok: true, ticketId });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
