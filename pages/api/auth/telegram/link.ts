import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, getVerifiedTelegramUser, handleAdminError } from '../../../../lib/adminAuth';
import {
  appSessionResponse,
  createAppUserSession,
  requireAppUser,
  setAppSessionCookie,
  type AppUserContext,
} from '../../../../lib/auth/appAuth';
import { resolveVerifiedIdentity } from '../../../../lib/auth/accountIdentity';
import { toPublicAppProfile } from '../../../../lib/auth/profile';
import { db } from '../../../../lib/db';
import { readClientRuntimeMetadata } from '../../../../lib/clientRuntimeMetadata';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    // The current app session is kept in Authorization/cookie. Telegram proof is
    // supplied separately so it cannot replace the account being linked.
    const authReq = Object.create(req) as NextApiRequest;
    authReq.headers = { ...req.headers };
    delete authReq.headers['x-telegram-init-data'];
    const auth = await requireAppUser(authReq, { allowGuest: true });
    if (!auth.sessionId) {
      throw new AdminAuthError(401, 'APP_SESSION_REVOKED', 'This session is no longer valid');
    }
    const telegramReq = Object.create(req) as NextApiRequest;
    telegramReq.headers = {
      ...req.headers,
      'x-telegram-init-data': String(req.body?.initData || ''),
    };
    const telegram = getVerifiedTelegramUser(telegramReq);
    await resolveVerifiedIdentity(
      {
        provider: 'telegram',
        subject: telegram.id,
        displayName: [telegram.rawUser.first_name, telegram.rawUser.last_name].filter(Boolean).join(' ') || null,
        metadata: { username: telegram.rawUser.username || null },
      },
      auth.userId,
      {
        requiredSession: {
          userId: auth.userId,
          sessionId: auth.sessionId,
        },
      },
    );
    let nextAuth: AppUserContext = { ...auth, isGuest: false };
    let rotatedSession: Record<string, unknown> = {};
    if (auth.isGuest) {
      const kind = auth.provider === 'native' ? 'native' : 'web';
      const session = await createAppUserSession({
        userId: auth.userId,
        kind,
        notificationContext: readClientRuntimeMetadata(req.headers, kind === 'native' ? 'native' : 'telegram'),
        loginProvider: 'telegram',
        sessionVersion: req.body?.sessionVersion === 2 ? 2 : 1,
      });
      if (kind === 'web') {
        if (session.refreshToken) setAppSessionCookie(res, session.token, session.refreshToken);
        else setAppSessionCookie(res, session.token);
      }
      rotatedSession = session.sessionVersion === 2
        ? appSessionResponse(session, kind === 'native')
        : (kind === 'native' ? { token: session.token } : {});
      nextAuth = {
        userId: auth.userId,
        provider: kind === 'native' ? 'native' : 'web_guest',
        isGuest: false,
        telegramUserId: telegram.id,
        sessionId: session.sessionId,
      };
    }
    const user = await db.users.get(auth.userId);
    return res.status(200).json({
      ok: true,
      userId: auth.userId,
      ...rotatedSession,
      profile: toPublicAppProfile(user, nextAuth),
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
