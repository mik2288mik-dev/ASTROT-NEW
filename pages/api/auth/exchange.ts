import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import { handleAdminError } from '../../../lib/adminAuth';
import {
  appSessionResponse,
  createAppUserSession,
  setAppSessionCookie,
} from '../../../lib/auth/appAuth';
import { consumeAuthExchange } from '../../../lib/auth/accountIdentity';
import {
  clearOAuthBrowserBindingCookie,
  requireOAuthBrowserBinding,
} from '../../../lib/auth/oauthBrowserBinding';
import { toPublicAppProfile } from '../../../lib/auth/profile';
import { readClientRuntimeMetadata } from '../../../lib/clientRuntimeMetadata';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const browserBinding = requireOAuthBrowserBinding(req);
    const exchange = await consumeAuthExchange(String(req.body?.code || ''), browserBinding);
    const session = await createAppUserSession({
      userId: exchange.userId,
      kind: 'web',
      notificationContext: readClientRuntimeMetadata(req.headers, 'web'),
      deviceId: typeof req.body?.deviceId === 'string' ? req.body.deviceId : null,
      sessionVersion: req.body?.sessionVersion === 2 ? 2 : 1,
    });
    if (session.refreshToken) setAppSessionCookie(res, session.token, session.refreshToken);
    else setAppSessionCookie(res, session.token);
    clearOAuthBrowserBindingCookie(res);
    const user = await db.users.get(exchange.userId);
    return res.status(200).json({
      ...(session.sessionVersion === 2 ? appSessionResponse(session, false) : {}),
      profile: toPublicAppProfile(user, {
        userId: exchange.userId,
        provider: 'web_guest',
        isGuest: false,
        sessionId: session.sessionId,
      }),
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
