import type { NextApiRequest, NextApiResponse } from 'next';
import { getPool } from '../../../../lib/db';
import { AdminAuthError, handleAdminError } from '../../../../lib/adminAuth';
import { requireAppUser } from '../../../../lib/auth/appAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  const userId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : '';
  const startParam = typeof req.body?.startParam === 'string' ? req.body.startParam.trim() : '';
  if (!/^-?\d{1,18}$/.test(userId) || !/^[A-Za-z0-9_-]{1,64}$/.test(startParam)) {
    return res.status(400).json({ error: 'ACQUISITION_KEY_INVALID' });
  }
  try {
    await requireAppUser(req, { expectedUserId: userId, allowGuest: false });
  } catch (error) {
    if (error instanceof AdminAuthError) return handleAdminError(res, error);
    throw error;
  }
  try {
    await getPool().query(`INSERT INTO user_acquisition_keys (user_id, source, campaign_key)
      VALUES ($1, 'telegram', $2)
      ON CONFLICT (user_id) DO NOTHING`, [userId, startParam]);
    return res.status(200).json({ ok: true });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
