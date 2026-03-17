import crypto from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from './db';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const INIT_DATA_HEADER = 'x-telegram-init-data';

export class AdminAuthError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type VerifiedTelegramUser = {
  id: string;
  rawUser: Record<string, any>;
};

export function getConfiguredOwnerId(): string {
  return process.env.NEXT_PUBLIC_OWNER_ID || process.env.OWNER_ID || '';
}

function getHeaderValue(req: NextApiRequest, headerName: string): string {
  const value = req.headers[headerName];
  if (Array.isArray(value)) return value[0] || '';
  return typeof value === 'string' ? value : '';
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

  if (!hash || !userJson) {
    throw new AdminAuthError(401, 'INVALID_INIT_DATA', 'Telegram initData is invalid');
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
  return verifyTelegramInitData(initData);
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
