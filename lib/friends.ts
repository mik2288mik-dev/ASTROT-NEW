import crypto from 'crypto';
import type { Pool } from 'pg';
import { getPool } from './db';
import { createAppPushMessage } from './appPush';

/**
 * «Мои люди»: friends by code, and a simple chat between them.
 * A friendship is mutual: adding someone's code links both people at once.
 */
export const FRIENDS_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS friend_codes (
    user_id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS friendships (
    user_a TEXT NOT NULL,
    user_b TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_a, user_b),
    CHECK (user_a < user_b)
  );
  CREATE INDEX IF NOT EXISTS friendships_b_idx ON friendships (user_b);
  CREATE TABLE IF NOT EXISTS friend_messages (
    id BIGSERIAL PRIMARY KEY,
    from_user TEXT NOT NULL,
    to_user TEXT NOT NULL,
    body TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'card')),
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS friend_messages_pair_idx ON friend_messages (from_user, to_user, id);
  CREATE INDEX IF NOT EXISTS friend_messages_unread_idx ON friend_messages (to_user, read_at);
  CREATE TABLE IF NOT EXISTS friend_prefs (
    user_id TEXT NOT NULL,
    friend_id TEXT NOT NULL,
    notify_messages BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (user_id, friend_id)
  );
`;

const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const FRIEND_MESSAGE_MAX = 1000;

let schemaReady: Promise<void> | null = null;
export function ensureFriendsSchema(pool: Pool = getPool()): Promise<void> {
  if (!schemaReady) {
    schemaReady = pool.query(FRIENDS_SCHEMA_SQL).then(() => undefined);
    schemaReady.catch(() => { schemaReady = null; });
  }
  return schemaReady;
}

export class FriendsError extends Error {
  constructor(readonly code: 'CODE_NOT_FOUND' | 'SELF_CODE' | 'NOT_FRIENDS' | 'EMPTY_MESSAGE' | 'TOO_MANY_MESSAGES' | 'SIGN_IN_REQUIRED') {
    super(code);
    this.name = 'FriendsError';
  }
}

export function normalizeFriendCode(value: string): string {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

function makeCode(random: (size: number) => Buffer = crypto.randomBytes): string {
  const chars = Array.from(random(4), (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
  return `NEBO-${chars}`;
}

const pair = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a]);

export async function getOrCreateFriendCode(userId: string, pool: Pool = getPool()): Promise<string> {
  await ensureFriendsSchema(pool);
  const existing = await pool.query('SELECT code FROM friend_codes WHERE user_id = $1', [userId]);
  if (existing.rows[0]) return String(existing.rows[0].code);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const created = await pool.query(
      'INSERT INTO friend_codes (user_id, code) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING code',
      [userId, makeCode()],
    );
    if (created.rows[0]) return String(created.rows[0].code);
    const again = await pool.query('SELECT code FROM friend_codes WHERE user_id = $1', [userId]);
    if (again.rows[0]) return String(again.rows[0].code);
  }
  throw new Error('FRIEND_CODE_FAILED');
}

export async function areFriends(userId: string, friendId: string, pool: Pool = getPool()): Promise<boolean> {
  const [a, b] = pair(userId, friendId);
  const result = await pool.query('SELECT 1 FROM friendships WHERE user_a = $1 AND user_b = $2', [a, b]);
  return Boolean(result.rows[0]);
}

/** Links two people by the friend's code. Returns the friend's id. */
export async function addFriendByCode(userId: string, rawCode: string, pool: Pool = getPool()): Promise<string> {
  await ensureFriendsSchema(pool);
  const code = normalizeFriendCode(rawCode);
  const owner = await pool.query('SELECT user_id FROM friend_codes WHERE code = $1', [code]);
  const friendId = owner.rows[0] ? String(owner.rows[0].user_id) : null;
  if (!friendId) throw new FriendsError('CODE_NOT_FOUND');
  if (friendId === userId) throw new FriendsError('SELF_CODE');
  const [a, b] = pair(userId, friendId);
  await pool.query('INSERT INTO friendships (user_a, user_b) VALUES ($1, $2) ON CONFLICT DO NOTHING', [a, b]);
  return friendId;
}

export async function removeFriend(userId: string, friendId: string, pool: Pool = getPool()): Promise<void> {
  await ensureFriendsSchema(pool);
  const [a, b] = pair(userId, friendId);
  await pool.query('DELETE FROM friendships WHERE user_a = $1 AND user_b = $2', [a, b]);
}

export type FriendSummary = {
  id: string;
  name: string;
  birthDate: string | null;
  unread: number;
  lastMessage: { body: string; mine: boolean; at: string } | null;
  notifyMessages: boolean;
};

export async function listFriends(userId: string, pool: Pool = getPool()): Promise<FriendSummary[]> {
  await ensureFriendsSchema(pool);
  const rows = await pool.query(
    `WITH f AS (
       SELECT CASE WHEN user_a = $1 THEN user_b ELSE user_a END AS friend_id, created_at
       FROM friendships WHERE user_a = $1 OR user_b = $1
     )
     SELECT f.friend_id, u.name, u.birth_date, f.created_at,
       (SELECT COUNT(*) FROM friend_messages m WHERE m.from_user = f.friend_id AND m.to_user = $1 AND m.read_at IS NULL) AS unread,
       (SELECT row_to_json(x) FROM (
          SELECT m.body, m.from_user = $1 AS mine, m.created_at AS at FROM friend_messages m
          WHERE (m.from_user = $1 AND m.to_user = f.friend_id) OR (m.from_user = f.friend_id AND m.to_user = $1)
          ORDER BY m.id DESC LIMIT 1) x) AS last_message,
       COALESCE((SELECT p.notify_messages FROM friend_prefs p WHERE p.user_id = $1 AND p.friend_id = f.friend_id), TRUE) AS notify_messages
     FROM f LEFT JOIN users u ON u.id::text = f.friend_id
     ORDER BY COALESCE((SELECT MAX(m.id) FROM friend_messages m WHERE (m.from_user = f.friend_id AND m.to_user = $1) OR (m.from_user = $1 AND m.to_user = f.friend_id)), 0) DESC, f.created_at DESC`,
    [userId],
  );
  return rows.rows.map((row: any) => ({
    id: String(row.friend_id),
    name: String(row.name || '').trim() || 'Друг',
    birthDate: row.birth_date ? new Date(row.birth_date).toISOString().slice(0, 10) : null,
    unread: Number(row.unread || 0),
    lastMessage: row.last_message ? { body: String(row.last_message.body), mine: Boolean(row.last_message.mine), at: new Date(row.last_message.at).toISOString() } : null,
    notifyMessages: row.notify_messages !== false,
  }));
}

export type FriendMessage = { id: number; mine: boolean; body: string; kind: 'text' | 'card'; payload: Record<string, unknown> | null; at: string };

export async function readMessages(userId: string, friendId: string, afterId = 0, pool: Pool = getPool()): Promise<FriendMessage[]> {
  await ensureFriendsSchema(pool);
  if (!(await areFriends(userId, friendId, pool))) throw new FriendsError('NOT_FRIENDS');
  const rows = await pool.query(
    `SELECT id, from_user, body, kind, payload, created_at FROM friend_messages
     WHERE id > $3 AND ((from_user = $1 AND to_user = $2) OR (from_user = $2 AND to_user = $1))
     ORDER BY id DESC LIMIT 100`,
    [userId, friendId, Math.max(0, afterId)],
  );
  await pool.query('UPDATE friend_messages SET read_at = NOW() WHERE from_user = $1 AND to_user = $2 AND read_at IS NULL', [friendId, userId]);
  return rows.rows.reverse().map((row: any) => ({
    id: Number(row.id), mine: String(row.from_user) === userId, body: String(row.body), kind: row.kind, payload: row.payload || null,
    at: new Date(row.created_at).toISOString(),
  }));
}

/** Sends a message; the friend gets a push on Android unless they muted this chat. */
export async function sendMessage(input: { userId: string; senderName: string; friendId: string; body: string; kind?: 'text' | 'card'; payload?: Record<string, unknown> | null }, pool: Pool = getPool()): Promise<FriendMessage> {
  await ensureFriendsSchema(pool);
  const body = String(input.body || '').trim().slice(0, FRIEND_MESSAGE_MAX);
  if (!body) throw new FriendsError('EMPTY_MESSAGE');
  if (!(await areFriends(input.userId, input.friendId, pool))) throw new FriendsError('NOT_FRIENDS');
  const recent = await pool.query(
    `SELECT COUNT(*) AS n FROM friend_messages WHERE from_user = $1 AND created_at > NOW() - INTERVAL '1 minute'`,
    [input.userId],
  );
  if (Number(recent.rows[0]?.n || 0) >= 30) throw new FriendsError('TOO_MANY_MESSAGES');
  const kind = input.kind === 'card' ? 'card' : 'text';
  const created = await pool.query(
    `INSERT INTO friend_messages (from_user, to_user, body, kind, payload) VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING id, created_at`,
    [input.userId, input.friendId, body, kind, input.payload ? JSON.stringify(input.payload) : null],
  );
  const prefs = await pool.query('SELECT notify_messages FROM friend_prefs WHERE user_id = $1 AND friend_id = $2', [input.friendId, input.userId]);
  if (prefs.rows[0]?.notify_messages !== false) {
    const title = `${input.senderName || 'Друг'} пишет тебе`.slice(0, 70);
    const text = (kind === 'card' ? 'Поделился картой дня. Открой NEBO, чтобы посмотреть.' : body).slice(0, 240);
    await createAppPushMessage({
      title, body: text, route: 'today', audience: 'user', target: input.friendId,
      sendAt: new Date(), expiresAt: new Date(Date.now() + 2 * 24 * 3_600_000),
    }, `friend:${input.userId}`).catch(() => undefined);
  }
  return { id: Number(created.rows[0].id), mine: true, body, kind, payload: input.payload ?? null, at: new Date(created.rows[0].created_at).toISOString() };
}

export async function setFriendPrefs(userId: string, friendId: string, notifyMessages: boolean, pool: Pool = getPool()): Promise<void> {
  await ensureFriendsSchema(pool);
  if (!(await areFriends(userId, friendId, pool))) throw new FriendsError('NOT_FRIENDS');
  await pool.query(
    `INSERT INTO friend_prefs (user_id, friend_id, notify_messages) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, friend_id) DO UPDATE SET notify_messages = EXCLUDED.notify_messages`,
    [userId, friendId, notifyMessages],
  );
}
