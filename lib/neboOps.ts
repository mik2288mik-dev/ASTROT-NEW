import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import { getPool } from './db';
import type { TelegramReplyMarkup } from './telegramBot';

type Queryable = Pick<PoolClient, 'query'>;
type Payload = Record<string, unknown>;
export type NeboOpsEvent = {
  eventKey: string;
  eventType: string;
  userId?: string | null;
  occurredAt?: Date;
  payload?: Payload;
};
export type NeboOpsConfig = { token: string; chatId: string };
type OpsRow = {
  id: string;
  event_type: string;
  user_id: string | null;
  payload_json: Payload;
  occurred_at: Date | string;
  attempts: number;
  lease_token: string;
};
type UserSummary = {
  name?: string | null;
  language?: string | null;
  auth_provider?: string | null;
  created_at?: Date | string | null;
  premium_until?: Date | string | null;
  has_premium?: boolean;
};
type SendResult = {
  ok: boolean;
  messageId?: number;
  error?: string;
  retryAfterSeconds?: number;
  deferred?: boolean;
};

const MAX_ATTEMPTS = 12;
const MAX_BATCH = 10;
const REQUEST_TIMEOUT_MS = 8_000;
const HOUR_MS = 60 * 60 * 1_000;
const HOURLY_STAT_KEYS = [
  'newUsers', 'totalUsers', 'logins', 'activeUsers', 'actions', 'screens',
  'starsPurchases', 'starsGross', 'rustoreConfirmations', 'rustoreTestConfirmations',
  'supportTickets', 'clientPaymentErrors', 'aiErrors',
] as const;
const EVENT_TYPES = new Set([
  'login', 'activity', 'payment_confirmed', 'trial_started',
  'subscription_grace', 'subscription_cancelled', 'subscription_expired', 'subscription_resumed',
  'payment_refunded', 'support_ticket', 'diagnostic', 'hourly_summary', 'ai_error',
]);
const PROVIDERS: Record<string, string> = {
  telegram: 'Telegram', telegram_stars: 'Telegram Stars',
  web_guest: 'Гость', guest: 'Гость', native: 'Гость приложения',
  vk: 'VK ID', vk_id: 'VK ID', yandex: 'Яндекс ID', google: 'Google',
  email: 'Email', password: 'Email и пароль', rustore: 'RuStore', rustore_pay: 'RuStore',
};
const SCREENS: Record<string, string> = {
  dashboard: 'Сегодня', today: 'Сегодня', personal_forecast: 'Личный прогноз',
  horoscope: 'Зодиак', zodiac: 'Зодиак', chart: 'Натальная карта',
  natal_map: 'Натальная карта · Карта', natal_reading: 'Натальная карта · Разбор',
  natal_questions: 'Натальная карта · Спросить о себе', natal_matrix: 'Матрица судьбы',
  synastry: 'Сравнить', compatibility: 'Сравнить', settings: 'Настройки',
  menu: 'Меню', services: 'Меню', onboarding: 'Знакомство с приложением',
  premium: 'Premium', paywall: 'Premium', encyclopedia: 'Энциклопедия',
  charts: 'Сохранённые карты', personality: 'Разбор карты', natal_story: 'Разбор карты',
};
const ACTIONS: Record<string, string> = {
  screen_view: '🧭 Открыл экран', first_result_ready: '✨ Получил первый результат',
  first_value_viewed: '✨ Посмотрел первый результат', natal_section_open: '📖 Открыл раздел разбора',
  compatibility_ready: '🤝 Получил совместимость', person_added: '👥 Добавил человека',
  future_open: '🔭 Открыл прогноз', question_sent: '💬 Задал вопрос о себе',
  locked_feature_tapped: '🔒 Нажал закрытую функцию', premium_promo_impression: '💎 Увидел предложение Premium',
  premium_promo_clicked: '💎 Открыл предложение Premium', premium_promo_dismissed: '💎 Закрыл предложение Premium',
  paywall_view: '💎 Открыл Premium', plan_selected: '🛒 Выбрал тариф',
  checkout_start: '🛒 Начал оплату', purchase_success: '📲 Приложение сообщило об оплате',
  purchase_cancelled: '↩️ Отменил оплату', purchase_failed: '⚠️ Ошибка оплаты в приложении',
  restore_started: '🔄 Начал восстановление покупок', restore_success: '✅ Восстановил доступ',
  restore_failed: '⚠️ Ошибка восстановления', subscription_cancelled: '↩️ Отключил автопродление',
  subscription_expired: '⌛ Доступ закончился', share: '📤 Нажал «Поделиться»', invite_open: '🔗 Открыл приглашение',
  natal_story_open: '📖 Открыл разбор', natal_card_impression: '📖 Увидел фрагмент разбора',
  natal_story_completed: '🏁 Дочитал разбор', natal_card_swipe_next: '📖 Перешёл к следующему фрагменту',
  natal_readmore_tap: '📖 Нажал «Читать дальше»', natal_sheet_open: '📖 Открыл подробности',
  natal_today_cta_tap: '☀️ Перешёл к прогнозу', natal_checkin_cta_tap: '📖 Открыл продолжение',
  natal_save_tap: '🔖 Нажал «Сохранить»', natal_share_tap: '📤 Нажал «Поделиться разбором»',
  natal_notifications_optin: '🔔 Изменил уведомления', natal_paywall_open: '💎 Открыл Premium из разбора',
  natal_sheet_scroll_depth: '📖 Читает разбор', natal_paywall_dismiss: '💎 Закрыл Premium',
};
const TITLES: Record<string, string> = {
  payment_confirmed: '💰 Оплата подтверждена сервером', trial_started: '🎁 Начался пробный период',
  subscription_grace: '⚠️ Продление ожидает оплаты', subscription_cancelled: '↩️ Автопродление отключено',
  subscription_expired: '⌛ Подписка закончилась', payment_refunded: '↩️ Возврат подтверждён',
  subscription_resumed: '✅ Подписка восстановлена',
  support_ticket: '✉️ Новое обращение', diagnostic: '🛠 Проверка уведомлений',
  ai_error: '⚠️ Ошибка генерации ИИ',
};

function text(value: unknown, limit = 100): string {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit)
    : '';
}
function code(value: unknown): string {
  const clean = text(value, 80);
  return /^[a-zA-Z0-9_.:-]{1,80}$/.test(clean) ? clean : '';
}
function positiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}
function validDate(value: unknown): Date | null {
  if (!(value instanceof Date) && typeof value !== 'string') return null;
  const date = new Date(value instanceof Date ? value.getTime() : value);
  return Number.isFinite(date.getTime()) ? date : null;
}
function moscowDateTime(value: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow', dateStyle: 'short', timeStyle: 'short',
  }).format(value);
}

export function isNeboOpsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NEBO_OPS_TELEGRAM_ENABLED === '1';
}

export function getNeboOpsConfig(env: NodeJS.ProcessEnv = process.env): NeboOpsConfig | null {
  if (!isNeboOpsEnabled(env)) return null;
  const token = (env.NEBO_OPS_BOT_TOKEN || env.NEBO_ANALYTICS_BOT_TOKEN || '').trim();
  const owner = (env.OWNER_ID || '').trim();
  const chatId = (env.NEBO_OPS_CHAT_ID || owner).trim();
  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token) || !/^[1-9]\d{0,15}$/.test(owner)
    || !Number.isSafeInteger(Number(owner)) || chatId !== owner) return null;
  return { token, chatId };
}

/** Copy only operational fields. Never copy questions, birth data, receipts or raw errors. */
export function sanitizeNeboOpsPayload(input: Payload = {}): Payload {
  const result: Payload = {};
  for (const key of ['hourStart', 'hourEnd']) {
    const date = validDate(input[key]);
    if (date) result[key] = date.toISOString();
  }
  if (input.stats && typeof input.stats === 'object' && !Array.isArray(input.stats)) {
    const source = input.stats as Payload;
    const stats: Payload = {};
    for (const key of HOURLY_STAT_KEYS) {
      const value = positiveNumber(source[key]);
      if (value !== undefined && Number.isSafeInteger(value)) stats[key] = value;
    }
    result.stats = stats;
  }
  if (Array.isArray(input.topScreens)) {
    result.topScreens = input.topScreens.slice(0, 5).flatMap((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
      const section = code(item.section);
      const count = positiveNumber(item.count);
      if (count === undefined || !Number.isSafeInteger(count)) return [];
      return [{ section: Object.prototype.hasOwnProperty.call(SCREENS, section) ? section : 'unknown', count }];
    });
  }
  if (input.operation === 'personal_forecast' || input.operation === 'natal_question') result.operation = input.operation;
  if (['generation', 'lazy_refresh', 'request'].includes(String(input.stage))) result.stage = input.stage;
  if (['day', 'week', 'month'].includes(String(input.period))) result.period = input.period;
  if (typeof input.errorCode === 'string' && /^[A-Za-z0-9_.:-]{1,80}$/.test(input.errorCode)) result.errorCode = input.errorCode;
  if (typeof input.reportId === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(input.reportId)) result.reportId = input.reportId;
  if (typeof input.traceId === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(input.traceId)) result.traceId = input.traceId;
  if (typeof input.serverVersion === 'string' && /^[0-9a-f]{7,40}$/i.test(input.serverVersion)) result.serverVersion = input.serverVersion;
  const httpStatus = positiveNumber(input.httpStatus);
  if (httpStatus !== undefined && Number.isInteger(httpStatus) && httpStatus >= 100 && httpStatus <= 599) result.httpStatus = httpStatus;
  const durationMs = positiveNumber(input.durationMs);
  if (durationMs !== undefined && Number.isSafeInteger(durationMs)) result.durationMs = durationMs;
  if (typeof input.isFirstLogin === 'boolean') result.isFirstLogin = input.isFirstLogin;
  const provider = code(input.provider);
  if (Object.prototype.hasOwnProperty.call(PROVIDERS, provider)) result.provider = provider;
  if (['native', 'web', 'telegram'].includes(String(input.runtime))) result.runtime = input.runtime;
  if (typeof input.sandbox === 'boolean') result.sandbox = input.sandbox;
  if (typeof input.autoRenewing === 'boolean') result.autoRenewing = input.autoRenewing;
  if (typeof input.expiresAt === 'string' && Number.isFinite(Date.parse(input.expiresAt))) {
    result.expiresAt = new Date(input.expiresAt).toISOString();
  }
  const eventType = code(input.eventType);
  if (Object.prototype.hasOwnProperty.call(ACTIONS, eventType)) result.eventType = eventType;
  const section = code(input.section);
  if (Object.prototype.hasOwnProperty.call(SCREENS, section)) result.section = section;
  for (const key of ['paymentType', 'productId', 'productCode', 'planId', 'status', 'category']) {
    const value = code(input[key]);
    if (value) result[key] = value;
  }
  for (const key of ['starsAmount', 'amountMinor', 'ticketId']) {
    const value = positiveNumber(input[key]);
    if (value !== undefined) result[key] = value;
  }
  if (/^[A-Z]{3}$/.test(String(input.currency || ''))) result.currency = input.currency;
  const detail = input.eventPayload;
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const source = detail as Payload;
    const safe: Payload = {};
    for (const key of ['plan_id', 'period', 'section_key', 'reason_code']) {
      const value = code(source[key]);
      if (value) safe[key] = value;
    }
    for (const key of ['price_micros', 'depth_pct', 'open_section_count', 'total_section_count']) {
      const value = positiveNumber(source[key]);
      if (value !== undefined) safe[key] = value;
    }
    if (/^[A-Z]{3}$/.test(String(source.currency || ''))) safe.currency = source.currency;
    result.eventPayload = safe;
  }
  return result;
}

export async function enqueueNeboOpsEvent(db: Queryable, input: NeboOpsEvent): Promise<void> {
  if (!isNeboOpsEnabled()) return;
  if (!EVENT_TYPES.has(input.eventType) || !/^[a-zA-Z0-9_.:-]{1,180}$/.test(input.eventKey)) {
    console.warn('[nebo-ops] invalid notification event rejected');
    return;
  }
  // Call inside the business transaction. Notification storage is isolated so
  // a missing/outage-affected outbox cannot deny authentication or a paid entitlement.
  await db.query('SAVEPOINT nebo_ops_enqueue');
  try {
    await db.query(
      `INSERT INTO nebo_ops_outbox (event_key, event_type, user_id, payload_json, occurred_at)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       ON CONFLICT (event_key) DO NOTHING`,
      [input.eventKey, input.eventType, input.userId || null,
        JSON.stringify(sanitizeNeboOpsPayload(input.payload)), input.occurredAt || new Date()],
    );
  } catch {
    await db.query('ROLLBACK TO SAVEPOINT nebo_ops_enqueue');
    console.warn('[nebo-ops] notification could not be queued; business transaction preserved');
  } finally {
    await db.query('RELEASE SAVEPOINT nebo_ops_enqueue');
  }
}

/** Only the most recently completed UTC hour is collected; startup never floods historical hours. */
export async function enqueueNeboOpsHourlySummary(now = new Date()): Promise<boolean> {
  if (!getNeboOpsConfig() || !Number.isFinite(now.getTime())) return false;
  const end = new Date(Math.floor(now.getTime() / HOUR_MS) * HOUR_MS);
  const start = new Date(end.getTime() - HOUR_MS);
  const eventKey = `summary:hour:${Math.floor(start.getTime() / 1_000)}`;
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const lock = await client.query('SELECT pg_try_advisory_xact_lock(2026090402) AS acquired');
    if (lock.rows[0]?.acquired !== true) {
      await client.query('COMMIT');
      return false;
    }
    const existing = await client.query('SELECT 1 FROM nebo_ops_outbox WHERE event_key = $1 LIMIT 1', [eventKey]);
    if (existing.rowCount) {
      await client.query('COMMIT');
      return false;
    }
    await client.query("SET LOCAL statement_timeout = '20s'");
    // Legacy TIMESTAMP columns store UTC wall time. Convert the bounds rather
    // than indexed columns; outbox TIMESTAMPTZ uses absolute instants directly.
    const collected = await client.query(
      `WITH bounds AS (
         SELECT $1::timestamptz AS start_at, $2::timestamptz AS end_at,
                $1::timestamptz AT TIME ZONE 'UTC' AS start_utc,
                $2::timestamptz AT TIME ZONE 'UTC' AS end_utc
       ), hour_events AS (
         SELECT e.user_id, e.event_type, e.section
         FROM user_app_events e CROSS JOIN bounds b
         WHERE e.occurred_at >= b.start_utc AND e.occurred_at < b.end_utc
           AND COALESCE(e.source, '') NOT IN ('rustore_callback', 'entitlement_expiry')
       ), hour_sessions AS (
         SELECT s.user_id FROM app_sessions s CROSS JOIN bounds b
         WHERE s.created_at >= b.start_utc AND s.created_at < b.end_utc
       ), active_users AS (
         SELECT user_id FROM hour_events WHERE user_id IS NOT NULL
         UNION SELECT user_id FROM hour_sessions
       ), hour_stars AS (
         SELECT p.stars_amount FROM star_payments p CROSS JOIN bounds b
         WHERE p.created_at >= b.start_utc AND p.created_at < b.end_utc
           AND COALESCE(p.provider, 'telegram_stars') = 'telegram_stars'
           AND p.status IN ('paid', 'confirmed', 'consumed', 'refunded')
       ), hour_ops AS (
         SELECT o.event_type, o.payload_json
         FROM nebo_ops_outbox o CROSS JOIN bounds b
         WHERE o.created_at >= b.start_at AND o.created_at < b.end_at
           AND o.event_type IN ('payment_confirmed', 'ai_error')
       ), top_screens AS (
         SELECT COALESCE(section, 'unknown') AS section, COUNT(*)::int AS count
         FROM hour_events WHERE event_type = 'screen_view'
         GROUP BY COALESCE(section, 'unknown') ORDER BY count DESC, section LIMIT 5
       )
       SELECT
         (SELECT COUNT(*) FROM users u CROSS JOIN bounds b
          WHERE u.created_at >= b.start_at AND u.created_at < b.end_at) AS "newUsers",
         (SELECT COUNT(*) FROM users) AS "totalUsers",
         (SELECT COUNT(*) FROM hour_sessions) AS "logins",
         (SELECT COUNT(*) FROM active_users) AS "activeUsers",
         (SELECT COUNT(*) FROM hour_events) AS "actions",
         (SELECT COUNT(*) FROM hour_events WHERE event_type = 'screen_view') AS "screens",
         (SELECT COUNT(*) FROM hour_stars) AS "starsPurchases",
         (SELECT COALESCE(SUM(stars_amount), 0) FROM hour_stars) AS "starsGross",
         (SELECT COUNT(*) FROM hour_ops WHERE event_type = 'payment_confirmed'
          AND payload_json->>'provider' = 'rustore'
          AND COALESCE(payload_json->>'sandbox', 'false') <> 'true') AS "rustoreConfirmations",
         (SELECT COUNT(*) FROM hour_ops WHERE event_type = 'payment_confirmed'
          AND payload_json->>'provider' = 'rustore'
          AND payload_json->>'sandbox' = 'true') AS "rustoreTestConfirmations",
         (SELECT COUNT(*) FROM support_tickets t CROSS JOIN bounds b
          WHERE t.created_at >= b.start_utc AND t.created_at < b.end_utc) AS "supportTickets",
         (SELECT COUNT(*) FROM hour_events
          WHERE event_type IN ('purchase_failed', 'restore_failed')) AS "clientPaymentErrors",
         (SELECT COUNT(*) FROM hour_ops WHERE event_type = 'ai_error') AS "aiErrors",
         (SELECT COALESCE(jsonb_agg(jsonb_build_object('section', section, 'count', count)
                  ORDER BY count DESC, section), '[]'::jsonb) FROM top_screens) AS "topScreens"`,
      [start.toISOString(), end.toISOString()],
    );
    const row = collected.rows[0];
    if (!row) throw new Error('NEBO_OPS_HOURLY_STATS_MISSING');
    const stats = Object.fromEntries(HOURLY_STAT_KEYS.map((key) => [key, Number(row[key])]));
    if (Object.values(stats).some((value) => !Number.isSafeInteger(value) || value < 0)) {
      throw new Error('NEBO_OPS_HOURLY_STATS_INVALID');
    }
    const payload = sanitizeNeboOpsPayload({
      hourStart: start.toISOString(), hourEnd: end.toISOString(), stats, topScreens: row.topScreens,
    });
    const inserted = await client.query(
      `INSERT INTO nebo_ops_outbox (event_key, event_type, payload_json, occurred_at)
       VALUES ($1, 'hourly_summary', $2::jsonb, $3)
       ON CONFLICT (event_key) DO NOTHING RETURNING id`,
      [eventKey, JSON.stringify(payload), end.toISOString()],
    );
    await client.query('COMMIT');
    return inserted.rowCount === 1;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function renderHourlySummary(payload: Payload): string {
  const start = validDate(payload.hourStart);
  const end = validDate(payload.hourEnd);
  const stats = (payload.stats || {}) as Payload;
  const count = (key: string) => typeof stats[key] === 'number' ? String(stats[key]) : 'нет данных';
  const lines = [
    '📊 NEBO · Итоги часа',
    start && end ? `🕒 ${moscowDateTime(start)} — ${moscowDateTime(end)} МСК` : '🕒 Период не указан',
    '',
    `👤 Новых аккаунтов: ${count('newUsers')}`,
    `👥 Всего аккаунтов сейчас: ${count('totalUsers')}`,
    `👋 Новые сессии: ${count('logins')}`,
    `🙋 Активных по событиям и сессиям: ${count('activeUsers')}`,
    `📍 Действий: ${count('actions')} · открытий экранов: ${count('screens')}`,
  ];
  const screens = payload.topScreens as Array<{ section: string; count: number }> | undefined;
  if (screens?.length) {
    lines.push('🧭 Самые посещаемые экраны:');
    for (const screen of screens) lines.push(`• ${SCREENS[screen.section] || 'Экран не определён'}: ${screen.count}`);
  }
  lines.push(
    '',
    `⭐ Платежи Stars: ${count('starsPurchases')} · валовая сумма: ${count('starsGross')} Stars`,
    `🟦 Подтверждения RuStore: ${count('rustoreConfirmations')} · тестовые: ${count('rustoreTestConfirmations')}`,
    `✉️ Новых обращений: ${count('supportTickets')}`,
    `⚠️ Ошибки оплаты и восстановления в приложении: ${count('clientPaymentErrors')}`,
    `🤖 Ошибки генерации ИИ: ${count('aiErrors')}`,
    '',
    'RuStore и ошибки ИИ — по серверным событиям с момента включения сбора.',
    'Валовая сумма Stars указана до вычета возвратов.',
  );
  return lines.join('\n').slice(0, 3_800);
}

export function renderNeboOpsMessage(row: Pick<OpsRow, 'event_type' | 'user_id' | 'payload_json' | 'occurred_at'>, user: UserSummary = {}): string {
  const p = sanitizeNeboOpsPayload(row.payload_json);
  if (row.event_type === 'hourly_summary') return renderHourlySummary(p);
  const detail = (p.eventPayload || {}) as Payload;
  const title = row.event_type === 'login'
    ? (p.isFirstLogin ? '👤 Первый вход' : '👋 Вход в приложение')
    : row.event_type === 'activity' ? (ACTIONS[String(p.eventType)] || '📍 Действие в приложении')
      : TITLES[row.event_type] || '📍 Событие NEBO';
  const lines = [title];
  if (row.user_id) lines.push(`🙋 ${text(user.name, 70) || 'Пользователь'} · ID ${row.user_id}`);
  else if (row.event_type === 'ai_error') lines.push('🙋 Пользователь: не определён');
  if (row.user_id) {
    const registeredAt = validDate(user.created_at);
    if (registeredAt) lines.push(`🗓 Регистрация: ${moscowDateTime(registeredAt)} МСК`);
    const premiumUntil = validDate(user.premium_until);
    if (user.has_premium === true) lines.push(`💎 Доступ сейчас: Premium${premiumUntil ? ` до ${moscowDateTime(premiumUntil)} МСК` : ''}`);
    else if (user.has_premium === false) lines.push('🔓 Доступ сейчас: бесплатный');
  }
  if (row.event_type === 'ai_error') {
    const operation = p.operation === 'personal_forecast'
      ? { label: 'Личный прогноз', endpoint: '/api/content/forecast/personal' }
      : p.operation === 'natal_question'
        ? { label: 'Спросить о себе', endpoint: '/api/content/natal/questions' }
        : null;
    if (operation) lines.push(`📍 Раздел: ${operation.label}`, `🌐 Запрос: ${operation.endpoint}`);
    const stage = p.stage === 'generation' ? 'Генерация' : p.stage === 'lazy_refresh' ? 'Обновление прогноза' : p.stage === 'request' ? 'Обработка запроса' : '';
    if (stage) lines.push(`🛠 Этап: ${stage}`);
    const period = p.period === 'day' ? 'Сегодня' : p.period === 'week' ? 'Неделя' : p.period === 'month' ? 'Месяц' : '';
    if (period) lines.push(`🗓 Период: ${period}`);
    if (p.errorCode) lines.push(`⚙️ Код: ${p.errorCode}`);
    if (typeof p.httpStatus === 'number') lines.push(`🌐 HTTP: ${p.httpStatus}`);
    if (typeof p.durationMs === 'number') lines.push(`⏱ Длительность: ${(p.durationMs / 1_000).toFixed(1).replace('.', ',')} с`);
    lines.push(`🖥 Исполнение: сервер${p.serverVersion ? ` · версия ${p.serverVersion}` : ''}`);
    if (p.reportId) lines.push(`🧾 Отчёт сервера: ${p.reportId}`);
    if (p.traceId) lines.push(`🔗 Метка запроса для сопоставления: ${p.traceId}`);
  }
  const provider = PROVIDERS[String(p.provider || user.auth_provider || '')];
  if (provider) lines.push(`🔐 ${row.event_type === 'login' ? 'Вход' : 'Провайдер'}: ${provider}`);
  if (p.runtime) lines.push(`📱 Платформа: ${p.runtime === 'native' ? 'Приложение' : p.runtime === 'telegram' ? 'Telegram Mini App' : 'Браузер'}`);
  if (row.event_type === 'login') {
    lines.push('🎯 Источник установки: не определён');
    lines.push(`🌐 Язык: ${user.language === 'en' ? 'en' : user.language === 'ru' ? 'ru' : 'не указан'}`);
  }
  if (p.section) lines.push(`📍 Экран: ${SCREENS[String(p.section)]}`);
  if (detail.section_key) lines.push(`📖 Раздел: ${detail.section_key}`);
  const plan = p.productCode || p.productId || p.planId || p.paymentType || detail.plan_id;
  if (plan) lines.push(`🧾 Тариф: ${plan}`);
  if (typeof p.starsAmount === 'number') lines.push(`⭐ Сумма: ${p.starsAmount} Stars`);
  if (p.sandbox === true) lines.push('🧪 Тестовая среда RuStore');
  if (typeof p.autoRenewing === 'boolean') lines.push(`🔄 Автопродление: ${p.autoRenewing ? 'включено' : 'выключено'}`);
  if (p.expiresAt) lines.push(`📅 Доступ до: ${new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', dateStyle: 'short', timeStyle: 'short' }).format(new Date(String(p.expiresAt)))} МСК`);
  if (typeof p.amountMinor === 'number' && p.currency) lines.push(`💵 Сумма: ${(p.amountMinor / 100).toFixed(2)} ${p.currency}`);
  if (typeof detail.price_micros === 'number' && detail.currency) lines.push(`🏷 Цена в приложении: ${(detail.price_micros / 1_000_000).toFixed(2)} ${detail.currency}`);
  if (typeof detail.depth_pct === 'number') lines.push(`📖 Прочитано: ${Math.min(100, detail.depth_pct)}%`);
  if (detail.reason_code) lines.push(`⚙️ Код: ${detail.reason_code}`);
  if (p.ticketId) lines.push(`🎫 Обращение: #${p.ticketId}`);
  const occurred = new Date(row.occurred_at);
  lines.push(`🕒 ${Number.isFinite(occurred.getTime()) ? new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(occurred) : 'время не указано'} МСК`);
  return lines.join('\n').slice(0, 3_800);
}

type WorkerState = {
  started: boolean; running: boolean; requested: boolean; connecting: boolean;
  listener: PoolClient | null; timer: ReturnType<typeof setInterval> | null;
  lastCleanupAt: number; lastHourlyCheckAt: number; configurationWarning: boolean;
};
const processState = globalThis as typeof globalThis & { __neboOpsWorkerV1?: WorkerState };
function worker(): WorkerState {
  return processState.__neboOpsWorkerV1 ??= {
    started: false, running: false, requested: false, connecting: false,
    listener: null, timer: null, lastCleanupAt: 0, lastHourlyCheckAt: 0, configurationWarning: false,
  };
}

/** All messages use the verified owner chat and share the per-chat rate limit. */
export async function sendNeboOpsText(message: string, options?: { replyMarkup?: TelegramReplyMarkup }): Promise<SendResult> {
  const config = getNeboOpsConfig();
  if (!config) return { ok: false, error: 'OPS_UNCONFIGURED' };
  let client: PoolClient | null = null;
  let locked = false;
  try {
    client = await getPool().connect();
    const lock = await client.query('SELECT pg_try_advisory_lock(2026090401) AS acquired');
    locked = lock.rows[0]?.acquired === true;
    if (!locked) return { ok: false, error: 'OPS_BUSY', retryAfterSeconds: 2, deferred: true };
    const availability = (await client.query(
      'SELECT next_send_at, cooldown_until FROM nebo_ops_delivery_state WHERE id = 1',
    )).rows[0];
    if (!availability) return { ok: false, error: 'OPS_UNCONFIGURED' };
    const cooldown = new Date(availability.cooldown_until).getTime() - Date.now();
    if (cooldown > 0) return { ok: false, error: 'TELEGRAM_RATE_LIMIT', retryAfterSeconds: Math.ceil(cooldown / 1000), deferred: true };
    const delay = new Date(availability.next_send_at).getTime() - Date.now();
    if (delay > 1_500) return { ok: false, error: 'OPS_BUSY', retryAfterSeconds: Math.ceil(delay / 1000), deferred: true };
    if (delay > 0) await new Promise<void>((resolve) => setTimeout(resolve, delay));
    await client.query("UPDATE nebo_ops_delivery_state SET next_send_at = NOW() + INTERVAL '1100 milliseconds' WHERE id = 1");
    try {
      const response = await fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: config.chatId, text: message.slice(0, 3_800), disable_web_page_preview: true, reply_markup: options?.replyMarkup }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.ok === true && Number.isSafeInteger(data.result?.message_id)) {
        return { ok: true, messageId: data.result.message_id };
      }
      const retryAfter = Number(data?.parameters?.retry_after);
      if (response.status === 429) {
        const seconds = Number.isFinite(retryAfter) ? Math.max(1, Math.min(86400, retryAfter)) : 30;
        await client.query(
          "UPDATE nebo_ops_delivery_state SET cooldown_until = NOW() + $1 * INTERVAL '1 second' WHERE id = 1", [seconds],
        );
        return { ok: false, error: 'TELEGRAM_RATE_LIMIT', retryAfterSeconds: seconds };
      }
      return { ok: false, error: response.status === 401 ? 'TELEGRAM_UNAUTHORIZED'
        : response.status === 403 ? 'TELEGRAM_FORBIDDEN' : response.status === 400 ? 'TELEGRAM_BAD_REQUEST' : 'TELEGRAM_UNAVAILABLE' };
    } catch {
      return { ok: false, error: 'TELEGRAM_NETWORK_ERROR' };
    }
  } catch {
    return { ok: false, error: 'OPS_STORAGE_UNAVAILABLE', retryAfterSeconds: 5, deferred: true };
  } finally {
    if (client) {
      if (locked) {
        try { await client.query('SELECT pg_advisory_unlock(2026090401)'); }
        catch { client.release(true); client = null; }
      }
      client?.release();
    }
  }
}

export async function processNeboOpsOutbox(limit = MAX_BATCH): Promise<{ sent: number; failed: number; claimed: number }> {
  const result = { sent: 0, failed: 0, claimed: 0 };
  if (!getNeboOpsConfig()) return result;
  const pool = getPool();
  await pool.query(
    `UPDATE nebo_ops_outbox SET status = CASE WHEN attempts >= $1 THEN 'dead' ELSE 'failed' END,
       locked_at = NULL, lease_token = NULL, next_attempt_at = NOW(), updated_at = NOW(),
       last_error_code = 'LEASE_EXPIRED'
     WHERE status = 'processing' AND locked_at < NOW() - INTERVAL '90 seconds'`, [MAX_ATTEMPTS],
  );
  const count = Number.isFinite(limit) ? Math.min(MAX_BATCH, Math.max(1, Math.trunc(limit))) : MAX_BATCH;
  for (let index = 0; index < count; index++) {
    const lease = randomUUID();
    const claim = await pool.query<OpsRow>(
      `UPDATE nebo_ops_outbox SET status = 'processing', attempts = attempts + 1,
         locked_at = NOW(), lease_token = $2::uuid, updated_at = NOW()
       WHERE id = (
         SELECT id FROM nebo_ops_outbox
         WHERE status IN ('pending', 'failed') AND next_attempt_at <= NOW() AND attempts < $1
         ORDER BY CASE WHEN event_type = 'activity' THEN 1 ELSE 0 END, next_attempt_at, id
         FOR UPDATE SKIP LOCKED LIMIT 1
       ) RETURNING id, event_type, user_id, payload_json, occurred_at, attempts, lease_token`,
      [MAX_ATTEMPTS, lease],
    );
    const row = claim.rows[0];
    if (!row) break;
    result.claimed++;
    const user = row.user_id ? (await pool.query<UserSummary>(
      `SELECT u.name, u.language, u.auth_provider,
              u.created_at,
              GREATEST(u.premium_until, p.active_until AT TIME ZONE 'UTC') AS premium_until,
              COALESCE(GREATEST(u.premium_until, p.active_until AT TIME ZONE 'UTC') > NOW(), FALSE) AS has_premium
       FROM users u
       LEFT JOIN LATERAL (
         SELECT MAX(ends_at) AS active_until FROM premium_entitlements
         WHERE user_id = u.id AND status = 'active' AND ends_at > (NOW() AT TIME ZONE 'UTC')
       ) p ON TRUE
       WHERE u.id = $1`, [row.user_id],
    )).rows[0] : undefined;
    // A concurrently deleted account must not produce a late identity notification.
    if (row.user_id && !user) {
      await pool.query('DELETE FROM nebo_ops_outbox WHERE id = $1 AND lease_token = $2::uuid', [row.id, lease]);
      continue;
    }
    const sent = await sendNeboOpsText(renderNeboOpsMessage(row, user));
    if (sent.ok) {
      await pool.query(
        `UPDATE nebo_ops_outbox SET status = 'sent', sent_at = NOW(), telegram_message_id = $3,
           locked_at = NULL, lease_token = NULL, last_error_code = NULL, updated_at = NOW()
         WHERE id = $1 AND lease_token = $2::uuid AND status = 'processing'`, [row.id, lease, sent.messageId],
      );
      result.sent++;
    } else {
      const delay = sent.deferred
        ? Math.max(1, sent.retryAfterSeconds || 2)
        : Math.max(sent.retryAfterSeconds || 0, Math.min(3600, 5 * 2 ** Math.max(0, Number(row.attempts) - 1)));
      await pool.query(
        `UPDATE nebo_ops_outbox SET status = CASE WHEN attempts - $6 >= $3 THEN 'dead' ELSE 'failed' END,
           attempts = GREATEST(0, attempts - $6),
           locked_at = NULL, lease_token = NULL, last_error_code = $4,
           next_attempt_at = NOW() + $5 * INTERVAL '1 second', updated_at = NOW()
         WHERE id = $1 AND lease_token = $2::uuid AND status = 'processing'`,
        [row.id, lease, MAX_ATTEMPTS, sent.error || 'DELIVERY_FAILED', delay, sent.deferred ? 1 : 0],
      );
      result.failed++;
      if (sent.retryAfterSeconds || sent.error === 'TELEGRAM_UNAUTHORIZED' || sent.error === 'TELEGRAM_FORBIDDEN') break;
    }
  }
  return result;
}

async function connectWakeupListener(): Promise<void> {
  const state = worker();
  if (state.listener || state.connecting) return;
  state.connecting = true;
  let client: PoolClient | null = null;
  try {
    client = await getPool().connect();
    const connected = client;
    const disconnect = () => {
      if (state.listener !== connected) return;
      state.listener = null;
      connected.release(true);
    };
    state.listener = connected;
    connected.on('error', disconnect);
    connected.on('end', disconnect);
    connected.on('notification', (event) => { if (event.channel === 'nebo_ops_ready') wakeNeboOpsDelivery(); });
    await connected.query('LISTEN nebo_ops_ready');
  } catch {
    if (client && state.listener === client) { state.listener = null; client.release(true); }
    console.warn('[nebo-ops] wakeup listener unavailable; retry polling remains active');
  } finally {
    state.connecting = false;
  }
}

export function wakeNeboOpsDelivery(): void {
  if (!isNeboOpsEnabled() || !getNeboOpsConfig()) return;
  if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') return;
  const state = worker();
  state.requested = true;
  if (state.running) return;
  state.running = true;
  void (async () => {
    try {
      do {
        state.requested = false;
        try {
          // Keep support retries on the same fast owner gateway cadence;
          // dynamic loading avoids a synchronous support delivery import cycle.
          const { processSupportDeliveryOutbox } = await import('./supportOutbox');
          await processSupportDeliveryOutbox(2, undefined, 'telegram');
        } catch {
          console.warn('[nebo-ops] support delivery deferred; owner events continue');
        }
        const result = await processNeboOpsOutbox();
        if (result.claimed === MAX_BATCH) state.requested = true;
        if (Date.now() - (state.lastHourlyCheckAt || 0) >= 60_000) {
          state.lastHourlyCheckAt = Date.now();
          try {
            if (await enqueueNeboOpsHourlySummary(new Date(state.lastHourlyCheckAt))) state.requested = true;
          } catch {
            console.warn('[nebo-ops] hourly summary deferred; delivery continues');
          }
        }
      } while (state.requested && getNeboOpsConfig());
      if (Date.now() - state.lastCleanupAt > 60 * 60 * 1000) {
        await getPool().query(
          `DELETE FROM nebo_ops_outbox WHERE id IN (
             SELECT id FROM nebo_ops_outbox WHERE status IN ('sent', 'dead')
               AND updated_at < NOW() - INTERVAL '30 days' ORDER BY id LIMIT 1000
           )`,
        );
        state.lastCleanupAt = Date.now();
      }
    } catch {
      console.warn('[nebo-ops] delivery deferred; durable queue will retry');
    } finally {
      state.running = false;
    }
  })();
}

export function ensureNeboOpsWorker(): void {
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test' || process.env.NEXT_RUNTIME === 'edge') return;
  const state = worker();
  if (!getNeboOpsConfig()) {
    if (isNeboOpsEnabled() && !state.configurationWarning) {
      state.configurationWarning = true;
      console.warn('[nebo-ops] enabled but the owner bot token/chat is not configured correctly');
    }
    return;
  }
  state.configurationWarning = false;
  if (state.started) return;
  state.started = true;
  void connectWakeupListener();
  wakeNeboOpsDelivery();
  state.timer = setInterval(() => {
    void connectWakeupListener();
    wakeNeboOpsDelivery();
  }, 5_000);
  state.timer.unref?.();
  console.log('[nebo-ops] owner notifications started; immediate delivery with retry polling');
}
