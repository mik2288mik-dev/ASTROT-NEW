import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../../../lib/db';
import { AdminAuthError, handleAdminError } from '../../../../../lib/adminAuth';
import {
  APP_SESSION_COOKIE,
  appSessionResponse,
  createAppUserSession,
  requireAppUser,
} from '../../../../../lib/auth/appAuth';
import { consumeAuthRateLimit, getAuthClientKey } from '../../../../../lib/auth/authRateLimit';
import { readClientRuntimeMetadata } from '../../../../../lib/clientRuntimeMetadata';
import {
  completeNativeProviderAuth,
  NATIVE_AUTH_PROVIDERS,
  sanitizeNativeProviderAuthError,
  type NativeAuthProvider,
} from '../../../../../lib/auth/nativeProviderAuth';
import { toPublicAppProfile } from '../../../../../lib/auth/profile';
import { startServerOperationalDiagnostic } from '../../../../../lib/serverOperationalDiagnostics';

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
  const diagnostic = startServerOperationalDiagnostic(req, res, 'auth_provider');
  if (req.method !== 'POST') {
    diagnostic.log('server_complete', 'error', { httpStatus: 405, errorCode: 'METHOD_NOT_ALLOWED' });
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  try {
    const provider = providerFromRequest(req);
    diagnostic.log('server_complete', 'start', { provider, operation: 'login_or_link' });
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
      notificationContext: readClientRuntimeMetadata(req.headers, 'native'),
      loginProvider: provider,
      deviceId: typeof req.body?.appDeviceId === 'string' ? req.body.appDeviceId : null,
      sessionVersion: req.body?.sessionVersion === 2 ? 2 : 1,
    });
    const user = await db.users.get(result.userId);
    diagnostic.log('finished', 'ok', { provider, operation: 'login_or_link', httpStatus: 200 });
    return res.status(200).json({
      ...appSessionResponse(session, true),
      profile: toPublicAppProfile(user, {
        userId: result.userId,
        provider: 'native',
        isGuest: false,
        sessionId: session.sessionId,
      }),
    });
  } catch (error) {
    const safeError = sanitizeNativeProviderAuthError(error);
    diagnostic.error('server_complete', error, 'PROVIDER_AUTH_COMPLETE_FAILED');
    return handleAdminError(res, safeError);
  }
}
