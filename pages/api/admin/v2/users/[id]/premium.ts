import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../../lib/admin/rbac';
import { recordAdminAction } from '../../../../../../lib/admin/audit';
import { db, getPool } from '../../../../../../lib/db';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Выдать/снять Premium вручную. Право users.edit. Логируется в audit. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  const userId = String(req.query.id || '').trim();
  try {
    const ctx = await requireAdminPermission(req, 'users.edit');
    if (!userId) throw new AdminAuthError(400, 'USER_ID_REQUIRED', 'userId is required');

    const action = req.body?.action;
    if (action !== 'grant' && action !== 'revoke') {
      throw new AdminAuthError(400, 'INVALID_ACTION', 'Action must be grant or revoke');
    }

    const user = await db.users.get(userId);
    if (!user) throw new AdminAuthError(404, 'USER_NOT_FOUND', 'User not found');

    const beforeUntil = user.premium_until ?? null;
    let days = 0;
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      if (action === 'grant') {
        const daysRaw = Number(req.body?.days);
        days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(Math.round(daysRaw), 3650) : 30;
        const now = Date.now();
        const existingUntil = user.premium_until ? new Date(user.premium_until).getTime() : 0;
        const baseTime = existingUntil > now ? existingUntil : now;
        const giftEndsAt = new Date(baseTime + days * DAY_MS).toISOString();
        await client.query(
          'UPDATE users SET premium_until = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
          [userId, giftEndsAt],
        );
        await client.query(
          `INSERT INTO premium_entitlements (
             user_id, tier_name, status, entitlement_state, source, starts_at, ends_at, metadata
           ) VALUES ($1, 'premium', 'active', 'gift', 'admin_gift', CURRENT_TIMESTAMP, $2, $3::jsonb)
           ON CONFLICT (user_id, tier_name, ends_at, source) DO UPDATE
             SET status = 'active', entitlement_state = 'gift', metadata = EXCLUDED.metadata,
                 updated_at = CURRENT_TIMESTAMP`,
          [userId, giftEndsAt, JSON.stringify({ grantedBy: ctx.userId, days })],
        );
      } else {
        await client.query(
          'UPDATE users SET premium_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
          [userId],
        );
        await client.query(
          `UPDATE premium_entitlements
           SET status = 'expired', entitlement_state = 'expired', updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $1 AND source IN ('admin_gift', 'users.premium_until')`,
          [userId],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }

    const updated = await db.admin.getUserDetail(userId);
    await recordAdminAction({
      req,
      actor: ctx,
      action: action === 'grant' ? 'premium_granted' : 'premium_revoked',
      entityType: 'user',
      entityId: userId,
      before: { premiumUntil: beforeUntil },
      after: { premiumUntil: updated?.premium_until ?? null, days: action === 'grant' ? days : 0 },
    });

    return res.status(200).json({
      user: updated
        ? { id: String(updated.id), isPremium: updated.is_premium, premiumUntil: updated.premium_until }
        : null,
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
