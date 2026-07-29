import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../../lib/adminAuth';
import { requireAppUser } from '../../../../../lib/auth/appAuth';
import { beginOAuth, type AuthPurpose } from '../../../../../lib/auth/accountIdentity';

const PROVIDERS = ['vk', 'yandex', 'google'] as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const provider = String(req.query.provider || '') as typeof PROVIDERS[number];
    if (!PROVIDERS.includes(provider)) throw new AdminAuthError(400, 'AUTH_PROVIDER_INVALID', 'Unsupported provider');
    const purpose: AuthPurpose = req.body?.purpose === 'link' ? 'link' : 'login';
    let currentUserId: string | null = null;
    if (purpose === 'link') {
      currentUserId = (await requireAppUser(req, { allowGuest: true })).userId;
    }
    const configuredPublicOrigin = String(process.env.PUBLIC_APP_ORIGIN || '').replace(/\/+$/, '');
    if (!configuredPublicOrigin.startsWith('https://')) {
      throw new AdminAuthError(503, 'PUBLIC_APP_ORIGIN_REQUIRED', 'PUBLIC_APP_ORIGIN must use HTTPS');
    }
    const redirectUri = `${configuredPublicOrigin}/api/auth/oauth/${provider}/callback`;
    const result = await beginOAuth({
      provider,
      purpose,
      currentUserId,
      redirectUri,
      native: req.body?.native === true,
    });
    return res.status(200).json(result);
  } catch (error) {
    return handleAdminError(res, error);
  }
}
