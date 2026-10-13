import { createHash, randomBytes } from 'crypto';
import { getConfiguredOwnerId } from '../adminAuth';
import { getPrimaryPool } from '../db';

/**
 * One-time admin sign-in links. The owner receives one in the private events bot
 * and opens it in any browser: the link signs the browser into the owner's own
 * app account. A link works once and for ten minutes.
 */
const LINK_TTL_MINUTES = 10;
const SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS admin_login_links (
  token_hash TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

let schemaReady: Promise<void> | null = null;
export function ensureAdminLoginLinkSchema(): Promise<void> {
  schemaReady ??= getPrimaryPool().query(SCHEMA_SQL).then(() => undefined)
    .catch((error) => { schemaReady = null; throw error; });
  return schemaReady;
}
export const ADMIN_LOGIN_LINKS_SCHEMA_SQL = SCHEMA_SQL;

const hash = (token: string) => createHash('sha256').update(`nebo-admin-login-v1:${token}`).digest('hex');

export function adminPublicOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const value = String(env.NEBO_ADMIN_PUBLIC_URL || env.NEBO_OPS_PUBLIC_URL || env.PUBLIC_APP_ORIGIN || '').trim().replace(/\/+$/, '');
  return /^https:\/\/[^/]+$/.test(value) ? value : '';
}

/** The owner's app account on this server: the Telegram identity first, then the raw owner id. */
export async function resolveOwnerUserId(): Promise<string | null> {
  const ownerId = getConfiguredOwnerId();
  if (!ownerId) return null;
  const pool = getPrimaryPool();
  const identity = await pool.query(
    `SELECT user_id FROM account_identities WHERE provider = 'telegram' AND provider_subject = $1 LIMIT 1`,
    [String(ownerId)],
  );
  if (identity.rows[0]?.user_id) return String(identity.rows[0].user_id);
  const user = await pool.query('SELECT id FROM users WHERE id = $1', [String(ownerId)]);
  return user.rows[0]?.id ? String(user.rows[0].id) : null;
}

export async function createOwnerLoginLink(originOverride?: string): Promise<string | null> {
  const origin = originOverride || adminPublicOrigin();
  const userId = await resolveOwnerUserId();
  if (!origin || !userId) return null;
  await ensureAdminLoginLinkSchema();
  const token = randomBytes(24).toString('base64url');
  const pool = getPrimaryPool();
  await pool.query('DELETE FROM admin_login_links WHERE expires_at < NOW() - INTERVAL \'1 day\'');
  await pool.query(
    `INSERT INTO admin_login_links (token_hash, user_id, expires_at)
     VALUES ($1, $2, NOW() + $3 * INTERVAL '1 minute')`,
    [hash(token), userId, LINK_TTL_MINUTES],
  );
  return `${origin}/api/admin/v2/login-link?t=${token}`;
}

/** Returns the account to sign in, or null when the link is unknown, used or expired. */
export async function consumeLoginLink(token: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  await ensureAdminLoginLinkSchema();
  const result = await getPrimaryPool().query(
    `UPDATE admin_login_links SET used_at = NOW()
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
     RETURNING user_id`,
    [hash(token)],
  );
  return result.rows[0]?.user_id ? String(result.rows[0].user_id) : null;
}
