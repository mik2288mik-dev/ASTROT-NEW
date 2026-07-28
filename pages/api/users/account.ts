import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAppUser } from '../../../lib/auth/appAuth';
import { getPool } from '../../../lib/db';
import { handleAdminError } from '../../../lib/adminAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const auth = await requireAppUser(req, { allowGuest: true });
    const result = await getPool().query('DELETE FROM users WHERE id = $1 RETURNING id', [auth.userId]);
    if (!result.rowCount) return res.status(404).json({ error: 'ACCOUNT_NOT_FOUND' });
    res.setHeader('Set-Cookie', 'lumia_app_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
    return res.status(200).json({ deleted: true });
  } catch (error) { return handleAdminError(res, error); }
}
