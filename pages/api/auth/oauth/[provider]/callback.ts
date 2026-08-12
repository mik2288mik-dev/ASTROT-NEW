import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../../lib/adminAuth';
import { finishOAuth } from '../../../../../lib/auth/accountIdentity';
import { requireOAuthBrowserBinding } from '../../../../../lib/auth/oauthBrowserBinding';

const PROVIDERS = ['vk', 'yandex', 'google'] as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const provider = String(req.query.provider || '') as typeof PROVIDERS[number];
    if (!PROVIDERS.includes(provider)) throw new AdminAuthError(400, 'AUTH_PROVIDER_INVALID', 'Unsupported provider');
    const result = await finishOAuth({
      provider,
      code: String(req.query.code || ''),
      state: String(req.query.state || ''),
      deviceId: typeof req.query.device_id === 'string' ? req.query.device_id : undefined,
      browserBinding: requireOAuthBrowserBinding(req),
    });
    res.redirect(302, `/auth/complete?code=${encodeURIComponent(result.exchangeCode)}`);
  } catch (error) {
    return handleAdminError(res, error);
  }
}
