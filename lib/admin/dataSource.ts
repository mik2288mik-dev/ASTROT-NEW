import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool, types as pgTypes } from 'pg';
import { handleAdminError } from '../adminAuth';
import { runWithScopedPool } from '../db';
import { getAdminContext } from './rbac';

/**
 * The admin reads this server's own database by default. The Telegram version
 * lives on another deployment with its own database; when its connection string
 * is configured, the admin can switch to it for reading only.
 */
export type AdminSource = 'main' | 'telegram';
export const ADMIN_SOURCE_HEADER = 'x-admin-source';
const TELEGRAM_DATABASE_ENV = 'NEBO_TELEGRAM_DATABASE_URL';

let telegramPool: Pool | null = null;

function telegramDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const value = String(env[TELEGRAM_DATABASE_ENV] || '').trim();
  return /^postgres(ql)?:\/\//.test(value) ? value : '';
}

export function isTelegramSourceConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(telegramDatabaseUrl(env));
}

function getTelegramPool(): Pool {
  if (!telegramPool) {
    telegramPool = new Pool({
      connectionString: telegramDatabaseUrl(),
      types: { getTypeParser: (oid: number, format?: 'text' | 'binary') =>
        oid === 1082 ? (value: string) => value : pgTypes.getTypeParser(oid, format) },
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
    });
    // Every session on this pool is read-only: the admin can never change the other database.
    telegramPool.on('connect', (client) => {
      void client.query("SET default_transaction_read_only = on; SET statement_timeout = '20s'").catch(() => undefined);
    });
    telegramPool.on('error', () => undefined);
  }
  return telegramPool;
}

export function requestedAdminSource(req: Pick<NextApiRequest, 'headers' | 'query'>): AdminSource {
  const header = req.headers?.[ADMIN_SOURCE_HEADER];
  const value = Array.isArray(header) ? header[0] : header;
  return value === 'telegram' ? 'telegram' : 'main';
}

type Handler = (req: NextApiRequest, res: NextApiResponse) => unknown;

/** Admin read endpoints: the same handler answers for either database. */
export function withAdminSource(handler: Handler): Handler {
  return async (req, res) => {
    if (requestedAdminSource(req) === 'main') return handler(req, res);
    if (!isTelegramSourceConfigured()) {
      return res.status(503).json({ error: 'TELEGRAM_SOURCE_UNCONFIGURED', message: 'База Telegram-версии не подключена' });
    }
    if (req.method !== 'GET') {
      return res.status(409).json({ error: 'READ_ONLY_SOURCE', message: 'Telegram-версия открыта только для просмотра' });
    }
    // Access is always checked against this server's own accounts and roles.
    try {
      await getAdminContext(req);
    } catch (error) {
      return handleAdminError(res, error);
    }
    return runWithScopedPool(getTelegramPool(), () => handler(req, res));
  };
}
