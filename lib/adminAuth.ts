import crypto from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from './db';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const INIT_DATA_HEADER = 'x-telegram-init-data';
const ADMIN_DEV_USER_HEADER = 'x-admin-dev-user-id';
const ADMIN_DEV_SECRET_HEADER = 'x-admin-dev-secret';
const DEFAULT_INIT_DATA_MAX_AGE_SECONDS = 24 * 60 * 60;

function getInitDataMaxAgeSeconds(): number {
  const configured = Number.parseInt(process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS || '', 10);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_INIT_DATA_MAX_AGE_SECONDS;
}

export class AdminAuthError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export type VerifiedTelegramUser = {
  id: string;
  rawUser: Record<string, any>;
};

export function getConfiguredOwnerId(): string {
  return process.env.NEXT_PUBLIC_OWNER_ID || process.env.OWNER_ID || '';
}

function getHeaderValue(req: NextApiRequest, headerName: string): string {
  const value = req.headers?.[headerName];
  if (Array.isArray(value)) return value[0] || '';
  return typeof value === 'string' ? value : '';
}

function isAdminWebDevAuthEnabled(): boolean {
  return process.env.ADMIN_WEB_DEV_AUTH_ENABLED === '1' && process.env.NODE_ENV !== 'production';
}

function getVerifiedAdminDevUser(req: NextApiRequest): VerifiedTelegramUser | null {
  const userId = getHeaderValue(req, ADMIN_DEV_USER_HEADER).trim();
  const secret = getHeaderValue(req, ADMIN_DEV_SECRET_HEADER);

  if (!isAdminWebDevAuthEnabled()) return null;
  if (!userId && !secret) return null;

  const expectedSecret = process.env.ADMIN_WEB_DEV_SECRET || '';
  if (!expectedSecret) {
    throw new AdminAuthError(500, 'ADMIN_DEV_AUTH_NOT_CONFIGURED', 'ADMIN_WEB_DEV_SECRET is required for browser admin auth');
  }

  if (!userId || !secret) {
    throw new AdminAuthError(401, 'ADMIN_DEV_AUTH_REQUIRED', 'Admin browser credentials are required');
  }

  if (secret !== expectedSecret) {
    throw new AdminAuthError(401, 'ADMIN_DEV_AUTH_INVALID', 'Admin browser credentials are invalid');
  }

  if (!/^-?\d+$/.test(userId)) {
    throw new AdminAuthError(400, 'INVALID_ADMIN_DEV_USER', 'Admin browser user id must be numeric');
  }

  return {
    id: userId,
    rawUser: {
      id: userId,
      auth_provider: 'admin_dev',
    },
  };
}

function verifyTelegramInitData(initData: string): VerifiedTelegramUser {
  if (!BOT_TOKEN) {
    throw new AdminAuthError(500, 'ADMIN_AUTH_NOT_CONFIGURED', 'BOT_TOKEN is required for admin auth');
  }

  if (!initData.trim()) {
    throw new AdminAuthError(401, 'INIT_DATA_REQUIRED', 'Telegram initData is required');
  }

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  const userJson = params.get('user');
  const authDateRaw = params.get('auth_date');

  if (!hash || !userJson || !authDateRaw) {
    throw new AdminAuthError(401, 'INVALID_INIT_DATA', 'Telegram initData is invalid');
  }

  const authDateSeconds = Number.parseInt(authDateRaw, 10);
  if (!Number.isFinite(authDateSeconds) || authDateSeconds <= 0) {
    throw new AdminAuthError(401, 'INVALID_INIT_DATA', 'Telegram initData auth_date is invalid');
  }

  const authAgeSeconds = Math.floor(Date.now() / 1000) - authDateSeconds;
  if (authAgeSeconds < -60 || authAgeSeconds > getInitDataMaxAgeSeconds()) {
    throw new AdminAuthError(401, 'INIT_DATA_EXPIRED', 'Telegram initData has expired');
  }

  params.delete('hash');
  const dataCheckString = Array.from(params.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const calculatedHash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  const hashBuffer = Buffer.from(hash, 'hex');
  const calculatedBuffer = Buffer.from(calculatedHash, 'hex');

  if (
    hashBuffer.length !== calculatedBuffer.length ||
    !crypto.timingSafeEqual(hashBuffer, calculatedBuffer)
  ) {
    throw new AdminAuthError(401, 'INVALID_INIT_DATA', 'Telegram initData signature is invalid');
  }

  let parsedUser: Record<string, any>;
  try {
    parsedUser = JSON.parse(userJson);
  } catch {
    throw new AdminAuthError(401, 'INVALID_INIT_DATA', 'Telegram initData user payload is invalid');
  }

  if (!parsedUser?.id) {
    throw new AdminAuthError(401, 'INVALID_INIT_DATA', 'Telegram initData user payload is missing id');
  }

  return {
    id: String(parsedUser.id),
    rawUser: parsedUser,
  };
}

export function getVerifiedTelegramUser(req: NextApiRequest): VerifiedTelegramUser {
  const initData = getHeaderValue(req, INIT_DATA_HEADER);
  if (initData.trim()) return verifyTelegramInitData(initData);

  const devUser = getVerifiedAdminDevUser(req);
  if (devUser) return devUser;

  if (isAdminWebDevAuthEnabled()) {
    throw new AdminAuthError(401, 'ADMIN_DEV_AUTH_REQUIRED', 'Telegram initData or admin browser credentials are required');
  }

  return verifyTelegramInitData(initData);
}

export function requireTelegramUserId(req: NextApiRequest, expectedUserId: unknown): VerifiedTelegramUser {
  const telegramUser = getVerifiedTelegramUser(req);
  const rawExpected = Array.isArray(expectedUserId) ? expectedUserId[0] : expectedUserId;
  const normalizedExpected = String(rawExpected || '').trim();

  if (!normalizedExpected) {
    throw new AdminAuthError(400, 'USER_ID_REQUIRED', 'userId is required');
  }

  if (telegramUser.id !== normalizedExpected) {
    throw new AdminAuthError(403, 'USER_ID_MISMATCH', 'Telegram initData does not match userId');
  }

  return telegramUser;
}

export async function getAdminAccessState(req: NextApiRequest) {
  const telegramUser = getVerifiedTelegramUser(req);
  const requester = await db.users.get(telegramUser.id);
  const ownerId = getConfiguredOwnerId();
  const isOwner = !!ownerId && telegramUser.id === String(ownerId);
  const isAdmin = isOwner || !!requester?.is_admin;

  return {
    requesterId: telegramUser.id,
    isOwner,
    isAdmin,
    user: requester,
    telegramUser: telegramUser.rawUser,
  };
}

export async function requireAdminAccess(req: NextApiRequest) {
  const access = await getAdminAccessState(req);

  if (!access.isAdmin) {
    throw new AdminAuthError(403, 'ADMIN_REQUIRED', 'Admin access is required');
  }

  return access;
}

export function handleAdminError(res: NextApiResponse, error: unknown) {
  if (error instanceof AdminAuthError) {
    return res.status(error.status).json({
      error: error.code,
      message: error.message,
    });
  }

  const message = error instanceof Error ? error.message : 'Unknown error';
  return res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message,
  });
}
