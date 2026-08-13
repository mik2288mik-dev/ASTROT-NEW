import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../../../lib/db';
import { AdminAuthError, handleAdminError } from '../../../../../lib/adminAuth';
import {
  APP_SESSION_COOKIE,
  createAppUserSession,
  requireAppUser,
} from '../../../../../lib/auth/appAuth';
import { consumeAuthRateLimit, getAuthClientKey } from '../../../../../lib/auth/authRateLimit';
import {
  completeNativeProviderAuth,
  NATIVE_AUTH_PROVIDERS,
  sanitizeNativeProviderAuthError,
  type NativeAuthProvider,
} from '../../../../../lib/auth/nativeProviderAuth';
import { toPublicAppProfile } from '../../../../../lib/auth/profile';

function providerFromRequest(req: NextApiRequest): NativeAuthProvider {
  const value = Array.isArray(req.query.provider) ? req.query.provider[0] : req.query.provider;
  const provider = String(value || '') as NativeAuthProvider;
  if (!NATIVE_AUTH_PROVIDERS.includes(provider)) {
    throw new AdminAuthError(400, 'AUTH_PROVIDER_INVALID', 'Unsupported sign-in provider');
  }
  return provider;
}

function hasExplicitAppSession(req: NextApiRequest): boolean {
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
    const provider = providerFromRequest(req);
    await consumeAuthRateLimit({
      scope: 'native_provider_complete_client',
      key: getAuthClientKey(req),
      maxAttempts: 60,
      windowMs: 15 * 60 * 1000,
    });
    // A link challenge is only accepted when this request re-authenticates the
    // same internal account stored at challenge creation. Login requests do not
    // need an existing session, but an explicitly supplied invalid one is never ignored.
    const currentAuth = hasExplicitAppSession(req)
      ? await requireAppUser(req, { allowGuest: true, allowTelegramProof: false })
      : null;
    const result = await completeNativeProviderAuth({
      provider,
      challengeId: String(req.body?.challengeId || ''),
      credential: {
        idToken: req.body?.idToken,
        accessToken: req.body?.accessToken,
        code: req.body?.code,
        deviceId: req.body?.deviceId,
        state: req.body?.state,
      },
      currentUserId: currentAuth?.userId || null,
      currentSessionId: currentAuth?.sessionId || null,
    });
    const session = await createAppUserSession({
      userId: result.userId,
      kind: 'native',
      deviceId: typeof req.body?.appDeviceId === 'string' ? req.body.appDeviceId : null,
    });
    const user = await db.users.get(result.userId);
    return res.status(200).json({
      token: session.token,
      profile: toPublicAppProfile(user, {
        userId: result.userId,
        provider: 'native',
        isGuest: false,
        sessionId: session.sessionId,
      }),
    });
  } catch (error) {
    return handleAdminError(res, sanitizeNativeProviderAuthError(error));
  }
}
