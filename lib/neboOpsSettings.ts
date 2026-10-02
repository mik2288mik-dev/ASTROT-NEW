import { getPool } from './db';
import type { TelegramReplyMarkup } from './telegramBot';
import { telegramApiRequest } from './telegramRelay';
import { neboOpsWebhookBase } from './neboOpsWebhook';

export type NeboOpsPreferenceKey = 'notify_logins' | 'notify_payments' | 'notify_paywalls' | 'notify_support';
export type NeboOpsPreferences = {
  notify_logins: boolean;
  notify_payments: boolean;
  notify_paywalls: boolean;
  notify_support: boolean;
  daily_report_hour: number | null;
  weekly_report_weekday: number;
  weekly_report_hour: number | null;
  last_daily_report_key: string | null;
  last_weekly_report_key: string | null;
};

const defaults: NeboOpsPreferences = {
  notify_logins: true,
  notify_payments: true,
  notify_paywalls: true,
  notify_support: true,
  daily_report_hour: 23,
  weekly_report_weekday: 0,
  weekly_report_hour: 20,
  last_daily_report_key: null,
  last_weekly_report_key: null,
};

export async function getNeboOpsPreferences(): Promise<NeboOpsPreferences> {
  try {
    const row = (await getPool().query('SELECT * FROM nebo_ops_preferences WHERE id = 1')).rows[0];
    if (!row) return defaults;
    return {
      notify_logins: row.notify_logins !== false,
      notify_payments: row.notify_payments !== false,
      notify_paywalls: row.notify_paywalls !== false,
      notify_support: row.notify_support !== false,
      daily_report_hour: row.daily_report_hour === null ? null : Number(row.daily_report_hour),
      weekly_report_weekday: Number(row.weekly_report_weekday ?? 0),
      weekly_report_hour: row.weekly_report_hour === null ? null : Number(row.weekly_report_hour),
      last_daily_report_key: row.last_daily_report_key || null,
      last_weekly_report_key: row.last_weekly_report_key || null,
    };
  } catch {
    return defaults;
  }
}

export async function toggleNeboOpsPreference(key: NeboOpsPreferenceKey): Promise<NeboOpsPreferences> {
  await getPool().query(`UPDATE nebo_ops_preferences SET ${key} = NOT ${key}, updated_at = NOW() WHERE id = 1`);
  return getNeboOpsPreferences();
}

export async function cycleNeboOpsReportSchedule(kind: 'daily' | 'weekly'): Promise<NeboOpsPreferences> {
  if (kind === 'daily') {
    await getPool().query(`UPDATE nebo_ops_preferences
      SET daily_report_hour = CASE daily_report_hour WHEN 23 THEN NULL WHEN 21 THEN 23 ELSE 21 END,
          updated_at = NOW() WHERE id = 1`);
  } else {
    await getPool().query(`UPDATE nebo_ops_preferences
      SET weekly_report_hour = CASE weekly_report_hour WHEN 23 THEN NULL WHEN 20 THEN 23 ELSE 20 END,
          updated_at = NOW() WHERE id = 1`);
  }
  return getNeboOpsPreferences();
}

export function isNeboOpsEventEnabled(eventType: string, payload: Record<string, unknown>, prefs: NeboOpsPreferences): boolean {
  if (eventType === 'login') return prefs.notify_logins;
  if (eventType === 'payment_confirmed') return prefs.notify_payments;
  if (eventType === 'activity' && ['paywall_view', 'app_open', 'app_opened'].includes(String(payload.eventType))) {
    return payload.eventType === 'paywall_view' ? prefs.notify_paywalls : prefs.notify_logins;
  }
  return true;
}

const on = (value: boolean) => value ? '✅' : '◻️';
const hour = (value: number | null) => value === null ? 'выкл' : `${String(value).padStart(2, '0')}:00 МСК`;

export function renderNeboOpsMenu(prefs: NeboOpsPreferences, server = ''): { text: string; replyMarkup: TelegramReplyMarkup } {
  // Inline web_app разворачивается клиентом Telegram как приложение, а не
  // открывается маленьким окном поверх переписки, как обычная t.me-ссылка.
  // initData остаётся в Web App и сервер допускает только OWNER_ID/роли.
  const appOrigin = String(process.env.NEBO_ADMIN_MINI_APP_URL || process.env.PUBLIC_APP_ORIGIN || '').replace(/\/$/, '');
  const adminButton = /^https:\/\//.test(appOrigin)
    ? [[{ text: '🛠 Админка: всё подробно', web_app: { url: `${appOrigin}/?view=admin` } }]]
    : [];
  const off = [
    !prefs.notify_logins && 'входы', !prefs.notify_payments && 'оплаты',
    !prefs.notify_paywalls && 'экран оплаты', !prefs.notify_support && 'обращения',
  ].filter(Boolean);
  return {
    text: [
      `🌌 NEBO · Бот событий${server ? ` · 🖥 ${server}` : ''}`,
      '',
      'Что посмотреть — кнопками ниже. Команда /user ID — карточка любого человека.',
      off.length ? `⚠️ Сейчас выключены уведомления: ${off.join(', ')} (⚙️ Настройки)` : '✅ Все уведомления включены',
      `Отчёт каждый день: ${hour(prefs.daily_report_hour)} · за неделю: вс, ${hour(prefs.weekly_report_hour)}`,
    ].join('\n'),
    replyMarkup: { inline_keyboard: [
      [{ text: '📊 Сегодня', callback_data: 'ops:report:today' }, { text: '📅 Вчера', callback_data: 'ops:report:yesterday' }],
      [{ text: '📈 7 дней + график', callback_data: 'ops:report:week' }, { text: '🗓 30 дней + график', callback_data: 'ops:report:month' }],
      [{ text: '👥 Кто заходил', callback_data: 'ops:latest' }, { text: '💎 Подписчики', callback_data: 'ops:premium' }],
      [{ text: '🩺 Состояние сервера', callback_data: 'ops:health' }, { text: '⚙️ Настройки', callback_data: 'ops:settings' }],
      ...adminButton,
    ] },
  };
}

/** Switches live in their own screen so the main menu stays about the app, not the bot. */
export function renderNeboOpsSettingsMenu(prefs: NeboOpsPreferences): { text: string; replyMarkup: TelegramReplyMarkup } {
  return {
    text: [
      '⚙️ Настройки уведомлений',
      '',
      'Галочка — уведомление приходит. Нажми, чтобы включить или выключить.',
      'Время отчётов — нажимай, пока не выберешь нужное (21:00 → 23:00 → выкл).',
    ].join('\n'),
    replyMarkup: { inline_keyboard: [
      [{ text: `${on(prefs.notify_logins)} Входы`, callback_data: 'ops:toggle:notify_logins' }, { text: `${on(prefs.notify_paywalls)} Экран оплаты`, callback_data: 'ops:toggle:notify_paywalls' }],
      [{ text: `${on(prefs.notify_payments)} Оплаты`, callback_data: 'ops:toggle:notify_payments' }, { text: `${on(prefs.notify_support)} Обращения`, callback_data: 'ops:toggle:notify_support' }],
      [{ text: `⏰ Каждый день · ${hour(prefs.daily_report_hour)}`, callback_data: 'ops:schedule:daily' }],
      [{ text: `⏰ Неделя · ${hour(prefs.weekly_report_hour)}`, callback_data: 'ops:schedule:weekly' }],
      [{ text: '← Назад в меню', callback_data: 'ops:menu' }],
    ] },
  };
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
      telegramApiRequest(token, 'setMyCommands', { commands: [{ command: 'menu', description: 'Меню' }, { command: 'report', description: 'Отчёт за сегодня' }, { command: 'week', description: 'Отчёт за 7 дней с графиком' }, { command: 'month', description: 'Отчёт за 30 дней с графиком' }, { command: 'who', description: 'Кто заходил последним' }, { command: 'premium', description: 'Подписчики Premium' }, { command: 'user', description: 'Карточка человека: /user ID' }] }, { signal: AbortSignal.timeout(8_000) }),
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
