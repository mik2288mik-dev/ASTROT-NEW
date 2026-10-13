import type { NextApiRequest, NextApiResponse } from 'next';
import { createAppUserSession, setAppSessionCookie } from '../../../../lib/auth/appAuth';
import { consumeAuthRateLimit, getAuthClientKey } from '../../../../lib/auth/authRateLimit';
import { adminPublicOrigin, consumeLoginLink, createOwnerLoginLink } from '../../../../lib/admin/loginLinks';
import { sendNeboOpsText } from '../../../../lib/neboOps';

/**
 * GET ?t=…  — a one-time link from the events bot: signs this browser into the
 *             owner's app account and opens the admin.
 * POST      — sends a fresh link to the owner's private events bot. Nobody else
 *             can receive it, so the button on the sign-in page is safe to show.
 */
/**
 * The link must come back to this very server (its database holds the token),
 * but a Host header is client input: only known public addresses are accepted.
 */
function trustedOrigin(req: NextApiRequest): string | undefined {
  const allowed = [adminPublicOrigin(), process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '']
    .filter(Boolean);
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase();
  return allowed.find((origin) => origin.toLowerCase() === `https://${host}`);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') {
    try {
      const userId = await consumeLoginLink(String(req.query.t || ''));
      if (!userId) return res.redirect(302, '/admin?login=expired');
      const session = await createAppUserSession({ userId, kind: 'web', sessionVersion: 2, loginProvider: 'admin_link' });
      setAppSessionCookie(res, session.token, session.refreshToken);
      return res.redirect(302, '/admin');
    } catch {
      return res.redirect(302, '/admin?login=failed');
    }
  }
  if (req.method === 'POST') {
    try {
      await consumeAuthRateLimit({ scope: 'admin_login_link', key: getAuthClientKey(req), maxAttempts: 3, windowMs: 10 * 60_000 });
      await consumeAuthRateLimit({ scope: 'admin_login_link_global', key: 'global', maxAttempts: 10, windowMs: 10 * 60_000 });
      const link = await createOwnerLoginLink(trustedOrigin(req));
      if (!link) return res.status(503).json({ error: 'LOGIN_LINK_UNAVAILABLE', message: 'Ссылку сейчас не создать: не найден аккаунт владельца или адрес сайта' });
      const sent = await sendNeboOpsText('🔑 Вход в админку NEBO\n\nКнопка ниже откроет админку в браузере. Ссылка работает один раз и 10 минут.\nЕсли ты её не запрашивал, просто не нажимай.', {
        replyMarkup: { inline_keyboard: [[{ text: '🔑 Открыть админку', url: link }]] },
      });
      if (!sent.ok) return res.status(502).json({ error: 'LOGIN_LINK_NOT_SENT', message: 'Бот не смог отправить ссылку, попробуй ещё раз' });
      return res.status(200).json({ ok: true });
    } catch (error: any) {
      const status = Number(error?.status) || 500;
      return res.status(status).json({ error: error?.code || 'LOGIN_LINK_FAILED', message: status === 429 ? 'Слишком часто, подожди несколько минут' : 'Не получилось, попробуй ещё раз' });
    }
  }
  return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
}
