import { getPool } from './db';
import type { TelegramReplyMarkup } from './telegramBot';
import { telegramApiRequest } from './telegramRelay';

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

export function renderNeboOpsMenu(prefs: NeboOpsPreferences): { text: string; replyMarkup: TelegramReplyMarkup } {
  // Inline web_app разворачивается клиентом Telegram как приложение, а не
  // открывается маленьким окном поверх переписки, как обычная t.me-ссылка.
  // initData остаётся в Web App и сервер допускает только OWNER_ID/роли.
  const appOrigin = String(process.env.NEBO_ADMIN_MINI_APP_URL || process.env.PUBLIC_APP_ORIGIN || '').replace(/\/$/, '');
  const adminButton = /^https:\/\//.test(appOrigin)
    ? [[{ text: '🛠 Открыть админку', web_app: { url: `${appOrigin}/?view=admin` } }]]
    : [];
  return {
    text: [
      '⚙️ NEBO · Уведомления владельца',
      '',
      'Нажми пункт, чтобы включить или выключить. Настройки сохраняются на сервере.',
      `Ежедневный отчёт: ${hour(prefs.daily_report_hour)}`,
      `Недельный отчёт: воскресенье, ${hour(prefs.weekly_report_hour)}`,
    ].join('\n'),
    replyMarkup: { inline_keyboard: [
      [{ text: `${on(prefs.notify_payments)} Оплаты`, callback_data: 'ops:toggle:notify_payments' }, { text: `${on(prefs.notify_support)} Обратная связь`, callback_data: 'ops:toggle:notify_support' }],
      [{ text: `${on(prefs.notify_logins)} Входы`, callback_data: 'ops:toggle:notify_logins' }, { text: `${on(prefs.notify_paywalls)} Paywall`, callback_data: 'ops:toggle:notify_paywalls' }],
      [{ text: `📅 День · ${hour(prefs.daily_report_hour)}`, callback_data: 'ops:schedule:daily' }],
      [{ text: `📈 Неделя · ${hour(prefs.weekly_report_hour)}`, callback_data: 'ops:schedule:weekly' }],
      [{ text: '📊 Отчёт за сегодня', callback_data: 'ops:report:today' }, { text: '📈 Отчёт за 7 дней', callback_data: 'ops:report:week' }],
      [{ text: '🔄 Обновить меню', callback_data: 'ops:menu' }],
      ...adminButton,
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
  const base = String(process.env.NEBO_OPS_PUBLIC_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '')).replace(/\/$/, '');
  if (secret.length < 32 || !base.startsWith('https://')) { setupStarted = false; return; }
  try {
    const responses = await Promise.all([
      telegramApiRequest(token, 'setWebhook', { url: `${base}/api/telegram/ops-webhook`, secret_token: secret, allowed_updates: ['message', 'callback_query'], drop_pending_updates: false }, { signal: AbortSignal.timeout(8_000) }),
      telegramApiRequest(token, 'setMyCommands', { commands: [{ command: 'menu', description: 'Настройки уведомлений' }, { command: 'report', description: 'Отчёт за сегодня' }, { command: 'week', description: 'Отчёт за 7 дней' }] }, { signal: AbortSignal.timeout(8_000) }),
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
  channel: 'payments' | 'support',
  token: string,
): Promise<void> {
  const secret = String(process.env.NEBO_OPS_WEBHOOK_SECRET || '').trim();
  const base = String(process.env.NEBO_OPS_PUBLIC_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '')).replace(/\/$/, '');
  if (secret.length < 32 || !base.startsWith('https://')) return;
  try {
    const responses = await Promise.all([
      telegramApiRequest(token, 'setWebhook', {
          url: `${base}/api/telegram/owner-channel-webhook?channel=${channel}`,
          secret_token: secret,
          allowed_updates: ['message'],
          drop_pending_updates: false,
        }, { signal: AbortSignal.timeout(8_000) }),
      telegramApiRequest(token, 'setMyCommands', { commands: [{ command: 'menu', description: 'О боте' }] }, { signal: AbortSignal.timeout(8_000) }),
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
