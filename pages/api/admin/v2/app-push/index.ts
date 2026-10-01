import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../lib/admin/rbac';
import { recordAdminAction } from '../../../../../lib/admin/audit';
import {
  cancelAppPushMessage, createAppPushMessage, getAppPushOverview, validateAppPushDraft,
} from '../../../../../lib/appPush';

/** Ручные уведомления в Android-приложение: список, отправка/планирование, отмена. Право push.send. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const ctx = await requireAdminPermission(req, 'push.send');
    if (req.method === 'GET') return res.status(200).json(await getAppPushOverview());

    if (req.method === 'POST') {
      const body = req.body?.audience === 'me' ? { ...req.body, audience: 'user', target: ctx.userId } : req.body;
      const draft = validateAppPushDraft(body);
      if (typeof draft === 'string') throw new AdminAuthError(400, 'BAD_PUSH', draft);
      const id = await createAppPushMessage(draft, ctx.userId);
      await recordAdminAction({
        req, actor: ctx, action: draft.audience === 'all' ? 'campaign_created' : 'push_sent',
        entityType: 'push', entityId: `app_push:${id}`,
        after: { title: draft.title, route: draft.route, audience: draft.audience, target: draft.target, sendAt: draft.sendAt.toISOString() },
      });
      return res.status(200).json({ ok: true, id });
    }

    if (req.method === 'DELETE') {
      const id = Number(req.body?.id ?? req.query.id);
      if (!Number.isSafeInteger(id) || id <= 0) throw new AdminAuthError(400, 'BAD_ID', 'id is required');
      const cancelled = await cancelAppPushMessage(id);
      if (cancelled) {
        await recordAdminAction({ req, actor: ctx, action: 'push_sent', entityType: 'push', entityId: `app_push:${id}`, after: { cancelled: true } });
      }
      return res.status(200).json({ ok: cancelled });
    }

    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
