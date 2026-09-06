import type { NextApiRequest, NextApiResponse } from 'next';
import { createGuestAppUser, requireAppUser } from '../../../lib/auth/appAuth';
import { toPublicAppProfile } from '../../../lib/auth/profile';
import { db } from '../../../lib/db';
import { AdminAuthError, handleAdminError } from '../../../lib/adminAuth';
import { readClientRuntimeMetadata } from '../../../lib/clientRuntimeMetadata';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    let auth;
    try { auth = await requireAppUser(req, { allowGuest: true }); } catch (error) { if (!(error instanceof AdminAuthError) || error.status !== 401) throw error; }
    auth ||= await createGuestAppUser(res, req.body?.sessionVersion, readClientRuntimeMetadata(req.headers, 'web'));
    const user = await db.users.get(auth.userId);
    return res.status(200).json({ profile: toPublicAppProfile(user, auth) });
  } catch (error) { return handleAdminError(res, error); }
}
