import type { NextApiRequest, NextApiResponse } from 'next';
import {
  appSessionResponse,
  createNativeGuestAppUser,
  requireAppUser,
} from '../../../lib/auth/appAuth';
import { toPublicAppProfile } from '../../../lib/auth/profile';
import { db } from '../../../lib/db';
import { AdminAuthError, handleAdminError } from '../../../lib/adminAuth';
import { startServerOperationalDiagnostic } from '../../../lib/serverOperationalDiagnostics';
import { readClientRuntimeMetadata } from '../../../lib/clientRuntimeMetadata';

function bearerToken(req: NextApiRequest): string {
  const value = req.headers.authorization;
  const authorization = Array.isArray(value) ? value[0] || '' : value || '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const diagnostic = startServerOperationalDiagnostic(req, res, 'auth_guest', { runtime: 'native' });
  if (req.method !== 'POST') {
    diagnostic.log('request', 'error', { httpStatus: 405, errorCode: 'METHOD_NOT_ALLOWED' });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const existingToken = bearerToken(req);
    let auth;
    let sessionResponse: Record<string, unknown> = { token: existingToken };

    if (req.headers.authorization) {
      auth = await requireAppUser(req, { allowGuest: true });
      if (auth.provider !== 'native') {
        throw new AdminAuthError(403, 'NATIVE_SESSION_REQUIRED', 'A native session is required');
      }
    } else {
      const created = await createNativeGuestAppUser(req.body?.sessionVersion, readClientRuntimeMetadata(req.headers, 'native'));
      auth = created.auth;
      sessionResponse = appSessionResponse(created.session, true);
    }

    const user = await db.users.get(auth.userId);
    diagnostic.log('finished', 'ok', { httpStatus: 200, source: existingToken ? 'existing' : 'created' });
    return res.status(200).json({
      ...sessionResponse,
      profile: toPublicAppProfile(user, auth),
    });
  } catch (error) {
    diagnostic.error('finished', error, 'GUEST_SESSION_FAILED');
    return handleAdminError(res, error);
  }
}
