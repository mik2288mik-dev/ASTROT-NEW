import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../../lib/db';
import { handleAdminError } from '../../../../lib/adminAuth';
import {
  appSessionResponse,
  createPasswordAppUserSession,
  setAppSessionCookie,
} from '../../../../lib/auth/appAuth';
import { getAuthClientKey } from '../../../../lib/auth/authRateLimit';
import {
  authenticateEmailPassword,
  sanitizeEmailPasswordError,
} from '../../../../lib/auth/emailPassword';
import { toPublicAppProfile } from '../../../../lib/auth/profile';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const result = await authenticateEmailPassword({
      email: String(req.body?.email || ''),
      password: String(req.body?.password || ''),
      clientKey: getAuthClientKey(req),
    });
    const kind = req.body?.native === true ? 'native' : 'web';
    const session = await createPasswordAppUserSession({
      userId: result.userId,
      passwordVersion: result.passwordVersion,
      kind,
      deviceId: typeof req.body?.deviceId === 'string' ? req.body.deviceId : null,
      sessionVersion: req.body?.sessionVersion === 2 ? 2 : 1,
    });
    if (kind === 'web') {
      if (session.refreshToken) setAppSessionCookie(res, session.token, session.refreshToken);
      else setAppSessionCookie(res, session.token);
    }
    const user = await db.users.get(result.userId);
    return res.status(200).json({
      ...(session.sessionVersion === 2
        ? appSessionResponse(session, kind === 'native')
        : (kind === 'native' ? { token: session.token } : {})),
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
