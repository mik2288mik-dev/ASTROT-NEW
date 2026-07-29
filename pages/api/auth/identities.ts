import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError } from '../../../lib/adminAuth';
import { requireAppUser } from '../../../lib/auth/appAuth';
import {
  EXTERNAL_AUTH_PROVIDERS,
  listAccountIdentities,
  unlinkAccountIdentity,
  type ExternalAuthProvider,
} from '../../../lib/auth/accountIdentity';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const auth = await requireAppUser(req, { allowGuest: true });
    if (req.method === 'GET') {
      return res.status(200).json({
        userId: auth.userId,
        isGuest: auth.isGuest,
        identities: await listAccountIdentities(auth.userId),
      });
    }
    if (req.method === 'DELETE') {
      const provider = String(req.body?.provider || '').trim() as ExternalAuthProvider;
      if (!EXTERNAL_AUTH_PROVIDERS.includes(provider)) {
        return res.status(400).json({ error: 'AUTH_PROVIDER_INVALID' });
      }
      await unlinkAccountIdentity(auth.userId, provider);
      return res.status(200).json({ ok: true, identities: await listAccountIdentities(auth.userId) });
    }
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
