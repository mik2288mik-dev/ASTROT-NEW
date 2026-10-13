import { createHmac, timingSafeEqual } from 'crypto';
import type { NextApiRequest } from 'next';

/**
 * The Telegram version runs on Railway with its own database. The live admin
 * reads it by asking the Railway server for the same admin page data. Requests
 * are signed with the owner-bot secret both servers already share; only reads
 * are accepted, and the role is the one this server has already checked.
 */
const HEADER_TS = 'x-admin-relay-ts';
const HEADER_SIG = 'x-admin-relay-sig';
const HEADER_ROLE = 'x-admin-relay-role';
const HEADER_USER = 'x-admin-relay-user';
const MAX_SKEW_MS = 60_000;
const DEFAULT_TELEGRAM_ORIGIN = 'https://astrot-production.up.railway.app';

function secret(env: NodeJS.ProcessEnv = process.env): string {
  return String(env.NEBO_OPS_WEBHOOK_SECRET || '').trim();
}

/** The Telegram server's address, or '' when this server is the Telegram one. */
export function telegramAdminOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const configured = String(env.NEBO_TELEGRAM_ADMIN_ORIGIN || '').trim().replace(/\/+$/, '');
  if (/^https:\/\/[^/]+$/.test(configured)) return configured;
  if (env.RAILWAY_ENVIRONMENT_ID || env.RAILWAY_PROJECT_ID) return '';
  return secret(env).length >= 32 ? DEFAULT_TELEGRAM_ORIGIN : '';
}

function sign(ts: string, path: string, role: string, userId: string, env: NodeJS.ProcessEnv = process.env): string {
  return createHmac('sha256', `nebo-admin-relay-v1:${secret(env)}`)
    .update(`${ts}\n${path}\n${role}\n${userId}`).digest('hex');
}

/** Read-only admin request to the Telegram server on behalf of an admin checked here. */
export async function fetchFromTelegramServer(path: string, role: string, userId: string): Promise<{ status: number; body: string }> {
  const origin = telegramAdminOrigin();
  const ts = String(Date.now());
  const response = await fetch(`${origin}${path}`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      [HEADER_TS]: ts,
      [HEADER_ROLE]: role,
      [HEADER_USER]: userId,
      [HEADER_SIG]: sign(ts, path, role, userId),
    },
    signal: AbortSignal.timeout(25_000),
  });
  return { status: response.status, body: await response.text() };
}

/** On the Telegram server: the relayed admin identity, or null when the request is not a valid relay. */
export function verifiedRelayIdentity(req: NextApiRequest): { role: string; userId: string } | null {
  const ts = String(req.headers?.[HEADER_TS] || '');
  const sig = String(req.headers?.[HEADER_SIG] || '');
  if (!ts || !sig) return null;
  if (req.method !== 'GET' || secret().length < 32 || !/^\d{13}$/.test(ts) || !/^[0-9a-f]{64}$/.test(sig)) return null;
  if (Math.abs(Date.now() - Number(ts)) > MAX_SKEW_MS) return null;
  const role = String(req.headers?.[HEADER_ROLE] || '');
  const userId = String(req.headers?.[HEADER_USER] || '');
  const expected = Buffer.from(sign(ts, String(req.url || ''), role, userId), 'hex');
  const supplied = Buffer.from(sig, 'hex');
  return expected.length === supplied.length && timingSafeEqual(expected, supplied) ? { role, userId } : null;
}
