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
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const provider = providerFromRequest(req);
    const purpose: NativeAuthPurpose = req.body?.purpose === 'link' ? 'link' : 'login';
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
    return res.status(200).json(result);
  } catch (error) {
    return handleAdminError(res, sanitizeNativeProviderAuthError(error));
  }
}
