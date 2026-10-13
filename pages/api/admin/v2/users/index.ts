import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError } from '../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../lib/admin/rbac';
import { withAdminSource } from '../../../../../lib/admin/dataSource';
import { listPeople } from '../../../../../lib/admin/people';

/** «Люди»: search by ID, name or sign-in name, quick segments, newest activity first. */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    await requireAdminPermission(req, 'users.view');
    return res.status(200).json(await listPeople({
      q: typeof req.query.q === 'string' ? req.query.q : '',
      segment: typeof req.query.segment === 'string' ? req.query.segment : 'all',
      limit: Number(req.query.limit) || 50,
      offset: Number(req.query.offset) || 0,
    }));
  } catch (error) {
    return handleAdminError(res, error);
  }
}

export default withAdminSource(handler);
