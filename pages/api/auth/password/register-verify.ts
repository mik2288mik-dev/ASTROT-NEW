import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../../lib/db';
import { handleAdminError } from '../../../../lib/adminAuth';
import {
  APP_SESSION_COOKIE,
  createPasswordAppUserSession,
  requireAppUser,
  setAppSessionCookie,
} from '../../../../lib/auth/appAuth';
import { getAuthClientKey } from '../../../../lib/auth/authRateLimit';
import {
  completeEmailPasswordRegistration,
  sanitizeEmailPasswordError,
} from '../../../../lib/auth/emailPassword';
import { toPublicAppProfile } from '../../../../lib/auth/profile';

function hasSession(req: NextApiRequest): boolean {
  if (req.headers.authorization) return true;
  const rawCookie = Array.isArray(req.headers.cookie)
    ? req.headers.cookie.join(';')
    : String(req.headers.cookie || '');
  return rawCookie.split(';').some((part) => part.trim().startsWith(`${APP_SESSION_COOKIE}=`));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const currentAuth = hasSession(req)
      ? await requireAppUser(req, { allowGuest: true, allowTelegramProof: false })
      : null;
    const result = await completeEmailPasswordRegistration({
      challengeId: String(req.body?.challengeId || ''),
      code: String(req.body?.code || ''),
      clientKey: getAuthClientKey(req),
      currentUserId: currentAuth?.userId || null,
      currentSessionId: currentAuth?.sessionId || null,
    });
    const kind = req.body?.native === true ? 'native' : 'web';
    const session = await createPasswordAppUserSession({
      userId: result.userId,
      passwordVersion: result.passwordVersion,
      kind,
      deviceId: typeof req.body?.deviceId === 'string' ? req.body.deviceId : null,
    });
    if (kind === 'web') setAppSessionCookie(res, session.token);
    const user = await db.users.get(result.userId);
    return res.status(200).json({
      token: kind === 'native' ? session.token : undefined,
      profile: toPublicAppProfile(user, {
        userId: result.userId,
        provider: kind === 'native' ? 'native' : 'web_guest',
        isGuest: false,
        sessionId: session.sessionId,
      }),
    });
  } catch (error) {
    return handleAdminError(res, sanitizeEmailPasswordError(error));
  }
}
