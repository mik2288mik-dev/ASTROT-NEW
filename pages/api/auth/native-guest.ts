import type { NextApiRequest, NextApiResponse } from 'next';
import {
  createNativeGuestAppUser,
  requireAppUser,
} from '../../../lib/auth/appAuth';
import { toPublicAppProfile } from '../../../lib/auth/profile';
import { db } from '../../../lib/db';
import { AdminAuthError, handleAdminError } from '../../../lib/adminAuth';

function bearerToken(req: NextApiRequest): string {
  const value = req.headers.authorization;
  const authorization = Array.isArray(value) ? value[0] || '' : value || '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const existingToken = bearerToken(req);
    let auth;
    let token = existingToken;

    if (req.headers.authorization) {
      auth = await requireAppUser(req, { allowGuest: true });
      if (auth.provider !== 'native') {
        throw new AdminAuthError(403, 'NATIVE_SESSION_REQUIRED', 'A native session is required');
      }
    } else {
      const created = await createNativeGuestAppUser();
      auth = created.auth;
      token = created.token;
    }

    const user = await db.users.get(auth.userId);
    return res.status(200).json({
      token,
      profile: toPublicAppProfile(user, auth),
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
