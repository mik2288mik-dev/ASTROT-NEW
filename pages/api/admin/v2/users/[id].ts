import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../../lib/adminAuth';
import { getAdminContext, requireAdminPermission, roleHasPermission } from '../../../../../lib/admin/rbac';
import { recordAdminAction } from '../../../../../lib/admin/audit';
import { db } from '../../../../../lib/db';

const MASK = '•••';

function serialize(detail: any, showPii: boolean) {
  const piiDate = showPii ? detail.birth_date : (detail.birth_date ? MASK : null);
  return {
    id: String(detail.id),
    name: detail.name,
    isPremium: detail.is_premium,
    premiumUntil: detail.premium_until,
    loginStreak: detail.login_streak,
    chartSlots: detail.chart_slots,
    isBlocked: detail.is_blocked,
    isAdmin: detail.is_admin,
    savedCharts: detail.saved_charts_count,
    createdAt: detail.created_at,
    lastSeenAt: detail.last_seen_at,
    currentDevice: detail.current_device_label,
    // PII — маскируется по умолчанию; раскрывается только с правом user.pii.view + ?pii=1
    pii: {
      revealed: showPii,
      birthDate: piiDate,
      birthTime: showPii ? detail.birth_time : (detail.birth_time ? MASK : null),
      birthPlace: showPii ? detail.birth_place : (detail.birth_place ? MASK : null),
    },
    primaryChart: detail.primary_chart
      ? {
          id: detail.primary_chart.id,
          name: detail.primary_chart.name,
          birthDate: showPii ? detail.primary_chart.birth_date : (detail.primary_chart.birth_date ? MASK : null),
          birthTime: showPii ? detail.primary_chart.birth_time : (detail.primary_chart.birth_time ? MASK : null),
          birthPlace: showPii ? detail.primary_chart.birth_place : (detail.primary_chart.birth_place ? MASK : null),
        }
      : null,
    recentSessions: detail.recent_sessions,
    latestStarsPayment: detail.latest_stars_payment,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = String(req.query.id || '').trim();
  try {
    if (!userId) throw new AdminAuthError(400, 'USER_ID_REQUIRED', 'userId is required');

    if (req.method === 'GET') {
      const ctx = await requireAdminPermission(req, 'users.view');
      const wantsPii = req.query.pii === '1' || req.query.pii === 'true';
      const canPii = roleHasPermission(ctx.role, 'user.pii.view');
      const showPii = wantsPii && canPii;

      const detail = await db.admin.getUserDetail(userId);
      if (!detail) throw new AdminAuthError(404, 'USER_NOT_FOUND', 'User not found');

      if (showPii) {
        await recordAdminAction({
          req, actor: ctx, action: 'pii_viewed', entityType: 'user', entityId: userId,
        });
      }
      return res.status(200).json({ user: serialize(detail, showPii) });
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
      if (typeof body.isBlocked === 'boolean') patch.isBlocked = body.isBlocked;

      await db.admin.updateUser(userId, patch);
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

      return res.status(200).json({ user: serialize(after, false) });
    }

    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
