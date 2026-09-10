import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../../lib/db';
import { handleAdminError } from '../../../../lib/adminAuth';
import {
  appSessionResponse,
  createPasswordAppUserSession,
  setAppSessionCookie,
} from '../../../../lib/auth/appAuth';
import { getAuthClientKey } from '../../../../lib/auth/authRateLimit';
import { readClientRuntimeMetadata } from '../../../../lib/clientRuntimeMetadata';
import {
  authenticateEmailPassword,
  sanitizeEmailPasswordError,
} from '../../../../lib/auth/emailPassword';
import { toPublicAppProfile } from '../../../../lib/auth/profile';
import { startServerOperationalDiagnostic } from '../../../../lib/serverOperationalDiagnostics';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const diagnostic = startServerOperationalDiagnostic(req, res, 'auth_email', { operation: 'login' });
  if (req.method !== 'POST') {
    diagnostic.log('request', 'error', { httpStatus: 405, errorCode: 'METHOD_NOT_ALLOWED' });
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
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
      notificationContext: readClientRuntimeMetadata(req.headers, kind),
      loginProvider: 'password',
      deviceId: typeof req.body?.deviceId === 'string' ? req.body.deviceId : null,
      sessionVersion: req.body?.sessionVersion === 2 ? 2 : 1,
    });
    if (kind === 'web') {
      if (session.refreshToken) setAppSessionCookie(res, session.token, session.refreshToken);
      else setAppSessionCookie(res, session.token);
    }
    const user = await db.users.get(result.userId);
    diagnostic.log('finished', 'ok', { httpStatus: 200, runtime: kind === 'native' ? 'native' : 'browser' });
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
    const safeError = sanitizeEmailPasswordError(error);
    diagnostic.error('finished', error, 'EMAIL_PASSWORD_LOGIN_FAILED');
    return handleAdminError(res, safeError);
  }
}
