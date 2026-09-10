import type { NextApiRequest, NextApiResponse } from 'next';
import {
  clearAppSessionCookie,
  readAppRefreshCookie,
  requireAppUser,
  revokeAppSession,
} from '../../../../lib/auth/appAuth';
import { refreshAppUserSession } from '../../../../lib/auth/appSessionRefresh';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  res.setHeader('Cache-Control', 'no-store');
  try {
    const auth = await requireAppUser(req, { allowGuest: true });
    if (auth.sessionId) {
      await revokeAppSession(auth.sessionId, Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 60);
    }
    clearAppSessionCookie(res);
    return res.status(200).json({ ok: true });
  } catch (error: any) {
    const refreshCredential = readAppRefreshCookie(req);
    if (error?.status === 401 && refreshCredential) {
      try {
        const refreshed = await refreshAppUserSession({
          credential: refreshCredential,
          expectedKind: 'web',
        });
        await revokeAppSession(
          refreshed.sessionId,
          refreshed.absoluteExpiresAt || Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
        );
        clearAppSessionCookie(res);
        return res.status(200).json({ ok: true });
      } catch (refreshError: any) {
        if (!refreshError?.status || refreshError.status >= 500) {
          return res.status(refreshError?.status || 500).json({
            error: refreshError?.code || 'LOGOUT_FAILED',
          });
        }
      }
    }
    if (error?.status === 401 || (error?.status === 403 && error?.code === 'ACCOUNT_BLOCKED')) {
      // An expired, revoked, malformed, or blocked session is already unusable
      // on the server. Clearing the cookie makes logout safely idempotent.
      clearAppSessionCookie(res);
      return res.status(200).json({ ok: true, alreadySignedOut: true });
    }
    return res.status(error?.status || 500).json({ error: error?.code || 'LOGOUT_FAILED' });
  }
}
