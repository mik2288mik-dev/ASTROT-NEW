import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminAccess, handleAdminError } from '../../../../lib/adminAuth';
import { db } from '../../../../lib/db';
import { serializeAdminUserSummary, serializeAdminUsersOverview } from '../../../../lib/adminSerializers';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }

  try {
    await requireAdminAccess(req);

    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const premium = req.query.premium === 'premium' || req.query.premium === 'free'
      ? req.query.premium
      : 'all';
    const segment = req.query.segment === 'premium'
      || req.query.segment === 'free'
      || req.query.segment === 'active_7d'
      || req.query.segment === 'inactive_30d'
      || req.query.segment === 'need_attention'
      ? req.query.segment
      : 'all';
    const limitRaw = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 100;
    const limit = Number.isFinite(limitRaw) ? limitRaw : 100;

    const [users, overview] = await Promise.all([
      db.admin.listUsers({ q, premium, segment, limit }),
      db.admin.getUsersOverview(),
    ]);
    return res.status(200).json({
      users: users.map(serializeAdminUserSummary),
      overview: serializeAdminUsersOverview(overview),
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
