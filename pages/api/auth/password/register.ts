import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError } from '../../../../lib/adminAuth';
import { requireAppUser } from '../../../../lib/auth/appAuth';
import { getAuthClientKey } from '../../../../lib/auth/authRateLimit';
import {
  beginEmailPasswordRegistration,
  sanitizeEmailPasswordError,
} from '../../../../lib/auth/emailPassword';
import { startServerOperationalDiagnostic } from '../../../../lib/serverOperationalDiagnostics';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const diagnostic = startServerOperationalDiagnostic(req, res, 'auth_email', { operation: 'register' });
  if (req.method !== 'POST') {
    diagnostic.log('request', 'error', { httpStatus: 405, errorCode: 'METHOD_NOT_ALLOWED' });
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  try {
    const link = req.body?.purpose === 'link';
    const currentAuth = link
      ? await requireAppUser(req, { allowGuest: true, allowTelegramProof: false })
      : null;
    const result = await beginEmailPasswordRegistration({
      email: String(req.body?.email || ''),
      password: String(req.body?.password || ''),
      passwordConfirmation: String(req.body?.passwordConfirmation || ''),
      clientKey: getAuthClientKey(req),
      currentUserId: currentAuth?.userId || null,
    });
    diagnostic.log('challenge_created', 'ok', { httpStatus: 202 });
    return res.status(202).json({ ok: true, challengeId: result.challengeId });
  } catch (error) {
    const safeError = sanitizeEmailPasswordError(error);
    diagnostic.error('challenge_created', error, 'EMAIL_REGISTRATION_FAILED');
    return handleAdminError(res, safeError);
  }
}
