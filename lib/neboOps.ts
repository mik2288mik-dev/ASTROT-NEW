import { randomUUID } from 'crypto';
import { telegramApiRequest } from './telegramRelay';
import type { PoolClient } from 'pg';
import { getPool } from './db';
import type { TelegramReplyMarkup } from './telegramBot';
import {
  ensureNeboOpsBotSetup,
  ensureNeboOwnerChannelBotSetup,
  getNeboOpsPreferences,
  isNeboOpsEventEnabled,
} from './neboOpsSettings';
import { CHANNEL_LABELS, planLabel, planPriceRub, PROVIDER_LABELS, SCREEN_LABELS } from './neboOpsStats';

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
export type NeboOwnerChannel = 'payments' | 'support' | 'errors';
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
  mytracker_id?: string | null;
  attribution_source?: string | null;
  attribution_campaign?: string | null;
  attribution_at?: Date | string | null;
  visit_days?: number | string | null;
  paid_purchases?: number | string | null;
};
type SendResult = {
  ok: boolean;
  messageId?: number;
  error?: string;
  retryAfterSeconds?: number;
  deferred?: boolean;
  detail?: string;
};

const MAX_ATTEMPTS = 12;
const MAX_BATCH = 10;
const REQUEST_TIMEOUT_MS = 8_000;
const EVENT_TYPES = new Set([
  'login', 'activity', 'payment_confirmed', 'trial_started',
  'subscription_grace', 'subscription_cancelled', 'subscription_expired', 'subscription_resumed',
  'payment_refunded', 'support_ticket', 'diagnostic', 'hourly_summary', 'daily_summary', 'ai_error', 'technical_error', 'attribution_received',
]);
/** Everything the owner bots deliver. Reports are built on demand, never queued. */
const DELIVERED_EVENT_TYPES = [
  'login', 'payment_confirmed', 'trial_started', 'subscription_grace', 'subscription_cancelled',
  'subscription_expired', 'subscription_resumed', 'payment_refunded', 'support_ticket',
  'ai_error', 'technical_error', 'diagnostic', 'attribution_received',
];
const DELIVERED_ACTIVITY = ['paywall_view', 'app_open', 'app_opened', 'purchase_failed', 'restore_failed'];
const PAYMENT_EVENTS = new Set([
  'payment_confirmed', 'trial_started', 'subscription_grace', 'subscription_cancelled',
  'subscription_expired', 'subscription_resumed', 'payment_refunded',
]);
const ERROR_EVENTS = new Set(['ai_error', 'technical_error']);
const PROVIDER_CODES = new Set([
  ...Object.keys(PROVIDER_LABELS), 'telegram_stars', 'rustore', 'rustore_pay',
]);
const DISTRIBUTION_CHANNELS = new Set(['rustore', 'google_play', 'telegram', 'development']);
export const ACTIONS: Record<string, string> = {
  app_open: 'открыл приложение', app_opened: 'открыл приложение',
  paywall_view: 'открыл экран оплаты', purchase_failed: 'не смог оплатить — ошибка в приложении',
  restore_failed: 'не смог восстановить покупку', screen_view: 'открыл экран',
  first_result_ready: 'получил первый результат', first_value_viewed: 'посмотрел первый результат',
  natal_section_open: 'открыл раздел разбора', compatibility_ready: 'получил совместимость',
  person_added: 'добавил человека', future_open: 'открыл прогноз', question_sent: 'задал вопрос о себе',
  locked_feature_tapped: 'нажал закрытую функцию', premium_promo_impression: 'увидел предложение Premium',
  premium_promo_clicked: 'открыл предложение Premium', premium_promo_dismissed: 'закрыл предложение Premium',
  plan_selected: 'выбрал тариф', checkout_start: 'начал оплату', purchase_success: 'оплатил (данные приложения)',
  purchase_cancelled: 'отменил оплату', restore_started: 'восстанавливает покупки', restore_success: 'восстановил доступ',
  subscription_cancelled: 'отключил автопродление', subscription_expired: 'остался без Premium',
  share: 'нажал «Поделиться»', invite_open: 'открыл приглашение', natal_story_open: 'открыл разбор',
  natal_card_impression: 'читает разбор', natal_story_completed: 'дочитал разбор',
  natal_card_swipe_next: 'листает разбор', natal_readmore_tap: 'нажал «Читать дальше»',
  natal_sheet_open: 'открыл подробности', natal_today_cta_tap: 'перешёл к прогнозу',
  natal_checkin_cta_tap: 'открыл продолжение', natal_save_tap: 'нажал «Сохранить»',
  natal_share_tap: 'поделился разбором', natal_notifications_optin: 'изменил уведомления',
  natal_paywall_open: 'открыл Premium из разбора', natal_sheet_scroll_depth: 'читает разбор',
  natal_paywall_dismiss: 'закрыл Premium',
};
const ACTION_ICONS: Record<string, string> = {
  app_open: '👋', app_opened: '👋', paywall_view: '💳', purchase_failed: '⚠️', restore_failed: '⚠️',
};
const TITLES: Record<string, string> = {
  payment_confirmed: '💰 Оплата', trial_started: '🎁 Пробный период',
  subscription_grace: '⏳ Продление ждёт оплаты', subscription_cancelled: '↩️ Отключил автопродление',
  subscription_expired: '⌛ Подписка закончилась', payment_refunded: '↩️ Возврат денег',
  subscription_resumed: '✅ Подписка восстановлена',
  support_ticket: '✉️ Новое обращение', diagnostic: '🛠 Проверка уведомлений',
  ai_error: '🤖 Ошибка генерации ИИ', technical_error: '🚨 Ошибка сервера',
  attribution_received: '🎯 MyTracker определил источник',
};

function text(value: unknown, limit = 100): string {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit)
    : '';
}
function code(value: unknown): string {
  const clean = text(value, 80);
  return /^[a-zA-Z0-9_.:-]{1,80}$/.test(clean) ? clean : '';
}
function hardware(value: unknown, limit: number): string {
  const clean = text(value, limit);
  return /^[\p{L}\p{N}][\p{L}\p{N} ._()+/-]*$/u.test(clean) ? clean : '';
}
function positiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}
function validDate(value: unknown): Date | null {
  if (!(value instanceof Date) && typeof value !== 'string') return null;
  const date = new Date(value instanceof Date ? value.getTime() : value);
  return Number.isFinite(date.getTime()) ? date : null;
}
function moscowDate(value: Date): string {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', dateStyle: 'short' }).format(value);
}
function moscowDateTime(value: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(value);
}
function daysWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня';
  return 'дней';
}

/** A secondary server (NEBO_OPS_ROLE=secondary) sends its own event cards only:
 * no bot webhooks/commands, scheduled reports or alarms — the primary owns those. */
export function isNeboOpsSecondary(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NEBO_OPS_ROLE === 'secondary';
}

export function isNeboOpsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NEBO_OPS_TELEGRAM_ENABLED === '1';
}

/** Which server wrote the message: two deployments can share the same bots. */
export function neboServerLabel(env: NodeJS.ProcessEnv = process.env): string {
  const configured = text(env.NEBO_SERVER_LABEL, 40);
  if (configured) return configured;
  return env.RAILWAY_ENVIRONMENT_ID || env.RAILWAY_PROJECT_ID ? 'Railway' : 'Timeweb';
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

/** Dedicated delivery bots never fall back to the notification bot: a payment
 * or support alert must not be mixed into the owner events stream. */
export function getNeboOwnerChannelConfig(
  channel: NeboOwnerChannel,
  env: NodeJS.ProcessEnv = process.env,
): NeboOpsConfig | null {
  const prefix = channel === 'payments' ? 'NEBO_PAYMENTS' : channel === 'support' ? 'NEBO_SUPPORT' : 'NEBO_ERRORS';
  const token = String(env[`${prefix}_BOT_TOKEN`] || '').trim();
  const chatId = String(env[`${prefix}_CHAT_ID`] || env.OWNER_ID || '').trim();
  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token) || !/^[1-9]\d{0,15}$/.test(chatId)) return null;
  return { token, chatId };
}

/** Copy only operational fields. Never copy questions, birth data, receipts or raw errors. */
export function sanitizeNeboOpsPayload(input: Payload = {}): Payload {
  const result: Payload = {};
  for (const key of ['attributionSource', 'attributionCampaign']) {
    const value = text(input[key], 120);
    if (value && !/[{}]/.test(value)) result[key] = value;
  }
  for (const key of ['attributionTrafficType', 'attributionCampaignId', 'attributionMethod']) {
    const value = code(input[key]);
    if (value) result[key] = value;
  }
  const attributionAt = validDate(input.attributionAt);
  if (attributionAt) result.attributionAt = attributionAt.toISOString();
  if (input.operation === 'personal_forecast' || input.operation === 'natal_question') result.operation = input.operation;
  if (['generation', 'lazy_refresh', 'request'].includes(String(input.stage))) result.stage = input.stage;
  if (['day', 'week', 'month'].includes(String(input.period))) result.period = input.period;
  if (typeof input.errorCode === 'string' && /^[A-Za-z0-9_.:-]{1,80}$/.test(input.errorCode)) result.errorCode = input.errorCode;
  if (typeof input.reportId === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(input.reportId)) result.reportId = input.reportId;
  if (typeof input.traceId === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(input.traceId)) result.traceId = input.traceId;
  if (typeof input.serverVersion === 'string' && /^[0-9a-f]{7,40}$/i.test(input.serverVersion)) result.serverVersion = input.serverVersion;
  for (const key of ['scope', 'diagnosticEvent', 'surface', 'source']) {
    const value = code(input[key]);
    if (value) result[key] = value;
  }
  if (input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)) {
    const source = input.metadata as Payload;
    const metadata: Payload = {};
    for (const key of ['side', 'stage', 'httpStatus', 'nodeEnv', 'blocks', 'tier', 'requestedTier', 'resolvedTier', 'modelTier', 'swisseph', 'algorithmic', 'mixed', 'unavailable']) {
      const value = source[key];
      if (typeof value === 'boolean') metadata[key] = value;
      else if (typeof value === 'number' && Number.isFinite(value)) metadata[key] = value;
      else {
        const safe = text(value, 100);
        if (safe) metadata[key] = safe;
      }
    }
    result.metadata = metadata;
  }
  const httpStatus = positiveNumber(input.httpStatus);
  if (httpStatus !== undefined && Number.isInteger(httpStatus) && httpStatus >= 100 && httpStatus <= 599) result.httpStatus = httpStatus;
  const durationMs = positiveNumber(input.durationMs);
  if (durationMs !== undefined && Number.isSafeInteger(durationMs)) result.durationMs = durationMs;
  if (typeof input.isFirstLogin === 'boolean') result.isFirstLogin = input.isFirstLogin;
  const provider = code(input.provider);
  if (PROVIDER_CODES.has(provider)) result.provider = provider;
  const distributionChannel = code(input.distributionChannel);
  if (DISTRIBUTION_CHANNELS.has(distributionChannel)) result.distributionChannel = distributionChannel;
  if (['native', 'web', 'telegram'].includes(String(input.runtime))) result.runtime = input.runtime;
  if (['Android', 'iOS', 'Windows', 'macOS', 'Linux'].includes(String(input.osName))) result.osName = input.osName;
  for (const [key, limit] of [['deviceManufacturer', 40], ['deviceModel', 80], ['osVersion', 40]] as const) {
    const value = hardware(input[key], limit);
    if (value) result[key] = value;
  }
  if (typeof input.sandbox === 'boolean') result.sandbox = input.sandbox;
  if (typeof input.autoRenewing === 'boolean') result.autoRenewing = input.autoRenewing;
  if (typeof input.expiresAt === 'string' && Number.isFinite(Date.parse(input.expiresAt))) {
    result.expiresAt = new Date(input.expiresAt).toISOString();
  }
  if (typeof input.appVersion === 'string' && /^[0-9][0-9A-Za-z.+-]{0,63}$/.test(input.appVersion)) {
    result.appVersion = input.appVersion;
  }
  if (typeof input.versionCode === 'number' && Number.isSafeInteger(input.versionCode) && input.versionCode >= 0) {
    result.versionCode = input.versionCode;
  }
  const eventType = code(input.eventType);
  if (Object.prototype.hasOwnProperty.call(ACTIONS, eventType)) result.eventType = eventType;
  const section = code(input.section);
  if (Object.prototype.hasOwnProperty.call(SCREEN_LABELS, section)) result.section = section;
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

export function shouldDeliverNeboOpsEvent(eventType: string, payload: Payload = {}): boolean {
  return DELIVERED_EVENT_TYPES.includes(eventType)
    || (eventType === 'activity' && DELIVERED_ACTIVITY.includes(String(payload?.eventType)));
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
    const payload = sanitizeNeboOpsPayload(input.payload);
    const deliver = shouldDeliverNeboOpsEvent(input.eventType, payload);
    await db.query(
      `INSERT INTO nebo_ops_outbox (event_key, event_type, user_id, payload_json, occurred_at, status, last_error_code)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
       ON CONFLICT (event_key) DO NOTHING`,
      [input.eventKey, input.eventType, input.userId || null,
        JSON.stringify(payload), input.occurredAt || new Date(),
        deliver ? 'pending' : 'dead', deliver ? null : 'OWNER_SCOPE_FILTERED'],
    );
  } catch {
    await db.query('ROLLBACK TO SAVEPOINT nebo_ops_enqueue');
    console.warn('[nebo-ops] notification could not be queued; business transaction preserved');
  } finally {
    await db.query('RELEASE SAVEPOINT nebo_ops_enqueue');
  }
}

function personLine(row: { user_id: string | null }, user: UserSummary): string | null {
  if (!row.user_id) return null;
  return `🙋 ${text(user.name, 70) || 'Без имени'} · ID ${row.user_id}`;
}

function deviceLines(p: Payload): string[] {
  const lines: string[] = [];
  const maker = String(p.deviceManufacturer || '');
  const model = String(p.deviceModel || '');
  const device = [maker && !model.toLowerCase().startsWith(maker.toLowerCase()) ? maker : '', model]
    .filter(Boolean).join(' ');
  const os = p.osName ? `${p.osName}${p.osVersion ? ` ${p.osVersion}` : ''}` : '';
  if (device || os) lines.push(`📱 ${[device, os].filter(Boolean).join(' · ')}`);
  const version = p.appVersion ? `NEBO ${p.appVersion}${typeof p.versionCode === 'number' ? ` (${p.versionCode})` : ''}` : '';
  const channel = CHANNEL_LABELS[String(p.distributionChannel || '')];
  const where = p.runtime === 'telegram' ? 'Telegram Mini App'
    : p.runtime === 'web' ? 'сайт в браузере'
      : channel ? `установлено из ${channel}` : p.runtime === 'native' ? 'приложение' : '';
  const app = [version, where].filter(Boolean).join(' · ');
  if (app) lines.push(`📦 ${app.charAt(0).toUpperCase()}${app.slice(1)}`);
  return lines;
}

function accountLines(row: OpsRow | Pick<OpsRow, 'event_type' | 'user_id'>, user: UserSummary, p: Payload): string[] {
  if (!row.user_id) return [];
  const lines: string[] = [];
  const provider = PROVIDER_LABELS[String(p.provider || user.auth_provider || '')];
  if (provider) lines.push(`🔐 Вход: ${provider}`);
  const registeredAt = validDate(user.created_at);
  const visitDays = Number(user.visit_days || 0);
  if (registeredAt) {
    lines.push(`📅 С нами с ${moscowDate(registeredAt)}${visitDays > 0 ? ` · заходил ${visitDays} ${daysWord(visitDays)}` : ''}`);
  }
  const premiumUntil = validDate(user.premium_until);
  if (user.has_premium === true) lines.push(`💎 Premium${premiumUntil ? ` до ${moscowDate(premiumUntil)}` : ''}`);
  else if (user.has_premium === false) lines.push('🔓 Бесплатный доступ');
  return lines;
}

function sourceLine(p: Payload, user: UserSummary): string | null {
  const source = text(user.attribution_source, 120);
  const campaign = text(user.attribution_campaign, 120);
  if (source) return `🎯 Реклама: ${source}${campaign ? ` · ${campaign}` : ''}`;
  if (user.mytracker_id) return '🎯 Реклама: ждём данные MyTracker';
  if (p.distributionChannel === 'rustore') return '🎯 Реклама: нет, сам нашёл в RuStore';
  return null;
}

function footer(occurredAt: Date | string, p: Payload): string {
  const occurred = validDate(occurredAt);
  const version = p.serverVersion ? ` · сборка ${String(p.serverVersion).slice(0, 7)}` : '';
  const time = occurred
    ? new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).format(occurred)
    : 'время не указано';
  return `🕒 ${time} МСК · 🖥 ${neboServerLabel()}${version}`;
}

function renderPayment(row: Pick<OpsRow, 'event_type' | 'user_id' | 'occurred_at'>, user: UserSummary, p: Payload): string[] {
  const detail = (p.eventPayload || {}) as Payload;
  const product = String(p.productCode || p.productId || p.planId || detail.plan_id || '');
  const price = product ? planPriceRub(product) : 0;
  const title = TITLES[row.event_type] || '💳 Подписка';
  const lines = [`${title}${product ? ` · ${planLabel(product)}` : ''}${row.event_type === 'payment_confirmed' && price ? ` · ${price} ₽` : ''}`];
  const person = personLine(row, user);
  if (person) lines.push(person);
  if (row.event_type === 'payment_confirmed') {
    const paid = Number(user.paid_purchases || 0);
    if (row.user_id) lines.push(paid > 1 ? `🔁 Продление · всего оплат: ${paid}` : '🆕 Первая покупка');
  }
  if (typeof p.amountMinor === 'number' && p.currency) lines.push(`💵 Сумма: ${(p.amountMinor / 100).toFixed(2)} ${p.currency}`);
  if (typeof p.starsAmount === 'number') lines.push(`⭐ Сумма: ${p.starsAmount} Stars`);
  const expiresAt = validDate(p.expiresAt);
  if (expiresAt) lines.push(`📅 Доступ до ${moscowDate(expiresAt)}`);
  if (typeof p.autoRenewing === 'boolean') lines.push(`🔄 Автопродление ${p.autoRenewing ? 'включено' : 'выключено'}`);
  if (p.sandbox === true) lines.push('🧪 Тестовая оплата RuStore (не настоящие деньги)');
  const provider = PROVIDER_LABELS[String(user.auth_provider || '')];
  if (provider) lines.push(`🔐 Вход: ${provider}`);
  return lines;
}

/** Plain-language meaning of the error codes the owner can actually receive. */
export const ERROR_REASONS: Record<string, string> = {
  PERSONAL_FORECAST_WRITER_VALIDATION_FAILED: 'ИИ написал текст, но он не прошёл нашу автоматическую проверку качества',
  PERSONAL_FORECAST_WRITER_UNAVAILABLE: 'ИИ (OpenAI) не ответил — сбой или недоступность сервиса',
  PERSONAL_FORECAST_WRITER_OUTPUT_LIMIT: 'ИИ не уложился в лимит длины ответа',
  PERSONAL_FORECAST_WRITER_INCOMPLETE: 'ИИ оборвал ответ на середине',
  PERSONAL_FORECAST_WRITER_REFUSED: 'ИИ отказался писать этот текст',
  PERSONAL_FORECAST_EVIDENCE_EMPTY: 'по карте человека не нашлось данных для прогноза',
  PERSONAL_FORECAST_CACHE_WRITE_FAILED: 'текст написан, но не сохранился в базе',
  PERSONAL_FORECAST_GENERATION_FAILED: 'генерация прогноза упала с неизвестной ошибкой',
  AI_GENERATION_TIMEOUT: 'ИИ думал слишком долго, ответ не дождались',
  AI_GENERATION_FAILED: 'генерация упала с неизвестной ошибкой',
};
const ERROR_ADVICE: Record<string, string> = {
  PERSONAL_FORECAST_WRITER_VALIDATION_FAILED: 'Если повторяется часто — проверка слишком строгая или ИИ пишет не по правилам, нужно смотреть тексты.',
  PERSONAL_FORECAST_WRITER_UNAVAILABLE: 'Обычно проходит само. Если идёт подряд — проверь ключ и баланс OpenAI.',
  AI_GENERATION_TIMEOUT: 'Если идёт подряд — OpenAI тормозит, обычно проходит само.',
};
export const OPERATION_TITLES: Record<string, string> = {
  personal_forecast: 'личный прогноз', natal_question: 'ответ на вопрос «Спросить о себе»',
};
const PERIOD_TITLES: Record<string, string> = { day: 'на сегодня', week: 'на неделю', month: 'на месяц' };

export type NeboErrorContext = { repeats?: number; now?: Date };

function renderError(
  row: Pick<OpsRow, 'event_type' | 'user_id' | 'occurred_at'>,
  user: UserSummary,
  p: Payload,
  context: NeboErrorContext,
): string[] {
  const errorCode = String(p.errorCode || '');
  const lines: string[] = [];
  if (row.event_type === 'ai_error') {
    const what = OPERATION_TITLES[String(p.operation)] || 'текст от ИИ';
    const period = p.operation === 'personal_forecast' ? PERIOD_TITLES[String(p.period)] || '' : '';
    lines.push(`🤖 Не получился ${what}${period ? ` ${period}` : ''}`);
    lines.push(`Причина: ${ERROR_REASONS[errorCode] || 'неизвестная ошибка генерации'}.`);
    const clientError = typeof p.httpStatus === 'number' && p.httpStatus >= 500;
    lines.push(clientError || p.stage === 'generation' || p.stage === 'request'
      ? 'Человек увидел: сообщение об ошибке вместо текста (может нажать «повторить»).'
      : 'Человек увидел: старый текст, обновить не удалось.');
  } else {
    lines.push('🚨 Ошибка на сервере');
    const where = [p.scope, p.diagnosticEvent].filter(Boolean).join(' · ');
    if (where) lines.push(`Где: ${where}${p.surface ? ` · ${p.surface}` : ''}`);
    if (errorCode || p.status) lines.push(`Что: ${[errorCode, p.status].filter(Boolean).join(' · ')}`);
  }
  const person = personLine(row, user);
  lines.push(person || '🙋 Кто: не вошедший пользователь или запрос без аккаунта');
  if (typeof p.durationMs === 'number' && p.durationMs >= 1_000) {
    lines.push(`⏱ Ждал ${Math.round(p.durationMs / 1_000)} с`);
  }
  const repeats = Number(context.repeats || 0);
  if (repeats > 1) lines.push(`🔁 Такая же ошибка за последний час: ${repeats} раз`);
  const occurred = validDate(row.occurred_at);
  const now = context.now || new Date();
  if (occurred && now.getTime() - occurred.getTime() > 60 * 60 * 1_000) lines.push('⏳ Ошибка старая — пришла с опозданием');
  const advice = ERROR_ADVICE[errorCode];
  if (advice) lines.push(`💡 ${advice}`);
  const dev = [errorCode, typeof p.httpStatus === 'number' ? `HTTP ${p.httpStatus}` : '', p.traceId ? `trace ${p.traceId}` : '']
    .filter(Boolean).join(' · ');
  if (dev) lines.push(`🔧 Для разработчика: ${dev}`);
  return lines;
}

export function renderNeboOpsMessage(
  row: Pick<OpsRow, 'event_type' | 'user_id' | 'payload_json' | 'occurred_at'>,
  user: UserSummary = {},
  errorContext: NeboErrorContext = {},
): string {
  const p = sanitizeNeboOpsPayload(row.payload_json);
  const name = text(user.name, 70) || 'Пользователь';
  let lines: string[];
  if (row.event_type === 'login') {
    lines = [p.isFirstLogin ? `👤 Новый пользователь · ${name}` : `🔑 ${name} вошёл в аккаунт`];
    const person = personLine(row, user);
    if (person) lines.push(person);
    lines.push(...deviceLines(p), ...accountLines(row, user, p));
    const source = p.isFirstLogin ? sourceLine(p, user) : null;
    if (source) lines.push(source);
    if (user.language === 'en') lines.push('🌐 Язык: английский');
  } else if (row.event_type === 'activity') {
    const action = String(p.eventType || '');
    lines = [`${ACTION_ICONS[action] || '📍'} ${name} ${ACTIONS[action] || 'сделал действие'}`];
    const person = personLine(row, user);
    if (person) lines.push(person);
    lines.push(...deviceLines(p), ...accountLines(row, user, p));
    if (p.section && action !== 'app_open' && action !== 'app_opened') lines.push(`📍 Экран: ${SCREEN_LABELS[String(p.section)]}`);
    const detail = (p.eventPayload || {}) as Payload;
    if (detail.plan_id) lines.push(`🧾 Тариф: ${planLabel(String(detail.plan_id))}`);
    if (detail.reason_code) lines.push(`⚙️ Код: ${detail.reason_code}`);
  } else if (PAYMENT_EVENTS.has(row.event_type)) {
    lines = renderPayment(row, user, p);
  } else if (ERROR_EVENTS.has(row.event_type)) {
    lines = renderError(row, user, p, errorContext);
  } else if (row.event_type === 'attribution_received') {
    lines = [TITLES.attribution_received];
    const person = personLine(row, user);
    if (person) lines.push(person);
    lines.push(`🎯 Источник: ${p.attributionSource || 'не определён'}`);
    if (p.attributionCampaign) lines.push(`📣 Кампания: ${p.attributionCampaign}`);
  } else {
    lines = [TITLES[row.event_type] || '📍 Событие NEBO'];
    const person = personLine(row, user);
    if (person) lines.push(person);
    if (p.ticketId) lines.push(`🎫 Обращение #${p.ticketId}`);
  }
  lines.push(footer(row.occurred_at, p));
  return lines.join('\n').slice(0, 3_800);
}

type WorkerState = {
  started: boolean; running: boolean; requested: boolean; connecting: boolean;
  listener: PoolClient | null; timer: ReturnType<typeof setInterval> | null;
  lastCleanupAt: number; lastReportCheckAt: number; configurationWarning: boolean;
  runningSince: number; lastRunAt: number; lastSent: number; lastFailed: number;
  lastError: string | null; lastErrorAt: number;
};
const processState = globalThis as typeof globalThis & { __neboOpsWorkerV2?: WorkerState };
function worker(): WorkerState {
  return processState.__neboOpsWorkerV2 ??= {
    started: false, running: false, requested: false, connecting: false,
    listener: null, timer: null, lastCleanupAt: 0, lastReportCheckAt: 0, configurationWarning: false,
    runningSince: 0, lastRunAt: 0, lastSent: 0, lastFailed: 0, lastError: null, lastErrorAt: 0,
  };
}

const iso = (ms: number) => (ms ? new Date(ms).toISOString() : null);

/** What the owner-bot worker is doing in this process (no secrets, for the status check). */
export function getNeboOpsWorkerStatus() {
  const state = worker();
  return {
    started: state.started, running: state.running, runningSince: iso(state.runningSince),
    listener: Boolean(state.listener), lastRunAt: iso(state.lastRunAt), lastSent: state.lastSent,
    lastFailed: state.lastFailed, lastError: state.lastError, lastErrorAt: iso(state.lastErrorAt),
    lastReportCheckAt: iso(state.lastReportCheckAt),
  };
}

function rememberWorkerError(state: WorkerState, error: unknown): void {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  // Bot tokens can appear in fetch URLs; never keep them.
  state.lastError = message.replace(/\d{5,}:[A-Za-z0-9_-]{20,}/g, '<token>').slice(0, 300);
  state.lastErrorAt = Date.now();
}

/** All messages use the verified owner chat and share the per-chat rate limit. */
async function sendNeboOpsWithConfig(
  config: NeboOpsConfig | null,
  method: 'sendMessage' | 'sendPhoto',
  body: Payload,
): Promise<SendResult> {
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
      const response = await telegramApiRequest(config.token, method, { chat_id: config.chatId, ...body },
        { signal: AbortSignal.timeout(method === 'sendPhoto' ? 20_000 : REQUEST_TIMEOUT_MS) });
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
        : response.status === 403 ? 'TELEGRAM_FORBIDDEN' : response.status === 400 ? 'TELEGRAM_BAD_REQUEST' : 'TELEGRAM_UNAVAILABLE',
        detail: `HTTP ${response.status} ${String(data?.description || '')}`.replace(/\d{5,}:[A-Za-z0-9_-]{20,}/g, '<token>').slice(0, 160) };
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

function withoutWebAppButtons(markup: TelegramReplyMarkup): TelegramReplyMarkup | undefined {
  const keyboard = (markup as { inline_keyboard?: Array<Array<Record<string, unknown>>> }).inline_keyboard;
  if (!Array.isArray(keyboard)) return undefined;
  const rows = keyboard.map((row) => row.filter((button) => !button.web_app)).filter((row) => row.length);
  return { inline_keyboard: rows } as TelegramReplyMarkup;
}

export async function sendNeboOpsTextWithConfig(
  config: NeboOpsConfig | null,
  message: string,
  options?: { replyMarkup?: TelegramReplyMarkup; interactive?: boolean },
): Promise<SendResult> {
  const send = (replyMarkup?: TelegramReplyMarkup) => sendNeboOpsWithConfig(config, 'sendMessage', {
    text: message.slice(0, 3_800),
    disable_web_page_preview: true,
    reply_markup: replyMarkup,
  });
  if (!options?.interactive) return send(options?.replyMarkup);
  // A reply to the owner's tap must arrive: wait for the shared sender instead
  // of dropping it, and fall back to a menu without the Mini App button.
  let result = await send(options.replyMarkup);
  for (let attempt = 0; attempt < 8 && !result.ok && result.deferred; attempt++) {
    await new Promise<void>((resolve) => setTimeout(resolve, Math.min(3, Math.max(1, result.retryAfterSeconds || 1)) * 1_000));
    result = await send(options.replyMarkup);
  }
  if (!result.ok && result.error === 'TELEGRAM_BAD_REQUEST' && options.replyMarkup) {
    result = await send(withoutWebAppButtons(options.replyMarkup));
  }
  if (!result.ok) rememberWorkerError(worker(), new Error(`REPLY_FAILED:${result.error || 'UNKNOWN'} ${result.detail || ''}`.trim()));
  return result;
}

/** Messages the owner asked for (menu, reports): retried until the shared sender is free. */
export async function sendNeboOpsText(message: string, options?: { replyMarkup?: TelegramReplyMarkup }): Promise<SendResult> {
  return sendNeboOpsTextWithConfig(getNeboOpsConfig(), message, { ...options, interactive: true });
}

export async function sendNeboOpsPhotoWithConfig(config: NeboOpsConfig | null, photoUrl: string, caption: string): Promise<SendResult> {
  return sendNeboOpsWithConfig(config, 'sendPhoto', { photo: photoUrl, caption: caption.slice(0, 1_000) });
}

export async function sendNeboOpsPhoto(photoUrl: string, caption: string): Promise<SendResult> {
  return sendNeboOpsPhotoWithConfig(getNeboOpsConfig(), photoUrl, caption);
}

function destinationFor(eventType: string): { config: NeboOpsConfig | null; missing?: string } {
  if (PAYMENT_EVENTS.has(eventType)) {
    const config = getNeboOwnerChannelConfig('payments');
    return config ? { config } : { config: null, missing: 'PAYMENTS_BOT_UNCONFIGURED' };
  }
  if (eventType === 'support_ticket') {
    const config = getNeboOwnerChannelConfig('support');
    return config ? { config } : { config: null, missing: 'SUPPORT_BOT_UNCONFIGURED' };
  }
  // Errors go to their own bot when it exists, otherwise to the support bot
  // (owner's choice), and only without either to the events bot.
  if (ERROR_EVENTS.has(eventType)) {
    return { config: getNeboOwnerChannelConfig('errors') || getNeboOwnerChannelConfig('support') || getNeboOpsConfig() };
  }
  return { config: getNeboOpsConfig() };
}

export async function processNeboOpsOutbox(limit = MAX_BATCH): Promise<{ sent: number; failed: number; claimed: number }> {
  const result = { sent: 0, failed: 0, claimed: 0 };
  if (!getNeboOpsConfig()) return result;
  const pool = getPool();
  const preferences = await getNeboOpsPreferences();
  await pool.query(
    `UPDATE nebo_ops_outbox SET status = CASE WHEN attempts >= $1 THEN 'dead' ELSE 'failed' END,
       locked_at = NULL, lease_token = NULL, next_attempt_at = NOW(), updated_at = NOW(),
       last_error_code = 'LEASE_EXPIRED'
     WHERE status = 'processing' AND locked_at < NOW() - INTERVAL '90 seconds'`, [MAX_ATTEMPTS],
  );
  // Facts stay stored for statistics; only the owner-visible scope is delivered.
  await pool.query(
    `UPDATE nebo_ops_outbox SET status = 'dead', locked_at = NULL, lease_token = NULL,
       last_error_code = 'OWNER_SCOPE_FILTERED', updated_at = NOW()
     WHERE status IN ('pending', 'failed')
       AND NOT (event_type = ANY($1::text[])
         OR (event_type = 'activity' AND COALESCE(payload_json->>'eventType', '') = ANY($2::text[])))`,
    [DELIVERED_EVENT_TYPES, DELIVERED_ACTIVITY],
  );
  // A day-old visit or error is noise; money and support tickets are always delivered.
  await pool.query(
    `UPDATE nebo_ops_outbox SET status = 'dead', locked_at = NULL, lease_token = NULL,
       last_error_code = 'STALE_SKIPPED', updated_at = NOW()
     WHERE status IN ('pending', 'failed') AND occurred_at < NOW() - INTERVAL '24 hours'
       AND NOT (event_type = ANY($1::text[]))`,
    [[...PAYMENT_EVENTS, 'support_ticket']],
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
           AND (event_type = ANY($3::text[])
             OR (event_type = 'activity' AND payload_json->>'eventType' = ANY($4::text[])))
         ORDER BY CASE WHEN event_type = 'activity' THEN 1 ELSE 0 END, next_attempt_at, id
         FOR UPDATE SKIP LOCKED LIMIT 1
       ) RETURNING id, event_type, user_id, payload_json, occurred_at, attempts, lease_token`,
      [MAX_ATTEMPTS, lease, DELIVERED_EVENT_TYPES, DELIVERED_ACTIVITY],
    );
    const row = claim.rows[0];
    if (!row) break;
    result.claimed++;
    if (!shouldDeliverNeboOpsEvent(row.event_type, row.payload_json)) {
      await pool.query(
        `UPDATE nebo_ops_outbox SET status = 'dead', attempts = GREATEST(0, attempts - 1),
           locked_at = NULL, lease_token = NULL, last_error_code = 'OWNER_SCOPE_FILTERED', updated_at = NOW()
         WHERE id = $1 AND lease_token = $2::uuid AND status = 'processing'`,
        [row.id, lease],
      );
      continue;
    }
    if (!isNeboOpsEventEnabled(row.event_type, row.payload_json, preferences)) {
      await pool.query(
        `UPDATE nebo_ops_outbox SET status = 'dead', attempts = GREATEST(0, attempts - 1),
           locked_at = NULL, lease_token = NULL, last_error_code = 'OWNER_SETTING_DISABLED', updated_at = NOW()
         WHERE id = $1 AND lease_token = $2::uuid AND status = 'processing'`,
        [row.id, lease],
      );
      continue;
    }
    const includeMyTracker = process.env.MYTRACKER_ENABLED === '1';
    const user = row.user_id ? (await pool.query<UserSummary>(
      `SELECT u.name, u.language, u.auth_provider,
              u.created_at,
              ${includeMyTracker ? `mt.analytics_user_id::text AS mytracker_id,
              mt.traffic_source AS attribution_source, mt.campaign_title AS attribution_campaign,
              mt.attribution_at,` : ''}
              (SELECT COUNT(DISTINCT ((e.occurred_at AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Moscow')::date)
                 FROM user_app_events e WHERE e.user_id = u.id)::int AS visit_days,
              (SELECT COUNT(*) FROM store_purchases sp
                 WHERE sp.user_id = u.id AND sp.status NOT IN ('store_trial', 'refunded'))::int AS paid_purchases,
              GREATEST(u.premium_until, p.active_until AT TIME ZONE 'UTC') AS premium_until,
              COALESCE(GREATEST(u.premium_until, p.active_until AT TIME ZONE 'UTC') > NOW(), FALSE) AS has_premium
       FROM users u
       ${includeMyTracker ? 'LEFT JOIN mytracker_users mt ON mt.user_id = u.id' : ''}
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
    const errorContext: NeboErrorContext = {};
    if (ERROR_EVENTS.has(row.event_type)) {
      // One message per kind of failure every 10 minutes; it says how often it repeated.
      const same = (await pool.query(
        `SELECT COUNT(*)::int AS repeats,
                COUNT(*) FILTER (WHERE status = 'sent' AND sent_at > NOW() - INTERVAL '10 minutes')::int AS recently_sent
         FROM nebo_ops_outbox
         WHERE event_type = $1 AND id <> $2 AND occurred_at > NOW() - INTERVAL '1 hour'
           AND COALESCE(payload_json->>'errorCode', '') = $3
           AND COALESCE(payload_json->>'operation', payload_json->>'scope', '') = $4`,
        [row.event_type, row.id, String(row.payload_json?.errorCode || ''),
          String(row.payload_json?.operation || row.payload_json?.scope || '')],
      )).rows[0] || {};
      if (Number(same.recently_sent || 0) > 0) {
        await pool.query(
          `UPDATE nebo_ops_outbox SET status = 'dead', attempts = GREATEST(0, attempts - 1),
             locked_at = NULL, lease_token = NULL, last_error_code = 'GROUPED_DUPLICATE', updated_at = NOW()
           WHERE id = $1 AND lease_token = $2::uuid AND status = 'processing'`,
          [row.id, lease],
        );
        continue;
      }
      errorContext.repeats = Number(same.repeats || 0) + 1;
    }
    const destination = destinationFor(row.event_type);
    const sent = destination.config
      ? await sendNeboOpsTextWithConfig(destination.config, renderNeboOpsMessage(row, user, errorContext))
      : { ok: false, error: destination.missing || 'OPS_UNCONFIGURED', retryAfterSeconds: 300 };
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
      rememberWorkerError(worker(), new Error(`SEND_FAILED:${row.event_type}:${sent.error || 'UNKNOWN'} ${'detail' in sent && sent.detail ? sent.detail : ''}`.trim()));
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

let lastAlarmCheckAt = 0;
let lastVisitScanAt = 0;

/**
 * Every app activity after 30 quiet minutes is a visit, whatever the client did on
 * open (a resumed native app does not re-register its session). Queue one owner
 * «открыл приложение» per such visit unless a visit or login was already queued.
 */
export async function queueDetectedNeboVisits(): Promise<number> {
  if (!isNeboOpsEnabled()) return 0;
  const result = await getPool().query(
    `WITH starts AS (
       SELECT e.id, e.user_id, e.section, e.occurred_at
       FROM user_app_events e
       WHERE e.user_id IS NOT NULL AND e.occurred_at > (NOW() AT TIME ZONE 'UTC') - INTERVAL '15 minutes'
         AND COALESCE(e.source, '') NOT IN ('rustore_callback', 'entitlement_expiry')
         AND NOT EXISTS (SELECT 1 FROM user_app_events p WHERE p.user_id = e.user_id
           AND p.occurred_at < e.occurred_at AND p.occurred_at >= e.occurred_at - INTERVAL '30 minutes')
     )
     INSERT INTO nebo_ops_outbox (event_key, event_type, user_id, payload_json, occurred_at, status)
     SELECT 'visit-ev:' || s.id, 'activity', s.user_id,
            jsonb_strip_nulls(COALESCE((SELECT o.payload_json - 'eventType' - 'section' - 'isFirstLogin' FROM nebo_ops_outbox o
               WHERE o.user_id = s.user_id AND o.event_type IN ('login', 'activity') AND o.payload_json ? 'appVersion'
               ORDER BY o.occurred_at DESC LIMIT 1), '{}'::jsonb)
              || jsonb_build_object('eventType', 'app_open', 'section', s.section)),
            s.occurred_at AT TIME ZONE 'UTC', 'pending'
     FROM starts s
     WHERE NOT EXISTS (SELECT 1 FROM nebo_ops_outbox q WHERE q.user_id = s.user_id
       AND (q.event_type = 'login' OR (q.event_type = 'activity' AND q.payload_json->>'eventType' IN ('app_open', 'app_opened')))
       AND q.occurred_at >= (s.occurred_at AT TIME ZONE 'UTC') - INTERVAL '30 minutes')
     ON CONFLICT (event_key) DO NOTHING`,
  );
  return result.rowCount || 0;
}

export function wakeNeboOpsDelivery(): void {
  if (!isNeboOpsEnabled() || !getNeboOpsConfig()) return;
  if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') return;
  const state = worker();
  state.requested = true;
  // A hung await (database or network) must not freeze delivery forever.
  if (state.running && Date.now() - state.runningSince < 3 * 60_000) return;
  if (state.running) rememberWorkerError(state, new Error('DELIVERY_RUN_STUCK_RESTARTED'));
  state.running = true;
  state.runningSince = Date.now();
  void (async () => {
    try {
      do {
        state.requested = false;
        const result = await processNeboOpsOutbox();
        state.lastRunAt = Date.now();
        state.lastSent += result.sent;
        state.lastFailed += result.failed;
        if (result.claimed === MAX_BATCH) state.requested = true;
      } while (state.requested && getNeboOpsConfig());
      // Scheduled reports live here, not in the notification dispatcher, so a
      // slow push dispatch can never silence the owner's daily report.
      if (!isNeboOpsSecondary() && Date.now() - state.lastReportCheckAt >= 60_000) {
        state.lastReportCheckAt = Date.now();
        try {
          const { maybeSendScheduledNeboOpsReports } = await import('./neboOpsReports');
          await maybeSendScheduledNeboOpsReports(new Date(state.lastReportCheckAt));
        } catch (error) {
          rememberWorkerError(state, error);
          console.warn('[nebo-ops] scheduled report deferred');
        }
      }
      if (Date.now() - lastVisitScanAt >= 60_000) {
        lastVisitScanAt = Date.now();
        try {
          if (await queueDetectedNeboVisits()) state.requested = true;
        } catch (error) {
          rememberWorkerError(state, error);
        }
      }
      if (!isNeboOpsSecondary() && Date.now() - lastAlarmCheckAt >= 5 * 60_000) {
        lastAlarmCheckAt = Date.now();
        try {
          const { collectNeboAlarms } = await import('./neboOpsInsights');
          for (const alarm of await collectNeboAlarms()) await sendNeboOpsText(alarm);
        } catch (error) {
          rememberWorkerError(state, error);
        }
      }
      if (Date.now() - state.lastCleanupAt > 60 * 60 * 1000) {
        await getPool().query(
          `DELETE FROM nebo_ops_outbox WHERE id IN (
             SELECT id FROM nebo_ops_outbox WHERE status IN ('sent', 'dead')
               AND updated_at < NOW() - INTERVAL '120 days' ORDER BY id LIMIT 1000
           )`,
        );
        state.lastCleanupAt = Date.now();
      }
    } catch (error) {
      rememberWorkerError(state, error);
      console.warn('[nebo-ops] delivery deferred; durable queue will retry');
    } finally {
      state.running = false;
    }
  })();
}

export function ensureNeboOpsWorker(): void {
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test' || process.env.NEXT_RUNTIME === 'edge') return;
  const state = worker();
  const config = getNeboOpsConfig();
  if (!config) {
    if (isNeboOpsEnabled() && !state.configurationWarning) {
      state.configurationWarning = true;
      console.warn('[nebo-ops] enabled but the owner bot token/chat is not configured correctly');
    }
    return;
  }
  state.configurationWarning = false;
  // Retry Telegram webhook/command registration on later server calls if a
  // transient Telegram failure occurred during the initial process startup.
  if (!isNeboOpsSecondary()) {
    void ensureNeboOpsBotSetup(config.token);
    for (const channel of ['payments', 'support', 'errors'] as const) {
      const channelConfig = getNeboOwnerChannelConfig(channel);
      if (channelConfig) void ensureNeboOwnerChannelBotSetup(channel, channelConfig.token);
    }
  }
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
