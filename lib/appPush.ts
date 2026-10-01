/**
 * Рассылки в Android-приложение без Firebase/RuStore Push: устройство регистрирует
 * случайный токен, а затем само раз в пару часов забирает новые сообщения по нему
 * (NeboNotificationReceiver.pollInbox). Telegram-бот здесь не участвует.
 */
import type { Pool } from 'pg';
import { getPool } from './db';
import { ZODIAC_SIGNS } from './zodiac-utils';
import { APP_PUSH_SCHEMA_SQL } from './appPushSchema';
import { APP_PUSH_BODY_MAX, APP_PUSH_ROUTES, APP_PUSH_TITLE_MAX, type AppPushRoute } from './appPushLimits';

export type { AppPushRoute };
export type AppPushAudience = 'all' | 'user' | 'sign';
const INBOX_BATCH = 3;

let schemaReady: Promise<void> | null = null;
/** Схема ставится миграцией; здесь — страховка, если деплой прошёл без `npm run migrate`. */
export function ensureAppPushSchema(pool: Pool = getPool()): Promise<void> {
  if (!schemaReady) {
    schemaReady = pool.query(APP_PUSH_SCHEMA_SQL).then(() => undefined);
    schemaReady.catch(() => { schemaReady = null; });
  }
  return schemaReady;
}

export function isAppPushToken(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{48}$/.test(value);
}
function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim();
  return text && text.length <= max ? text : null;
}

export async function registerAppPushDevice(input: {
  userId: string; token: string; language: unknown; sign: unknown;
}): Promise<{ cursor: number }> {
  const pool = getPool();
  await ensureAppPushSchema(pool);
  const language = input.language === 'en' ? 'en' : 'ru';
  const sign = ZODIAC_SIGNS.find((item) => item === input.sign) || null;
  // start_cursor фиксируется при первой регистрации: новое устройство не получает старые рассылки.
  const result = await pool.query(
    `INSERT INTO app_push_devices (token, user_id, language, sign, start_cursor)
     VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(id), 0) FROM app_push_messages))
     ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, language = EXCLUDED.language,
       sign = EXCLUDED.sign, last_seen_at = NOW()
     RETURNING start_cursor`,
    [input.token, input.userId, language, sign],
  );
  return { cursor: Number(result.rows[0]?.start_cursor || 0) };
}

export type AppPushInboxMessage = { id: number; title: string; body: string; route: AppPushRoute };

export async function readAppPushInbox(token: string, after: number): Promise<AppPushInboxMessage[] | null> {
  const pool = getPool();
  await ensureAppPushSchema(pool);
  const device = await pool.query(
    `UPDATE app_push_devices SET last_seen_at = NOW() WHERE token = $1 RETURNING user_id, sign, start_cursor`,
    [token],
  );
  const row = device.rows[0];
  if (!row) return null;
  const cursor = Math.max(after, Number(row.start_cursor || 0));
  const messages = await pool.query(
    `SELECT id, title, body, route FROM app_push_messages
     WHERE id > $1 AND cancelled_at IS NULL AND send_at <= NOW() AND expires_at > NOW()
       AND (audience = 'all' OR (audience = 'user' AND target = $2) OR (audience = 'sign' AND target = $3))
     ORDER BY id ASC LIMIT ${INBOX_BATCH}`,
    [cursor, String(row.user_id), row.sign || ''],
  );
  if (messages.rows.length) {
    await pool.query(
      `INSERT INTO app_push_deliveries (message_id, device_token)
       SELECT UNNEST($1::bigint[]), $2 ON CONFLICT DO NOTHING`,
      [messages.rows.map((m: any) => m.id), token],
    );
  }
  return messages.rows.map((m: any) => ({ id: Number(m.id), title: m.title, body: m.body, route: m.route }));
}

export type AppPushDraft = {
  title: string; body: string; route: AppPushRoute; audience: AppPushAudience;
  target: string | null; sendAt: Date; expiresAt: Date;
};

/** Проверка формы из админки. Возвращает текст ошибки или черновик. */
export function validateAppPushDraft(input: any, now = new Date()): AppPushDraft | string {
  const title = cleanText(input?.title, APP_PUSH_TITLE_MAX);
  if (!title) return `Заголовок обязателен, до ${APP_PUSH_TITLE_MAX} символов`;
  const body = cleanText(input?.body, APP_PUSH_BODY_MAX);
  if (!body) return `Текст обязателен, до ${APP_PUSH_BODY_MAX} символов`;
  const route = APP_PUSH_ROUTES.find((item) => item === input?.route);
  if (!route) return 'Выбери, какой экран открыть';
  const audience: AppPushAudience | undefined = (['all', 'user', 'sign'] as const).find((item) => item === input?.audience);
  if (!audience) return 'Выбери, кому отправить';
  let target: string | null = null;
  if (audience === 'user') {
    target = String(input?.target ?? '').trim();
    if (!/^-?\d{1,20}$/.test(target)) return 'Нужен числовой ID пользователя';
  }
  if (audience === 'sign') {
    target = ZODIAC_SIGNS.find((item) => item === input?.target) || null;
    if (!target) return 'Выбери знак';
  }
  const sendAt = input?.sendAt ? new Date(input.sendAt) : now;
  if (!Number.isFinite(sendAt.getTime())) return 'Неверное время отправки';
  if (sendAt.getTime() > now.getTime() + 30 * 86_400_000) return 'Запланировать можно не дальше чем на 30 дней';
  const hours = Number(input?.ttlHours ?? 48);
  if (!Number.isFinite(hours) || hours < 1 || hours > 168) return 'Срок жизни — от 1 до 168 часов';
  const start = sendAt.getTime() < now.getTime() ? now : sendAt;
  return { title, body, route, audience, target, sendAt: start, expiresAt: new Date(start.getTime() + hours * 3_600_000) };
}

export async function createAppPushMessage(draft: AppPushDraft, createdBy: string): Promise<number> {
  const pool = getPool();
  await ensureAppPushSchema(pool);
  const result = await pool.query(
    `INSERT INTO app_push_messages (title, body, route, audience, target, send_at, expires_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [draft.title, draft.body, draft.route, draft.audience, draft.target, draft.sendAt, draft.expiresAt, createdBy],
  );
  return Number(result.rows[0].id);
}

export async function cancelAppPushMessage(id: number): Promise<boolean> {
  const pool = getPool();
  await ensureAppPushSchema(pool);
  const result = await pool.query(
    `UPDATE app_push_messages SET cancelled_at = NOW() WHERE id = $1 AND cancelled_at IS NULL RETURNING id`, [id],
  );
  return (result.rowCount || 0) > 0;
}

export async function getAppPushOverview() {
  const pool = getPool();
  await ensureAppPushSchema(pool);
  const [devices, messages] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE last_seen_at > NOW() - INTERVAL '7 days')::int AS active7d,
        COUNT(DISTINCT user_id)::int AS users
      FROM app_push_devices`),
    pool.query(`SELECT m.id, m.title, m.body, m.route, m.audience, m.target, m.send_at, m.expires_at,
        m.cancelled_at, m.created_at, m.created_by,
        (SELECT COUNT(*)::int FROM app_push_deliveries d WHERE d.message_id = m.id) AS delivered
      FROM app_push_messages m ORDER BY m.id DESC LIMIT 50`),
  ]);
  const iso = (value: any) => value ? new Date(value).toISOString() : null;
  return {
    devices: devices.rows[0] || { total: 0, active7d: 0, users: 0 },
    messages: messages.rows.map((m: any) => ({
      id: Number(m.id), title: m.title, body: m.body, route: m.route, audience: m.audience, target: m.target,
      sendAt: iso(m.send_at), expiresAt: iso(m.expires_at), cancelledAt: iso(m.cancelled_at),
      createdAt: iso(m.created_at), createdBy: m.created_by, delivered: m.delivered,
    })),
  };
}
