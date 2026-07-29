import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../../lib/db';
import { handleAdminError } from '../../../../lib/adminAuth';
import {
  createAppUserSession,
  setAppSessionCookie,
} from '../../../../lib/auth/appAuth';
import { verifyEmailCode } from '../../../../lib/auth/accountIdentity';
import { toPublicAppProfile } from '../../../../lib/auth/profile';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const result = await verifyEmailCode({
      challengeId: String(req.body?.challengeId || ''),
      code: String(req.body?.code || ''),
    });
    const kind = req.body?.native === true ? 'native' : 'web';
    const session = await createAppUserSession({
      userId: result.userId,
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
    return handleAdminError(res, error);
  }
}
