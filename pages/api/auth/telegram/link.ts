import type { NextApiRequest, NextApiResponse } from 'next';
import { getVerifiedTelegramUser, handleAdminError } from '../../../../lib/adminAuth';
import { requireAppUser } from '../../../../lib/auth/appAuth';
import { resolveVerifiedIdentity } from '../../../../lib/auth/accountIdentity';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    // The current app session is kept in Authorization/cookie. Telegram proof is
    // supplied separately so it cannot replace the account being linked.
    const authReq = Object.create(req) as NextApiRequest;
    authReq.headers = { ...req.headers };
    delete authReq.headers['x-telegram-init-data'];
    const auth = await requireAppUser(authReq, { allowGuest: true });
    const telegramReq = Object.create(req) as NextApiRequest;
    telegramReq.headers = {
      ...req.headers,
      'x-telegram-init-data': String(req.body?.initData || ''),
    };
    const telegram = getVerifiedTelegramUser(telegramReq);
    await resolveVerifiedIdentity(
      {
        provider: 'telegram',
        subject: telegram.id,
        displayName: [telegram.rawUser.first_name, telegram.rawUser.last_name].filter(Boolean).join(' ') || null,
        metadata: { username: telegram.rawUser.username || null },
      },
      auth.userId,
    );
    return res.status(200).json({ ok: true, userId: auth.userId });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
