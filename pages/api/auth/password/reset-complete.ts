import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../../lib/db';
import { handleAdminError } from '../../../../lib/adminAuth';
import {
  createPasswordAppUserSession,
  setAppSessionCookie,
} from '../../../../lib/auth/appAuth';
import { getAuthClientKey } from '../../../../lib/auth/authRateLimit';
import {
  completePasswordReset,
  sanitizeEmailPasswordError,
} from '../../../../lib/auth/emailPassword';
import { toPublicAppProfile } from '../../../../lib/auth/profile';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const result = await completePasswordReset({
      challengeId: String(req.body?.challengeId || ''),
      code: String(req.body?.code || ''),
      password: String(req.body?.password || ''),
      passwordConfirmation: String(req.body?.passwordConfirmation || ''),
      clientKey: getAuthClientKey(req),
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
