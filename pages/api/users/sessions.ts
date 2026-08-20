import type { NextApiRequest, NextApiResponse } from 'next';
import { clearAppSessionCookie, requireAppUser } from '../../../lib/auth/appAuth';
import { revokeSessions } from '../../../lib/auth/accountIdentity';
import { handleAdminError } from '../../../lib/adminAuth';
import { getPool } from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const auth = await requireAppUser(req, { allowGuest: true });
    if (req.method === 'GET') {
      const result = await getPool().query(
        `SELECT session_id, session_kind, device_id, created_at, last_seen_at, expires_at,
                session_version, absolute_expires_at,
                (session_id = $2) AS current
         FROM app_sessions
         WHERE user_id = $1
           AND revoked_at IS NULL
           AND expires_at > clock_timestamp()
           AND (session_version = 1 OR absolute_expires_at > clock_timestamp())
         ORDER BY last_seen_at DESC`,
        [auth.userId, auth.sessionId || ''],
      );
      return res.status(200).json({
        sessions: result.rows.map((row) => ({
          id: row.session_id,
          kind: row.session_kind,
          deviceId: row.device_id,
          createdAt: row.created_at,
          lastSeenAt: row.last_seen_at,
          expiresAt: row.expires_at,
          absoluteExpiresAt: row.absolute_expires_at,
          sessionVersion: Number(row.session_version || 1),
          current: row.current === true,
        })),
      });
    }
    if (req.method === 'DELETE') {
      const scope = req.body?.scope === 'current' ? 'current' : 'all';
      const revoked = await revokeSessions(
        auth.userId,
        scope === 'current' ? auth.sessionId || null : null,
      );
      clearAppSessionCookie(res);
      return res.status(200).json({ ok: true, revoked });
    }
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
