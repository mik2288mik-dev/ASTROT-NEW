import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminAccess, handleAdminError } from '../../../../lib/adminAuth';
import { db } from '../../../../lib/db';
import { serializeAdminUserSummary, serializeAdminUsersOverview } from '../../../../lib/adminSerializers';
import type { AdminSortOrder, AdminUserSortBy } from '../../../../types';

function isValidUserSortBy(value: unknown): value is AdminUserSortBy {
  return value === 'last_seen'
    || value === 'created_at'
    || value === 'premium_until'
    || value === 'saved_charts_count'
    || value === 'name';
}

function isValidSortOrder(value: unknown): value is AdminSortOrder {
  return value === 'asc' || value === 'desc';
}

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
      || req.query.segment === 'lumi'
      || req.query.segment === 'active_7d'
      || req.query.segment === 'inactive_3d'
      || req.query.segment === 'inactive_7d'
      || req.query.segment === 'inactive_30d'
      || req.query.segment === 'need_attention'
      ? req.query.segment
      : 'all';
    const pageRaw = typeof req.query.page === 'string' ? parseInt(req.query.page, 10) : 1;
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const pageSizeRaw = typeof req.query.pageSize === 'string'
      ? parseInt(req.query.pageSize, 10)
      : (typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 25);
    const pageSize = Math.min(Math.max(Number.isFinite(pageSizeRaw) ? pageSizeRaw : 25, 1), 100);
    const sortBy = isValidUserSortBy(req.query.sortBy) ? req.query.sortBy : 'last_seen';
    const sortOrder = isValidSortOrder(req.query.sortOrder) ? req.query.sortOrder : 'desc';

    const [usersPayload, overview] = await Promise.all([
      db.admin.listUsers({ q, premium, segment, page, pageSize, sortBy, sortOrder }),
      db.admin.getUsersOverview(),
    ]);
    return res.status(200).json({
      users: usersPayload.users.map(serializeAdminUserSummary),
      overview: serializeAdminUsersOverview(overview),
      pagination: usersPayload.pagination,
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
