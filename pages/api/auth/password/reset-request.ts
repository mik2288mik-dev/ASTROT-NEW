import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError } from '../../../../lib/adminAuth';
import { getAuthClientKey } from '../../../../lib/auth/authRateLimit';
import {
  beginPasswordReset,
  sanitizeEmailPasswordError,
} from '../../../../lib/auth/emailPassword';
import { startServerOperationalDiagnostic } from '../../../../lib/serverOperationalDiagnostics';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const diagnostic = startServerOperationalDiagnostic(req, res, 'auth_email', { operation: 'reset_request' });
  if (req.method !== 'POST') {
    diagnostic.log('request', 'error', { httpStatus: 405, errorCode: 'METHOD_NOT_ALLOWED' });
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  try {
    const result = await beginPasswordReset({
      email: String(req.body?.email || ''),
      clientKey: getAuthClientKey(req),
    });
    diagnostic.log('challenge_created', 'ok', { httpStatus: 202 });
    return res.status(202).json({ ok: true, challengeId: result.challengeId });
  } catch (error) {
    const safeError = sanitizeEmailPasswordError(error);
    diagnostic.error('challenge_created', error, 'PASSWORD_RESET_REQUEST_FAILED');
    return handleAdminError(res, safeError);
  }
}
