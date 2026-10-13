import { getPool } from './db';
import type { TelegramReplyMarkup } from './telegramBot';
import { telegramApiRequest } from './telegramRelay';
import { neboOpsWebhookBase } from './neboOpsWebhook';

/**
 * Owner settings of the events bot: what to send right away, what goes into the
 * reports, when reports come and quiet hours. Stored as one JSON row so a new
 * switch never needs a table change; the first read carries over the old settings.
 */

export const EVENT_TOGGLES = [
  'first_launch', 'registration', 'return_visit', 'payment', 'renewal', 'cancellation', 'refund',
  'paywall', 'onboarding_abandon', 'ai_error', 'tech_error', 'support', 'review', 'old_version',
] as const;
export type EventToggle = typeof EVENT_TOGGLES[number];
export const EVENT_LABELS: Record<EventToggle, string> = {
  first_launch: 'Первые запуски', registration: 'Регистрации', return_visit: 'Возвраты в приложение',
  payment: 'Покупки', renewal: 'Продления', cancellation: 'Отмены подписки', refund: 'Возвраты денег',
  paywall: 'Экран оплаты', onboarding_abandon: 'Бросил знакомство', ai_error: 'Ошибки ИИ',
  tech_error: 'Ошибки сервера', support: 'Обращения в поддержку', review: 'Оценки и отзывы', old_version: 'Старая версия APK',
};

export const REPORT_ITEMS = [
  'first_launches', 'registrations', 'payments', 'revenue', 'audience', 'retention',
  'activation', 'premium', 'sources', 'versions', 'chart',
] as const;
export type ReportItem = typeof REPORT_ITEMS[number];
export const REPORT_LABELS: Record<ReportItem, string> = {
  first_launches: 'Первые запуски', registrations: 'Регистрации', payments: 'Покупки',
  revenue: 'Выручка день / месяц', audience: 'DAU / WAU / MAU', retention: 'Удержание',
  activation: 'Активация 24 ч', premium: 'Premium и экран оплаты', sources: 'Источники',
  versions: 'Версии APK', chart: 'График',
};
export const RETENTION_OPTIONS = [1, 3, 7, 30] as const;
export const REPORT_HOUR_OPTIONS = [9, 12, 15, 18, 21, 23] as const;
export const QUIET_OPTIONS: Array<{ from: number; to: number } | null> = [null, { from: 23, to: 8 }, { from: 0, to: 9 }, { from: 22, to: 7 }];

export type NeboBotSettings = {
  events: Record<EventToggle, boolean>;
  report: Record<ReportItem, boolean>;
  retentionDays: number[];
  reportHours: number[];
  period: 'since_last' | 'day';
  weekly: boolean;
  paused: boolean;
  quiet: { from: number; to: number } | null;
  lastReportAt: string | null;
  sentReports: string[];
};

export function defaultNeboBotSettings(): NeboBotSettings {
  return {
    events: Object.fromEntries(EVENT_TOGGLES.map((key) => [key, true])) as Record<EventToggle, boolean>,
    report: Object.fromEntries(REPORT_ITEMS.map((key) => [key, true])) as Record<ReportItem, boolean>,
    retentionDays: [1, 7],
    reportHours: [23],
    period: 'day',
    weekly: true,
    paused: false,
    quiet: null,
    lastReportAt: null,
    sentReports: [],
  };
}

/** Keeps only known keys and allowed values, so a broken row can never break delivery. */
export function normalizeNeboBotSettings(raw: unknown): NeboBotSettings {
  const base = defaultNeboBotSettings();
  const source = raw && typeof raw === 'object' ? raw as Partial<NeboBotSettings> : {};
  for (const key of EVENT_TOGGLES) if (typeof source.events?.[key] === 'boolean') base.events[key] = source.events[key];
  for (const key of REPORT_ITEMS) if (typeof source.report?.[key] === 'boolean') base.report[key] = source.report[key];
  if (Array.isArray(source.retentionDays)) base.retentionDays = RETENTION_OPTIONS.filter((d) => source.retentionDays!.includes(d));
  if (Array.isArray(source.reportHours)) base.reportHours = REPORT_HOUR_OPTIONS.filter((h) => source.reportHours!.includes(h));
  if (source.period === 'since_last' || source.period === 'day') base.period = source.period;
  if (typeof source.weekly === 'boolean') base.weekly = source.weekly;
  if (typeof source.paused === 'boolean') base.paused = source.paused;
  const quiet = QUIET_OPTIONS.find((option) => option && source.quiet && option.from === source.quiet.from && option.to === source.quiet.to);
  base.quiet = quiet || null;
  if (typeof source.lastReportAt === 'string' && Number.isFinite(Date.parse(source.lastReportAt))) base.lastReportAt = source.lastReportAt;
  if (Array.isArray(source.sentReports)) base.sentReports = source.sentReports.filter((key) => typeof key === 'string').slice(-30);
  return base;
}

const SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS nebo_ops_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  settings JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;
export const NEBO_OPS_SETTINGS_SCHEMA_SQL = SCHEMA_SQL;
let schemaReady: Promise<void> | null = null;

/** Old switches (logins, payments, paywall, support, the daily hour) become the starting settings. */
async function initialSettings(): Promise<NeboBotSettings> {
  const settings = defaultNeboBotSettings();
  const old = (await getPool().query('SELECT * FROM nebo_ops_preferences WHERE id = 1').catch(() => ({ rows: [] as any[] }))).rows[0];
  if (old) {
    for (const key of ['first_launch', 'registration', 'return_visit'] as const) settings.events[key] = old.notify_logins !== false;
    for (const key of ['payment', 'renewal', 'cancellation', 'refund'] as const) settings.events[key] = old.notify_payments !== false;
    settings.events.paywall = old.notify_paywalls !== false;
    settings.events.support = old.notify_support !== false;
    settings.reportHours = old.daily_report_hour == null ? [] : REPORT_HOUR_OPTIONS.filter((h) => h === Number(old.daily_report_hour));
    if (!settings.reportHours.length && old.daily_report_hour != null) settings.reportHours = [23];
    settings.weekly = old.weekly_report_hour != null;
  }
  return settings;
}

async function ensureSettingsRow(): Promise<void> {
  schemaReady ??= (async () => {
    await getPool().query(SCHEMA_SQL);
    await getPool().query(
      'INSERT INTO nebo_ops_settings (id, settings) VALUES (1, $1::jsonb) ON CONFLICT (id) DO NOTHING',
      [JSON.stringify(await initialSettings())],
    );
  })().catch((error) => { schemaReady = null; throw error; });
  return schemaReady;
}

export async function getNeboBotSettings(): Promise<NeboBotSettings> {
  try {
    await ensureSettingsRow();
    const row = (await getPool().query('SELECT settings FROM nebo_ops_settings WHERE id = 1')).rows[0];
    return normalizeNeboBotSettings(row?.settings);
  } catch {
    return defaultNeboBotSettings();
  }
}

/** Read-modify-write under a row lock: two taps never lose each other's change. */
export async function updateNeboBotSettings(change: (settings: NeboBotSettings) => void | boolean): Promise<{ settings: NeboBotSettings; changed: boolean }> {
  await ensureSettingsRow();
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const row = (await client.query('SELECT settings FROM nebo_ops_settings WHERE id = 1 FOR UPDATE')).rows[0];
    const settings = normalizeNeboBotSettings(row?.settings);
    const changed = change(settings) !== false;
    if (changed) {
      await client.query('UPDATE nebo_ops_settings SET settings = $1::jsonb, updated_at = NOW() WHERE id = 1', [JSON.stringify(normalizeNeboBotSettings(settings))]);
    }
    await client.query('COMMIT');
    return { settings: normalizeNeboBotSettings(settings), changed };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Is it quiet now (Moscow time)? */
export function isQuietHour(settings: Pick<NeboBotSettings, 'quiet'>, now = new Date()): boolean {
  if (!settings.quiet) return false;
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Moscow', hour: '2-digit', hour12: false }).format(now)) % 24;
  const { from, to } = settings.quiet;
  return from > to ? hour >= from || hour < to : hour >= from && hour < to;
}

/** End of the current quiet window, for deferring important messages to the morning. */
export function quietEndsAt(settings: Pick<NeboBotSettings, 'quiet'>, now = new Date()): Date {
  if (!settings.quiet || !isQuietHour(settings, now)) return now;
  let probe = new Date(now.getTime());
  for (let i = 0; i < 24 && isQuietHour(settings, probe); i++) probe = new Date(probe.getTime() + 60 * 60_000);
  probe.setUTCMinutes(0, 0, 0);
  return probe;
}

const on = (value: boolean) => (value ? '✅' : '◻️');
const hh = (hour: number) => `${String(hour).padStart(2, '0')}:00`;
export const quietLabel = (quiet: NeboBotSettings['quiet']) => (quiet ? `${hh(quiet.from)}–${hh(quiet.to)}` : 'выкл');
const periodLabel = (period: NeboBotSettings['period']) => (period === 'since_last' ? 'с прошлого отчёта' : 'с начала дня');

type Menu = { text: string; replyMarkup: TelegramReplyMarkup };
type Button = { text: string; callback_data: string };
const pairs = (buttons: Button[]): Button[][] => buttons.reduce<Button[][]>((rows, button, index) => {
  if (index % 2 === 0) rows.push([button]); else rows[rows.length - 1].push(button);
  return rows;
}, []);
const back: Button[] = [{ text: '← Назад', callback_data: 'ops:menu' }];

export function renderNeboOpsMenu(settings: NeboBotSettings, server = ''): Menu {
  const off = EVENT_TOGGLES.filter((key) => !settings.events[key]).map((key) => `«${EVENT_LABELS[key]}»`);
  return {
    text: [
      `🌌 NEBO · бот событий${server ? ` · 🖥 ${server}` : ''}`,
      '',
      settings.paused ? '⏸ На паузе: уведомления и отчёты не приходят.' : '✅ Уведомления идут.',
      off.length ? `Не присылаю: ${off.join(', ')}.` : 'Присылаю все события.',
      `⏰ Отчёты: ${settings.reportHours.length ? settings.reportHours.map(hh).join(', ') : 'выключены'} МСК, ${periodLabel(settings.period)}${settings.weekly ? ', и итоги недели в вс 20:00' : ''}.`,
      `🌙 Тихие часы: ${quietLabel(settings.quiet)}.`,
      '',
      'Найти человека: нажми «🔎 Найти» или просто пришли ID или имя.',
    ].join('\n'),
    replyMarkup: { inline_keyboard: [
      [{ text: '📊 Отчёт сейчас', callback_data: 'ops:report:now' }, { text: '🔎 Найти человека', callback_data: 'ops:find' }],
      [{ text: '📈 7 дней + график', callback_data: 'ops:report:week' }, { text: '🗓 30 дней + график', callback_data: 'ops:report:month' }],
      [{ text: '👥 Кто заходил', callback_data: 'ops:latest' }, { text: '🕒 Лента действий', callback_data: 'ops:feed' }],
      [{ text: '💎 Подписчики', callback_data: 'ops:premium' }, { text: '🚪 Бросили знакомство', callback_data: 'ops:stuck' }],
      [{ text: '🔔 Что присылать сразу', callback_data: 'ops:events' }],
      [{ text: '🧾 Что в отчёте', callback_data: 'ops:items' }, { text: '⏰ Время отчётов', callback_data: 'ops:times' }],
      [{ text: settings.paused ? '▶️ Снять паузу' : '⏸ Пауза', callback_data: 'ops:pause' },
        { text: `🌙 Тихие часы: ${quietLabel(settings.quiet)}`, callback_data: 'ops:quiet' }],
      [{ text: '🔑 Войти в админку', callback_data: 'ops:admin' }, { text: '🩺 Сервер', callback_data: 'ops:health' }],
    ] },
  };
}

export function renderEventsMenu(settings: NeboBotSettings): Menu {
  return {
    text: '🔔 Что присылать сразу\n\nГалочка: событие приходит в момент, когда случилось. Нажми, чтобы включить или выключить.\nПокупки и продления приходят в бот оплат, обращения и ошибки в бот поддержки.',
    replyMarkup: { inline_keyboard: [
      ...pairs(EVENT_TOGGLES.map((key) => ({ text: `${on(settings.events[key])} ${EVENT_LABELS[key]}`, callback_data: `ops:ev:${key}` }))),
      back,
    ] },
  };
}

export function renderReportItemsMenu(settings: NeboBotSettings): Menu {
  return {
    text: `🧾 Что в отчёте\n\nГалочка: строка есть в отчёте. «Заходили», ошибки и обращения есть всегда.\nУдержание: доля людей, которые вернулись на выбранный день после первого запуска.`,
    replyMarkup: { inline_keyboard: [
      ...pairs(REPORT_ITEMS.map((key) => ({ text: `${on(settings.report[key])} ${REPORT_LABELS[key]}`, callback_data: `ops:it:${key}` }))),
      RETENTION_OPTIONS.map((day) => ({ text: `${on(settings.retentionDays.includes(day))} день ${day}`, callback_data: `ops:rd:${day}` })),
      back,
    ] },
  };
}

export function renderReportTimesMenu(settings: NeboBotSettings): Menu {
  return {
    text: `⏰ Время отчётов (МСК)\n\nОтметь, когда присылать отчёт. Можно несколько раз в день.\nПериод отчёта: ${periodLabel(settings.period)}.`,
    replyMarkup: { inline_keyboard: [
      REPORT_HOUR_OPTIONS.slice(0, 3).map((hour) => ({ text: `${on(settings.reportHours.includes(hour))} ${hh(hour)}`, callback_data: `ops:hr:${hour}` })),
      REPORT_HOUR_OPTIONS.slice(3).map((hour) => ({ text: `${on(settings.reportHours.includes(hour))} ${hh(hour)}`, callback_data: `ops:hr:${hour}` })),
      [{ text: `${on(settings.period === 'since_last')} С прошлого отчёта`, callback_data: 'ops:pd:since_last' },
        { text: `${on(settings.period === 'day')} С начала дня`, callback_data: 'ops:pd:day' }],
      [{ text: `${on(settings.weekly)} Итоги недели, вс 20:00`, callback_data: 'ops:weekly' }],
      [{ text: '📊 Отчёт сейчас', callback_data: 'ops:report:now' }],
      back,
    ] },
  };
}

/** Applies a settings button; returns which screen to show after it, or null for unknown data. */
export function applyNeboSettingsTap(settings: NeboBotSettings, data: string): 'menu' | 'events' | 'items' | 'times' | null {
  let match = /^ops:ev:([a-z_]+)$/.exec(data);
  if (match && (EVENT_TOGGLES as readonly string[]).includes(match[1])) {
    const key = match[1] as EventToggle;
    settings.events[key] = !settings.events[key];
    return 'events';
  }
  match = /^ops:it:([a-z_]+)$/.exec(data);
  if (match && (REPORT_ITEMS as readonly string[]).includes(match[1])) {
    const key = match[1] as ReportItem;
    settings.report[key] = !settings.report[key];
    return 'items';
  }
  match = /^ops:rd:(\d+)$/.exec(data);
  if (match && (RETENTION_OPTIONS as readonly number[]).includes(Number(match[1]))) {
    const day = Number(match[1]);
    settings.retentionDays = settings.retentionDays.includes(day)
      ? settings.retentionDays.filter((d) => d !== day)
      : [...settings.retentionDays, day].sort((a, b) => a - b);
    return 'items';
  }
  match = /^ops:hr:(\d+)$/.exec(data);
  if (match && (REPORT_HOUR_OPTIONS as readonly number[]).includes(Number(match[1]))) {
    const hour = Number(match[1]);
    settings.reportHours = settings.reportHours.includes(hour)
      ? settings.reportHours.filter((h) => h !== hour)
      : [...settings.reportHours, hour].sort((a, b) => a - b);
    return 'times';
  }
  if (data === 'ops:pd:since_last' || data === 'ops:pd:day') {
    settings.period = data.endsWith('day') ? 'day' : 'since_last';
    return 'times';
  }
  if (data === 'ops:weekly') { settings.weekly = !settings.weekly; return 'times'; }
  if (data === 'ops:pause') { settings.paused = !settings.paused; return 'menu'; }
  if (data === 'ops:quiet') {
    const index = QUIET_OPTIONS.findIndex((option) => quietLabel(option) === quietLabel(settings.quiet));
    settings.quiet = QUIET_OPTIONS[(index + 1) % QUIET_OPTIONS.length];
    return 'menu';
  }
  return null;
}

export function renderNeboSettingsScreen(screen: 'menu' | 'events' | 'items' | 'times', settings: NeboBotSettings, server: string): Menu {
  if (screen === 'events') return renderEventsMenu(settings);
  if (screen === 'items') return renderReportItemsMenu(settings);
  if (screen === 'times') return renderReportTimesMenu(settings);
  return renderNeboOpsMenu(settings, server);
}

let setupStarted = false;

function failedTelegramSetupOperations(responses: readonly Response[]): string[] {
  return responses
    .map((response, index) => (!response.ok
      ? `${index === 0 ? 'setWebhook' : 'setMyCommands'}_HTTP_${response.status}`
      : null))
    .filter((failure): failure is string => failure !== null);
}

function telegramSetupFailureReason(error: unknown): 'TIMEOUT' | 'NETWORK_ERROR' {
  return error instanceof Error && error.name === 'TimeoutError'
    ? 'TIMEOUT'
    : 'NETWORK_ERROR';
}

export async function ensureNeboOpsBotSetup(token: string): Promise<void> {
  if (setupStarted) return;
  setupStarted = true;
  const secret = String(process.env.NEBO_OPS_WEBHOOK_SECRET || '').trim();
  const base = neboOpsWebhookBase() || '';
  if (secret.length < 32 || !base.startsWith('https://')) { setupStarted = false; return; }
  try {
    const responses = await Promise.all([
      telegramApiRequest(token, 'setWebhook', { url: `${base}/api/telegram/ops-webhook`, secret_token: secret, allowed_updates: ['message', 'callback_query'], drop_pending_updates: false }, { signal: AbortSignal.timeout(8_000) }),
      telegramApiRequest(token, 'setMyCommands', { commands: [
        { command: 'menu', description: 'Меню и настройки' },
        { command: 'report', description: 'Отчёт сейчас' },
        { command: 'week', description: 'Отчёт за 7 дней с графиком' },
        { command: 'month', description: 'Отчёт за 30 дней с графиком' },
        { command: 'find', description: 'Найти человека по ID или имени' },
        { command: 'who', description: 'Кто заходил последним' },
        { command: 'feed', description: 'Лента действий до секунды' },
        { command: 'premium', description: 'Подписчики Premium' },
        { command: 'admin', description: 'Ссылка для входа в админку' },
      ] }, { signal: AbortSignal.timeout(8_000) }),
    ]);
    const failures = failedTelegramSetupOperations(responses);
    if (failures.length) {
      setupStarted = false;
      console.warn(`[nebo-ops] primary bot setup failed: ${failures.join(',')}`);
    }
  } catch (error) {
    setupStarted = false;
    console.warn(`[nebo-ops] primary bot setup failed: ${telegramSetupFailureReason(error)}`);
  }
}

/** Регистрирует /menu только у выделенного бота. Отдельные webhook URL не
 * позволяют сообщению из оплат оказаться в обработчике поддержки и наоборот. */
export async function ensureNeboOwnerChannelBotSetup(
  channel: 'payments' | 'support' | 'errors',
  token: string,
): Promise<void> {
  const secret = String(process.env.NEBO_OPS_WEBHOOK_SECRET || '').trim();
  const base = neboOpsWebhookBase() || '';
  if (secret.length < 32 || !base.startsWith('https://')) return;
  try {
    const responses = await Promise.all([
      telegramApiRequest(token, 'setWebhook', {
          url: `${base}/api/telegram/owner-channel-webhook?channel=${channel}`,
          secret_token: secret,
          allowed_updates: ['message', 'callback_query'],
          drop_pending_updates: false,
        }, { signal: AbortSignal.timeout(8_000) }),
      telegramApiRequest(token, 'setMyCommands', { commands: [{ command: 'menu', description: 'Меню и отчёты' }] }, { signal: AbortSignal.timeout(8_000) }),
    ]);
    const failures = failedTelegramSetupOperations(responses);
    if (failures.length) {
      // Keep the log operational: Telegram's response body can include details
      // we do not need to persist, while the endpoint and status identify the
      // broken configuration without ever exposing a bot token.
      console.warn(`[nebo-ops] ${channel} bot setup failed: ${failures.join(',')}`);
    }
  } catch (error) {
    console.warn(`[nebo-ops] ${channel} bot setup failed: ${telegramSetupFailureReason(error)}`);
  }
}
