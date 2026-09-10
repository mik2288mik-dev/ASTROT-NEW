import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError } from '../../../../../lib/adminAuth';
import { cancelOAuth, finishOAuth } from '../../../../../lib/auth/accountIdentity';
import { requireOAuthBrowserBinding } from '../../../../../lib/auth/oauthBrowserBinding';

const PROVIDERS = ['vk', 'yandex', 'google'] as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  const provider = String(req.query.provider || '') as typeof PROVIDERS[number];
  if (!PROVIDERS.includes(provider)) {
    return res.status(400).json({ error: 'AUTH_PROVIDER_INVALID' });
  }
  const state = String(req.query.state || '');
  const providerError = String(req.query.error || '');
  try {
    const browserBinding = requireOAuthBrowserBinding(req);
    if (providerError) {
      await cancelOAuth({ provider, state, browserBinding });
      const status = providerError === 'access_denied' ? 'cancelled' : 'error';
      const code = providerError === 'access_denied' ? 'AUTH_CANCELLED' : 'AUTH_PROVIDER_REJECTED';
      return res.redirect(302, `/auth/complete?status=${status}&code=${code}`);
    }
    const code = String(req.query.code || '');
    if (!code) throw new AdminAuthError(400, 'OAUTH_CODE_MISSING', 'OAuth code is required');
    const result = await finishOAuth({
      provider,
      code,
      state,
      deviceId: typeof req.query.device_id === 'string' ? req.query.device_id : undefined,
      browserBinding,
    });
    return res.redirect(302, `/auth/complete?code=${encodeURIComponent(result.exchangeCode)}`);
  } catch (error) {
    const code = error instanceof AdminAuthError
      ? error.code
      : 'AUTH_PROVIDER_TEMPORARILY_UNAVAILABLE';
    return res.redirect(302, `/auth/complete?status=error&code=${encodeURIComponent(code)}`);
  }
}
