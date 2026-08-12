import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../../lib/adminAuth';
import { requireAppUser } from '../../../../../lib/auth/appAuth';
import { beginOAuth, type AuthPurpose } from '../../../../../lib/auth/accountIdentity';
import { consumeAuthRateLimit, getAuthClientKey } from '../../../../../lib/auth/authRateLimit';
import {
  createOAuthBrowserBinding,
  hashOAuthBrowserBinding,
  setOAuthBrowserBindingCookie,
} from '../../../../../lib/auth/oauthBrowserBinding';

const PROVIDERS = ['vk', 'yandex'] as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const provider = String(req.query.provider || '') as typeof PROVIDERS[number];
    if (!PROVIDERS.includes(provider)) throw new AdminAuthError(400, 'AUTH_PROVIDER_INVALID', 'Unsupported provider');
    if (req.body?.native === true) {
      throw new AdminAuthError(
        410,
        'NATIVE_BROWSER_OAUTH_RETIRED',
        'Use the native Android provider sign-in flow',
      );
    }
    await consumeAuthRateLimit({
      scope: 'oauth_browser_start_client',
      key: getAuthClientKey(req),
      maxAttempts: 30,
      windowMs: 15 * 60 * 1000,
    });
    await consumeAuthRateLimit({
      scope: 'oauth_browser_start_global',
      key: 'global',
      maxAttempts: 2_000,
      windowMs: 15 * 60 * 1000,
    });
    const purpose: AuthPurpose = req.body?.purpose === 'link' ? 'link' : 'login';
    let currentUserId: string | null = null;
    let requiredSession: { userId: string; sessionId: string } | undefined;
    if (purpose === 'link') {
      const linkingSession = await requireAppUser(req, { allowGuest: true });
      if (!linkingSession.sessionId) {
        throw new AdminAuthError(401, 'APP_SESSION_REVOKED', 'This session is no longer valid');
      }
      currentUserId = linkingSession.userId;
      requiredSession = {
        userId: linkingSession.userId,
        sessionId: linkingSession.sessionId,
      };
    }
    const configuredPublicOrigin = String(process.env.PUBLIC_APP_ORIGIN || '').replace(/\/+$/, '');
    if (!configuredPublicOrigin.startsWith('https://')) {
      throw new AdminAuthError(503, 'PUBLIC_APP_ORIGIN_REQUIRED', 'PUBLIC_APP_ORIGIN must use HTTPS');
    }
    const redirectUri = `${configuredPublicOrigin}/api/auth/oauth/${provider}/callback`;
    const browserBinding = createOAuthBrowserBinding();
    const result = await beginOAuth({
      provider,
      purpose,
      currentUserId,
      redirectUri,
      browserBindingHash: hashOAuthBrowserBinding(browserBinding),
      requiredSession,
    });
    setOAuthBrowserBindingCookie(res, browserBinding);
    return res.status(200).json(result);
  } catch (error) {
    return handleAdminError(res, error);
  }
}
