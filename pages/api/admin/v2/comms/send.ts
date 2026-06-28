import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../lib/admin/rbac';
import { recordAdminAction } from '../../../../../lib/admin/audit';
import { db } from '../../../../../lib/db';
import { sendTelegramTextMessage } from '../../../../../lib/telegramBot';

const MAX_RECIPIENTS = 300; // синхронная рассылка ограничена; больше — через ретеншн-движок

/**
 * Ручная отправка пуша: одному юзеру или сегменту. Право push.send.
 * Опасная операция (массовая рассылка) → подтверждение на клиенте. Логируется.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const ctx = await requireAdminPermission(req, 'push.send');
    const mode = req.body?.mode === 'segment' ? 'segment' : 'user';
    const text = String(req.body?.text || '').trim();
    if (text.length < 3) throw new AdminAuthError(400, 'BAD_TEXT', 'text is required');

    let recipients: Array<{ id: string }> = [];
    let label = '';
    if (mode === 'user') {
      const userId = String(req.body?.userId || '').trim();
      if (!/^-?\d+$/.test(userId)) throw new AdminAuthError(400, 'BAD_USER', 'valid userId required');
      recipients = [{ id: userId }];
      label = `user ${userId}`;
    } else {
      const segment = String(req.body?.segment || 'all');
      const list = await db.admin.getNotificationRecipients(segment as any);
      recipients = list.slice(0, MAX_RECIPIENTS).map((r: any) => ({ id: String(r.id) }));
      label = `segment ${segment} (${recipients.length})`;
    }

    let sent = 0; let failed = 0;
    for (const r of recipients) {
      try {
        const result = await sendTelegramTextMessage(r.id, text);
        if (result.ok) sent += 1; else failed += 1;
      } catch { failed += 1; }
    }

    await recordAdminAction({
      req, actor: ctx,
      action: mode === 'segment' ? 'campaign_created' : 'push_sent',
      entityType: 'push', entityId: label,
      after: { mode, recipients: recipients.length, sent, failed, capped: mode === 'segment' && recipients.length >= MAX_RECIPIENTS },
    });

    return res.status(200).json({ ok: true, total: recipients.length, sent, failed, capped: mode === 'segment' && recipients.length >= MAX_RECIPIENTS });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
