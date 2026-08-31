import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../lib/admin/rbac';
import { recordAdminAction } from '../../../../../lib/admin/audit';
import { getPool } from '../../../../../lib/db';
import {
  parseSupportMetadata,
  sendSupportEmailReply,
  sendSupportTelegramReply,
  type SupportDeliveryResult,
} from '../../../../../lib/supportDelivery';

const STATUSES = new Set(['open', 'pending', 'closed']);
const SUPPORT_REPLY_MAX_LENGTH = 4_000;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;

/** Тикет: детали+переписка (support.view), ответ/смена статуса (support.act). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = Number(req.query.id);
  try {
    if (!Number.isSafeInteger(id) || id < 1) throw new AdminAuthError(400, 'BAD_ID', 'Valid id required');
    const pool = getPool();

    if (req.method === 'GET') {
      await requireAdminPermission(req, 'support.view');
      const t = await pool.query(`SELECT t.*, u.name AS user_name FROM support_tickets t LEFT JOIN users u ON u.id = t.user_id WHERE t.id = $1`, [id]);
      if (!t.rows[0]) throw new AdminAuthError(404, 'NOT_FOUND', 'Ticket not found');
      const m = await pool.query(`SELECT author_type, author_id, body, internal, created_at FROM support_messages WHERE ticket_id = $1 ORDER BY created_at ASC`, [id]);
      const r = t.rows[0];
      const metadata = parseSupportMetadata(r.tags);
      return res.status(200).json({
        ticket: {
          id: Number(r.id), userId: r.user_id != null ? String(r.user_id) : null, userName: r.user_name || null,
          subject: r.subject, status: r.status, priority: r.priority,
          category: metadata?.category || null,
          replyEmail: metadata?.replyEmail || null,
          diagnostics: metadata?.diagnostics || null,
        },
        messages: m.rows.map((x: any) => ({ authorType: x.author_type, body: x.body, internal: x.internal, createdAt: x.created_at ? new Date(x.created_at).toISOString() : null })),
      });
    }

    if (req.method === 'POST') {
      const ctx = await requireAdminPermission(req, 'support.act');
      const action = String(req.body?.action || '');
      const t = await pool.query(`SELECT user_id, status, tags FROM support_tickets WHERE id = $1`, [id]);
      if (!t.rows[0]) throw new AdminAuthError(404, 'NOT_FOUND', 'Ticket not found');

      if (action === 'reply') {
        if (typeof req.body?.body !== 'string') {
          throw new AdminAuthError(400, 'BAD_BODY', 'body is required');
        }
        const body = req.body.body.trim();
        if (req.body?.internal !== undefined && typeof req.body.internal !== 'boolean') {
          throw new AdminAuthError(400, 'BAD_INTERNAL', 'internal must be a boolean');
        }
        const internal = !!req.body?.internal;
        if (!body || body.length > SUPPORT_REPLY_MAX_LENGTH || CONTROL_CHARACTER_PATTERN.test(body)) {
          throw new AdminAuthError(400, 'BAD_BODY', `body must contain 1-${SUPPORT_REPLY_MAX_LENGTH} characters`);
        }

        const metadata = parseSupportMetadata(t.rows[0].tags);
        const replyEmail = internal ? null : metadata?.replyEmail || null;
        let telegramChatId = '';
        if (!internal && t.rows[0].user_id) {
          const telegramIdentity = await pool.query(
            `SELECT provider_subject
               FROM account_identities
              WHERE user_id = $1 AND provider = 'telegram'
              ORDER BY last_used_at DESC NULLS LAST
              LIMIT 1`,
            [t.rows[0].user_id],
          );
          const candidate = String(telegramIdentity.rows[0]?.provider_subject || '').trim();
          if (/^-?\d{1,20}$/u.test(candidate)) telegramChatId = candidate;
        }
        if (!internal && !replyEmail && !telegramChatId) {
          throw new AdminAuthError(
            409,
            'SUPPORT_REPLY_DESTINATION_MISSING',
            'No validated reply channel is available',
          );
        }

        const inserted = await pool.query(
          `INSERT INTO support_messages (ticket_id, author_type, author_id, body, internal)
           VALUES ($1, 'admin', $2, $3, $4)
           RETURNING id`,
          [id, ctx.userId, body, internal]);
        const messageId = Number(inserted.rows[0]?.id);
        if (!Number.isSafeInteger(messageId) || messageId < 1) {
          throw new AdminAuthError(500, 'SUPPORT_REPLY_PERSIST_FAILED', 'Reply could not be persisted');
        }

        if (internal) {
          await recordAdminAction({ req, actor: ctx, action: 'user_edited', entityType: 'support_ticket', entityId: id, after: { reply: true, internal: true } });
          return res.status(200).json({ ok: true });
        }

        const deliveries = await Promise.all<SupportDeliveryResult>([
          ...(replyEmail
            ? [sendSupportEmailReply({ ticketId: id, messageId, to: replyEmail, message: body })]
            : []),
          ...(telegramChatId
            ? [sendSupportTelegramReply({ ticketId: id, chatId: telegramChatId, message: body })]
            : []),
        ]);
        const deliveredChannels = deliveries
          .filter((delivery) => delivery.result === 'sent')
          .map((delivery) => delivery.channel);
        if (!deliveredChannels.length) {
          await recordAdminAction({
            req,
            actor: ctx,
            action: 'user_edited',
            entityType: 'support_ticket',
            entityId: id,
            after: { reply: true, internal: false, delivered: false },
          });
          throw new AdminAuthError(
            502,
            'SUPPORT_REPLY_DELIVERY_FAILED',
            'Reply was saved but no delivery channel confirmed it',
          );
        }

        await pool.query(`UPDATE support_tickets SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
        await recordAdminAction({
          req,
          actor: ctx,
          action: 'user_edited',
          entityType: 'support_ticket',
          entityId: id,
          after: { reply: true, internal: false, deliveredChannels },
        });
        return res.status(200).json({
          ok: true,
          deliveries: Object.fromEntries(deliveries.map((delivery) => [delivery.channel, delivery.result])),
        });
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
