import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../../lib/adminAuth';
import { requireAdminPermission, roleHasPermission } from '../../../../../lib/admin/rbac';
import { recordAdminAction } from '../../../../../lib/admin/audit';
import { setAccountBlockedState } from '../../../../../lib/auth/accountIdentity';
import { db } from '../../../../../lib/db';
import { withAdminSource } from '../../../../../lib/admin/dataSource';
import { getPersonStory } from '../../../../../lib/admin/people';

function account(detail: any) {
  return {
    isBlocked: detail.is_blocked === true,
    isAdmin: detail.is_admin === true,
    chartSlots: Number(detail.chart_slots || 1),
  };
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = String(req.query.id || '').trim();
  try {
    if (!userId) throw new AdminAuthError(400, 'USER_ID_REQUIRED', 'userId is required');

    if (req.method === 'GET') {
      const ctx = await requireAdminPermission(req, 'users.view');
      // The birth city and question texts are personal: only with the right and an explicit request.
      const includePrivate = (req.query.pii === '1' || req.query.pii === 'true') && roleHasPermission(ctx.role, 'user.pii.view');
      const story = await getPersonStory(userId, { days: Number(req.query.days) || 30, includePrivate });
      if (!story) throw new AdminAuthError(404, 'USER_NOT_FOUND', 'User not found');
      const detail = await db.admin.getUserDetail(userId).catch(() => null);
      if (includePrivate) {
        await recordAdminAction({ req, actor: ctx, action: 'pii_viewed', entityType: 'user', entityId: userId });
      }
      return res.status(200).json({ ...story, account: detail ? account(detail) : null, privateShown: includePrivate });
    }

    if (req.method === 'PATCH') {
      const body = req.body || {};
      const togglingBlock = typeof body.isBlocked === 'boolean';
      // Блокировка требует users.block; прочие правки — users.edit.
      const ctx = togglingBlock
        ? await requireAdminPermission(req, 'users.block')
        : await requireAdminPermission(req, 'users.edit');

      const before = await db.admin.getUserDetail(userId);
      if (!before) throw new AdminAuthError(404, 'USER_NOT_FOUND', 'User not found');

      const patch: any = {};
      if (typeof body.name === 'string') patch.name = body.name;
      if (body.language === 'ru' || body.language === 'en') patch.language = body.language;
      if (typeof body.chartSlots === 'number') patch.chartSlots = body.chartSlots;

      await db.admin.updateUser(userId, patch);
      if (togglingBlock) {
        await setAccountBlockedState(userId, body.isBlocked);
      }
      const after = await db.admin.getUserDetail(userId);

      await recordAdminAction({
        req,
        actor: ctx,
        action: togglingBlock ? (body.isBlocked ? 'user_blocked' : 'user_unblocked') : 'user_edited',
        entityType: 'user',
        entityId: userId,
        before: { name: before.name, isBlocked: before.is_blocked, chartSlots: before.chart_slots },
        after: { name: after?.name, isBlocked: after?.is_blocked, chartSlots: after?.chart_slots },
      });

      return res.status(200).json({ account: account(after) });
    }

    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    return handleAdminError(res, error);
  }
}

export default withAdminSource(handler);
