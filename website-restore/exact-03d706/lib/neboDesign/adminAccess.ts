import type { NextApiRequest } from 'next';
import { requireAppUser } from '../auth/appAuth';
import { AdminAuthError, getConfiguredOwnerId } from '../adminAuth';
import { getPool } from '../db';
import { resolveAdminPreviewAccess } from './contract';
/** Authenticate native and Telegram sessions; a client isAdmin flag is insufficient. */
export async function requireDesignPreviewAdmin(req: NextApiRequest): Promise<string> {
  const auth = await requireAppUser(req, { allowGuest: true });
  const ownerId = String(getConfiguredOwnerId() || '');
  const { rows } = await getPool().query(
    `SELECT u.is_admin, u.is_blocked, a.role, a.status,
       EXISTS(SELECT 1 FROM account_identities i WHERE i.user_id = u.id
              AND i.provider = 'telegram' AND i.provider_subject = $2) AS owner_identity
     FROM users u LEFT JOIN admin_users a ON a.user_id = u.id WHERE u.id = $1 LIMIT 1`,
    [auth.userId, ownerId],
  );
  if (!resolveAdminPreviewAccess(rows[0] || null, !!ownerId && String(auth.userId) === ownerId, process.env.NEBO_ADMIN_DESIGN_PREVIEW_DISABLED === '1')) throw new AdminAuthError(403, 'ADMIN_REQUIRED', 'Admin access is required');
  return String(auth.userId);
}
