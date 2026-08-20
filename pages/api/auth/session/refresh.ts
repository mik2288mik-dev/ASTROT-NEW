import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../lib/adminAuth';
import {
  clearAppSessionCookie,
  readAppRefreshCookie,
  readAppSessionCookie,
  setAppSessionCookie,
} from '../../../../lib/auth/appAuth';
import { refreshAppUserSession } from '../../../../lib/auth/appSessionRefresh';

function firstHeader(req: NextApiRequest, name: string): string {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] || '' : typeof value === 'string' ? value : '';
}

function normalizedOrigin(value: string): string {
  try {
    const url = new URL(value);
    return `${url.protocol.toLowerCase()}//${url.host.toLowerCase()}`;
  } catch {
    return '';
  }
}

function requestOrigin(req: NextApiRequest): string {
  const forwardedHost = firstHeader(req, 'x-forwarded-host').split(',')[0]?.trim();
  const host = forwardedHost || firstHeader(req, 'host').trim();
  const forwardedProto = firstHeader(req, 'x-forwarded-proto').split(',')[0]?.trim();
  const protocol = forwardedProto || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  return host ? normalizedOrigin(`${protocol}://${host}`) : '';
}

function assertWebRefreshOrigin(req: NextApiRequest): void {
  const origin = normalizedOrigin(firstHeader(req, 'origin'));
  const configured = normalizedOrigin(String(process.env.PUBLIC_APP_ORIGIN || ''));
  const sameOrigin = requestOrigin(req);
  if (process.env.NODE_ENV === 'production') {
    if (!origin || (origin !== configured && origin !== sameOrigin)) {
      throw new AdminAuthError(403, 'APP_SESSION_REFRESH_ORIGIN_INVALID', 'The refresh origin is not allowed');
    }
    return;
  }

  if (origin && origin !== configured && origin !== sameOrigin) {
    throw new AdminAuthError(403, 'APP_SESSION_REFRESH_ORIGIN_INVALID', 'The refresh origin is not allowed');
  }
}

function authorizationCredential(req: NextApiRequest): string | null {
  const authorization = firstHeader(req, 'authorization').trim();
  if (!authorization) return null;
  if (authorization.startsWith('Refresh ')) {
    const credential = authorization.slice('Refresh '.length).trim();
    if (credential) return credential;
  }
  if (authorization.startsWith('Bearer ')) {
    const credential = authorization.slice('Bearer '.length).trim();
    if (credential) return credential;
  }
  throw new AdminAuthError(401, 'APP_SESSION_REFRESH_INVALID', 'The session refresh credential is invalid');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  let nativeTransport = false;
  try {
    const authorization = authorizationCredential(req);
    const refreshCookie = readAppRefreshCookie(req);
    const accessCookie = readAppSessionCookie(req);
    nativeTransport = !!authorization;
    if (nativeTransport && (refreshCookie || accessCookie)) {
      throw new AdminAuthError(400, 'APP_SESSION_REFRESH_TRANSPORT_CONFLICT', 'Use exactly one refresh transport');
    }
    if (!nativeTransport) assertWebRefreshOrigin(req);

    const credential = authorization || refreshCookie || accessCookie;
    if (!credential) {
      throw new AdminAuthError(401, 'APP_SESSION_REFRESH_INVALID', 'The session refresh credential is invalid');
    }
    const session = await refreshAppUserSession({
      credential,
      expectedKind: nativeTransport ? 'native' : 'web',
    });

    if (!nativeTransport) {
      setAppSessionCookie(res, session.token, session.refreshToken);
      return res.status(200).json({
        sessionVersion: session.sessionVersion,
        accessExpiresAt: session.expiresAt,
        refreshExpiresAt: session.refreshExpiresAt,
        absoluteExpiresAt: session.absoluteExpiresAt,
      });
    }
    return res.status(200).json({
      sessionVersion: session.sessionVersion,
      token: session.token,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      accessExpiresAt: session.expiresAt,
      refreshExpiresAt: session.refreshExpiresAt,
      absoluteExpiresAt: session.absoluteExpiresAt,
    });
  } catch (error: any) {
    if (!nativeTransport && error?.status !== 409 && (error?.status === 401 || error?.status === 403)) {
      clearAppSessionCookie(res);
    }
    return handleAdminError(res, error);
  }
}
