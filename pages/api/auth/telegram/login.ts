import type { NextApiRequest, NextApiResponse } from 'next';
import { getVerifiedTelegramUser, handleAdminError } from '../../../../lib/adminAuth';
import {
  createAppUserSession,
  setAppSessionCookie,
  type AppUserContext,
} from '../../../../lib/auth/appAuth';
import { resolveTelegramIdentityForLogin } from '../../../../lib/auth/accountIdentity';
import { toPublicAppProfile } from '../../../../lib/auth/profile';
import { db } from '../../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  try {
    const telegramReq = Object.create(req) as NextApiRequest;
    telegramReq.headers = {
      ...req.headers,
      'x-telegram-init-data': String(req.body?.initData || ''),
    };
    const telegram = getVerifiedTelegramUser(telegramReq);
    const identity = await resolveTelegramIdentityForLogin(
      {
        provider: 'telegram',
        subject: telegram.id,
        displayName: [telegram.rawUser.first_name, telegram.rawUser.last_name].filter(Boolean).join(' ') || null,
        metadata: { username: telegram.rawUser.username || null },
      },
      telegram.id,
    );
    const kind = req.body?.native === true ? 'native' : 'web';
    const session = await createAppUserSession({
      userId: identity.userId,
      kind,
      deviceId: typeof req.body?.deviceId === 'string' ? req.body.deviceId : null,
    });
    if (kind === 'web') setAppSessionCookie(res, session.token);

    const auth: AppUserContext = {
      userId: identity.userId,
      provider: kind === 'native' ? 'native' : 'web_guest',
      isGuest: false,
      telegramUserId: telegram.id,
      sessionId: session.sessionId,
    };
    const user = await db.users.get(identity.userId);
    return res.status(200).json({
      token: kind === 'native' ? session.token : undefined,
      profile: toPublicAppProfile(user, auth),
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
