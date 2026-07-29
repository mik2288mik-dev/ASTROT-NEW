import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import { handleAdminError } from '../../../lib/adminAuth';
import {
  createAppUserSession,
  setAppSessionCookie,
} from '../../../lib/auth/appAuth';
import { consumeAuthExchange } from '../../../lib/auth/accountIdentity';
import { toPublicAppProfile } from '../../../lib/auth/profile';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const exchange = await consumeAuthExchange(String(req.body?.code || ''));
    const session = await createAppUserSession({
      userId: exchange.userId,
      kind: exchange.kind,
      deviceId: typeof req.body?.deviceId === 'string' ? req.body.deviceId : null,
    });
    if (exchange.kind === 'web') setAppSessionCookie(res, session.token);
    const user = await db.users.get(exchange.userId);
    return res.status(200).json({
      token: exchange.kind === 'native' ? session.token : undefined,
      profile: toPublicAppProfile(user, {
        userId: exchange.userId,
        provider: exchange.kind === 'native' ? 'native' : 'web_guest',
        isGuest: false,
        sessionId: session.sessionId,
      }),
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
