import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminAccess, handleAdminError } from '../../../../../lib/adminAuth';
import { db } from '../../../../../lib/db';
import { serializeAdminUserDetail } from '../../../../../lib/adminSerializers';

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  const { id } = req.query;
  const userId = Array.isArray(id) ? id[0] : id;
  if (!userId) {
    return res.status(400).json({ error: 'USER_ID_REQUIRED', message: 'User ID is required' });
  }

  try {
    await requireAdminAccess(req);

    const action = req.body?.action;
    if (action !== 'grant' && action !== 'revoke') {
      return res.status(400).json({ error: 'INVALID_ACTION', message: 'Action must be grant or revoke' });
    }

    const user = await db.users.get(userId);
    if (!user) {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found' });
    }

    if (action === 'grant') {
      const daysRaw = Number(req.body?.days);
      const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(Math.round(daysRaw), 3650) : 30;
      const now = Date.now();
      const existingUntil = user.premium_until ? new Date(user.premium_until).getTime() : 0;
      const baseTime = existingUntil > now ? existingUntil : now;
      await db.users.setPremiumUntil(userId, new Date(baseTime + days * DAY_MS).toISOString());
    } else {
      await db.users.setPremiumUntil(userId, null);
    }

    const updated = await db.admin.getUserDetail(userId);
    return res.status(200).json({
      user: updated ? serializeAdminUserDetail(updated) : null,
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
