import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError } from '../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../lib/admin/rbac';
import { listAuditEntries } from '../../../../../lib/admin/audit';

/** Журнал действий админов (только чтение). Право audit.view. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    await requireAdminPermission(req, 'audit.view');
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 50, 1), 200);
    const { entries, total } = await listAuditEntries({
      action: typeof req.query.action === 'string' ? req.query.action : null,
      actorUserId: typeof req.query.actorUserId === 'string' ? req.query.actorUserId : null,
      entityType: typeof req.query.entityType === 'string' ? req.query.entityType : null,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return res.status(200).json({
      entries,
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
