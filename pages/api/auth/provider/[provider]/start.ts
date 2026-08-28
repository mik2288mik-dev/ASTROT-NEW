import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../../lib/adminAuth';
import { requireAppUser } from '../../../../../lib/auth/appAuth';
import { consumeAuthRateLimit, getAuthClientKey } from '../../../../../lib/auth/authRateLimit';
import {
  beginNativeProviderAuth,
  NATIVE_AUTH_PROVIDERS,
  sanitizeNativeProviderAuthError,
  type NativeAuthProvider,
  type NativeAuthPurpose,
} from '../../../../../lib/auth/nativeProviderAuth';
import { startServerOperationalDiagnostic } from '../../../../../lib/serverOperationalDiagnostics';

function providerFromRequest(req: NextApiRequest): NativeAuthProvider {
  const value = Array.isArray(req.query.provider) ? req.query.provider[0] : req.query.provider;
  const provider = String(value || '') as NativeAuthProvider;
  if (!NATIVE_AUTH_PROVIDERS.includes(provider)) {
    throw new AdminAuthError(400, 'AUTH_PROVIDER_INVALID', 'Unsupported sign-in provider');
  }
  return provider;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const diagnostic = startServerOperationalDiagnostic(req, res, 'auth_provider');
  if (req.method !== 'POST') {
    diagnostic.log('challenge_request', 'error', { httpStatus: 405, errorCode: 'METHOD_NOT_ALLOWED' });
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  try {
    const provider = providerFromRequest(req);
    const purpose: NativeAuthPurpose = req.body?.purpose === 'link' ? 'link' : 'login';
    diagnostic.log('challenge_request', 'start', { provider, operation: purpose });
    const currentUserId = purpose === 'link'
      ? (await requireAppUser(req, { allowGuest: true, allowTelegramProof: false })).userId
      : null;
    const clientKey = getAuthClientKey(req);
    await consumeAuthRateLimit({
      scope: 'native_provider_start_client',
      key: clientKey,
      maxAttempts: 30,
      windowMs: 15 * 60 * 1000,
    });
    await consumeAuthRateLimit({
      scope: 'native_provider_start_global',
      key: 'global',
      maxAttempts: 2_000,
      windowMs: 15 * 60 * 1000,
    });
    const result = await beginNativeProviderAuth({ provider, purpose, currentUserId });
    diagnostic.log('challenge_received', 'ok', { provider, operation: purpose, httpStatus: 200 });
    return res.status(200).json(result);
  } catch (error) {
    const safeError = sanitizeNativeProviderAuthError(error);
    diagnostic.error('challenge_request', error, 'PROVIDER_AUTH_START_FAILED');
    return handleAdminError(res, safeError);
  }
}
