import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminAccess, handleAdminError } from '../../../../lib/adminAuth';
import { db } from '../../../../lib/db';
import { serializeAdminUserDetail } from '../../../../lib/adminSerializers';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  const userId = Array.isArray(id) ? id[0] : id;
  if (!userId) {
    return res.status(400).json({ error: 'USER_ID_REQUIRED', message: 'User ID is required' });
  }

  try {
    await requireAdminAccess(req);

    if (req.method === 'DELETE') {
      await db.admin.deleteUser(userId);
      return res.status(200).json({ success: true });
    }

    if (req.method === 'PATCH') {
      const body = req.body || {};
      const patch: Parameters<typeof db.admin.updateUser>[1] = {};
      if (typeof body.name === 'string') patch.name = body.name.trim().slice(0, 120);
      if (typeof body.birthDate === 'string') patch.birthDate = body.birthDate.trim() || null;
      else if (body.birthDate === null) patch.birthDate = null;
      if (body.language === 'en' || body.language === 'ru') patch.language = body.language;
      if (body.chartSlots != null && Number.isFinite(Number(body.chartSlots))) {
        patch.chartSlots = Math.min(Math.max(Math.round(Number(body.chartSlots)), 1), 50);
      }
      if (typeof body.isBlocked === 'boolean') patch.isBlocked = body.isBlocked;
      await db.admin.updateUser(userId, patch);
      const updated = await db.admin.getUserDetail(userId);
      return res.status(200).json({ user: updated ? serializeAdminUserDetail(updated) : null });
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
    }

    const user = await db.admin.getUserDetail(userId);
    if (!user) {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found' });
    }

    return res.status(200).json({
      user: serializeAdminUserDetail(user),
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
