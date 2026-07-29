import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../../lib/adminAuth';
import { finishOAuth } from '../../../../../lib/auth/accountIdentity';

const PROVIDERS = ['vk', 'yandex', 'google'] as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const provider = String(req.query.provider || '') as typeof PROVIDERS[number];
    if (!PROVIDERS.includes(provider)) throw new AdminAuthError(400, 'AUTH_PROVIDER_INVALID', 'Unsupported provider');
    const result = await finishOAuth({
      provider,
      code: String(req.query.code || ''),
      state: String(req.query.state || ''),
    });
    const scheme = String(process.env.NATIVE_AUTH_CALLBACK_SCHEME || 'yourhoroscope').trim();
    const target = result.native
      ? `${scheme}://auth/callback?code=${encodeURIComponent(result.exchangeCode)}`
      : `/auth/complete?code=${encodeURIComponent(result.exchangeCode)}`;
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(302, target);
  } catch (error) {
    return handleAdminError(res, error);
  }
}
