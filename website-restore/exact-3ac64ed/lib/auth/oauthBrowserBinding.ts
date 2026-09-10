import crypto from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError } from '../adminAuth';

export const OAUTH_BROWSER_BINDING_COOKIE = '__Host-lumia_oauth_binding';
export const OAUTH_BROWSER_BINDING_TTL_SECONDS = 10 * 60;

export function createOAuthBrowserBinding(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashOAuthBrowserBinding(binding: string): string {
  return crypto.createHash('sha256').update(binding).digest('hex');
}

export function hashOAuthBrowserExchange(code: string, binding: string): string {
  return crypto
    .createHash('sha256')
    .update('oauth-browser-exchange')
    .update('\0')
    .update(binding)
    .update('\0')
    .update(code)
    .digest('hex');
}

export function oauthBrowserBindingMatches(binding: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashOAuthBrowserBinding(binding), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function firstHeader(req: NextApiRequest, name: string): string {
  const value = req.headers?.[name];
  return Array.isArray(value) ? value[0] || '' : typeof value === 'string' ? value : '';
}

function appendSetCookie(res: NextApiResponse, cookie: string): void {
  const current = res.getHeader('Set-Cookie');
  if (!current) {
    res.setHeader('Set-Cookie', cookie);
    return;
  }
  res.setHeader('Set-Cookie', Array.isArray(current) ? [...current, cookie] : [String(current), cookie]);
}

export function readOAuthBrowserBinding(req: NextApiRequest): string {
  for (const part of firstHeader(req, 'cookie').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key !== OAUTH_BROWSER_BINDING_COOKIE) continue;
    try {
      return decodeURIComponent(rest.join('=')).trim();
    } catch {
      return '';
    }
  }
  return '';
}

export function requireOAuthBrowserBinding(req: NextApiRequest): string {
  const binding = readOAuthBrowserBinding(req);
  if (!binding) {
    throw new AdminAuthError(
      401,
      'OAUTH_BROWSER_BINDING_REQUIRED',
      'This OAuth login must be completed in the browser where it started',
    );
  }
  return binding;
}

export function setOAuthBrowserBindingCookie(res: NextApiResponse, binding: string): void {
  appendSetCookie(
    res,
    `${OAUTH_BROWSER_BINDING_COOKIE}=${encodeURIComponent(binding)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${OAUTH_BROWSER_BINDING_TTL_SECONDS}`,
  );
}

export function clearOAuthBrowserBindingCookie(res: NextApiResponse): void {
  appendSetCookie(
    res,
    `${OAUTH_BROWSER_BINDING_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
  );
}
