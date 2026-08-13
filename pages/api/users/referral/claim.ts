import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../../lib/db';
import { RATE_LIMIT_CONFIGS, withRateLimit } from '../../../../lib/rateLimit';
import { AdminAuthError, handleAdminError } from '../../../../lib/adminAuth';
import { requireAppUser } from '../../../../lib/auth/appAuth';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : '';
  const inviteCode = typeof req.body?.inviteCode === 'string' ? req.body.inviteCode.trim() : '';
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  try {
    await requireAppUser(req, { expectedUserId: userId, allowGuest: false });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return handleAdminError(res, error);
    }
    throw error;
  }
  if (!inviteCode) {
    return res.status(400).json({ error: 'inviteCode is required', code: 'INVITE_CODE_REQUIRED' });
  }

  try {
    const result = await db.users.claimReferralBonus(userId, inviteCode);
    return res.status(200).json({
      ok: true,
      referralApplied: result.referralApplied,
    });
  } catch (error: any) {
    const code = error?.code || error?.message;
    if (code === 'REFERRAL_INVALID_CODE') {
      return res.status(400).json({ ok: false, code: 'REFERRAL_INVALID_CODE', message: 'Invalid invite code' });
    }
    if (code === 'REFERRAL_SELF') {
      return res.status(400).json({ ok: false, code: 'REFERRAL_SELF', message: 'Cannot use your own code' });
    }
    if (code === 'REFERRAL_ALREADY_CLAIMED') {
      return res.status(409).json({ ok: false, code: 'REFERRAL_ALREADY_CLAIMED', message: 'Referral already applied' });
    }
    console.error('[API/users/referral/claim]', error?.message);
    return res.status(500).json({ error: 'REFERRAL_FAILED', message: error?.message || 'Failed' });
  }
}

export default withRateLimit(handler, RATE_LIMIT_CONFIGS.FREE);
