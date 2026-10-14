import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../adminAuth';
import { requireAppUser, type AppUserContext } from '../auth/appAuth';
import { userHasRecoveryIdentity } from '../auth/accountIdentity';
import { PeopleError } from './service';

export function sendPeopleError(res: NextApiResponse, error: unknown) {
  if (error instanceof PeopleError) return res.status(error.status).json({ error: error.code, code: error.code });
  if (error instanceof AdminAuthError) return handleAdminError(res, error);
  console.error('[people] request failed:', error instanceof Error ? error.message : error);
  return res.status(500).json({ error: 'PEOPLE_UNAVAILABLE', code: 'PEOPLE_UNAVAILABLE' });
}

/**
 * Linking needs an account that can be recovered (VK, Yandex, Google or email):
 * a guest could lose the account and silently break the link for the other person.
 */
export async function requireLinkableUser(req: NextApiRequest): Promise<AppUserContext> {
  const auth = await requireAppUser(req, { allowGuest: true });
  if (auth.isGuest || !(await userHasRecoveryIdentity(auth.userId))) {
    throw new PeopleError(403, 'LOGIN_REQUIRED', 'Sign in to link accounts');
  }
  return auth;
}

/** Links point at the server that holds the invite, so a code is always found where it was made. */
export function inviteOrigin(req: NextApiRequest): string {
  const configured = String(process.env.NEBO_INVITE_ORIGIN || '').trim().replace(/\/+$/, '');
  if (/^https:\/\/[a-z0-9.-]+$/i.test(configured)) return configured;
  const forwarded = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const host = forwarded || String(req.headers.host || '').trim();
  return /^[a-z0-9.-]+(?::\d+)?$/i.test(host) ? `https://${host}` : 'https://api.tvoi-goroskop.ru';
}

export function readLinkId(value: unknown): string {
  const id = String(value ?? '');
  if (!/^[1-9]\d{0,17}$/.test(id)) throw new PeopleError(404, 'LINK_NOT_FOUND');
  return id;
}

export function readLanguage(value: unknown): 'ru' | 'en' {
  return value === 'en' ? 'en' : 'ru';
}
