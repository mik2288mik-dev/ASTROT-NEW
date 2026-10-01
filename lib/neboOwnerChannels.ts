import { getPool } from './db';
import type { TelegramReplyMarkup } from './telegramBot';
import {
  ERROR_REASONS,
  getNeboOwnerChannelConfig,
  neboServerLabel,
  OPERATION_TITLES,
  type NeboOwnerChannel,
} from './neboOps';
import { collectNeboCoreStats, collectNeboStats, neboReportPeriod, previousPeriod, type NeboReportKind } from './neboOpsStats';

/** Menus and on-demand reports of the dedicated payments, support and errors bots. */
export type NeboChannelReply = { text: string; replyMarkup?: TelegramReplyMarkup };

const CATEGORY_LABELS: Record<string, string> = {
  problem: 'Ошибка', idea: 'Пожелание', payment: 'Оплата', question: 'Вопрос', other: 'Другое',
};

function msk(value: Date | string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date)
    : '—';
}
function rub(value: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(value)} ₽`;
}
function category(tags: unknown): string {
  try {
    const parsed = typeof tags === 'string' ? JSON.parse(tags) : null;
    return CATEGORY_LABELS[String(parsed?.category)] || 'Другое';
  } catch {
    return 'Другое';
  }
}

export function neboChannelMenu(channel: NeboOwnerChannel): NeboChannelReply {
  const server = neboServerLabel();
  if (channel === 'payments') {
    return {
      text: [`💳 NEBO · Оплаты · 🖥 ${server}`, '', 'Сюда сразу приходит каждая оплата, пробный период, продление, отмена и возврат.', 'Выручка за период — кнопками ниже.'].join('\n'),
      replyMarkup: { inline_keyboard: [
        [{ text: '💰 Сегодня', callback_data: 'ch:pay:today' }, { text: '💰 Вчера', callback_data: 'ch:pay:yesterday' }],
        [{ text: '💰 7 дней', callback_data: 'ch:pay:week' }, { text: '💰 30 дней', callback_data: 'ch:pay:month' }],
      ] },
    };
  }
  if (channel === 'support') {
    // Until a dedicated errors bot exists, errors arrive here and so do their buttons.
    const hostsErrors = !getNeboOwnerChannelConfig('errors');
    return {
      text: [
        `✉️ NEBO · Обращения · 🖥 ${server}`,
        '',
        'Сюда приходит каждое обращение из приложения — с полным текстом.',
        ...(hostsErrors ? ['Пока нет отдельного бота ошибок, ошибки приходят тоже сюда.'] : []),
      ].join('\n'),
      replyMarkup: { inline_keyboard: [
        [{ text: '📬 Открытые обращения', callback_data: 'ch:sup:open' }, { text: '🗂 Последние 10', callback_data: 'ch:sup:latest' }],
        ...(hostsErrors ? [
          [{ text: '📋 Ошибки за сутки', callback_data: 'ch:err:day' }, { text: '📋 За 7 дней', callback_data: 'ch:err:week' }],
          [{ text: '🩺 Состояние сервера', callback_data: 'ch:err:health' }],
        ] : []),
      ] },
    };
  }
  return {
    text: [`⚠️ NEBO · Ошибки · 🖥 ${server}`, '', 'Сюда приходят ошибки сервера и генерации ИИ. Одинаковые склеиваются — не чаще раза в 5 минут.'].join('\n'),
    replyMarkup: { inline_keyboard: [
      [{ text: '📋 Ошибки за сутки', callback_data: 'ch:err:day' }, { text: '📋 За 7 дней', callback_data: 'ch:err:week' }],
      [{ text: '🩺 Состояние сервера', callback_data: 'ch:err:health' }],
    ] },
  };
}

export async function buildPaymentsReport(kind: NeboReportKind, now = new Date()): Promise<string> {
  const period = neboReportPeriod(kind, now);
  const before = previousPeriod(period);
  const [stats, previous] = await Promise.all([
    collectNeboStats(period.start, period.end),
    collectNeboCoreStats(getPool(), before.start, before.end),
  ]);
  const lines = [
    `💳 NEBO · Оплаты · ${period.label}`,
    `🖥 ${neboServerLabel()}`,
    '',
    `💰 Выручка: ${rub(stats.revenueRub)} (раньше ${rub(previous.revenueRub)})`,
    `🧾 Покупок: ${stats.purchases}${stats.purchasesByPlan.length ? ` — ${stats.purchasesByPlan.map((p) => `${p.label} ${p.count}`).join(' · ')}` : ''}`,
    `🛒 Путь к оплате: открыли экран ${stats.paywallUsers} → начали ${stats.checkoutUsers} → купили ${stats.purchases}`,
    `💎 Premium сейчас у ${stats.premiumActive}`,
  ];
  if (stats.trials > 0) lines.push(`🎁 Пробных периодов: ${stats.trials}`);
  if (stats.starsPurchases > 0) lines.push(`⭐ Telegram Stars: ${stats.starsPurchases} · ${stats.starsAmount} Stars`);
  lines.push('', 'Выручка — по цене тарифа, до комиссии RuStore.');
  return lines.join('\n');
}

export async function buildSupportList(onlyOpen: boolean): Promise<string> {
  const result = await getPool().query(
    `SELECT t.id, t.status, t.tags, t.user_id, t.created_at AT TIME ZONE 'UTC' AS created_at,
            (SELECT m.body FROM support_messages m WHERE m.ticket_id = t.id AND m.author_type = 'user'
               AND m.internal = FALSE ORDER BY m.created_at, m.id LIMIT 1) AS body
     FROM support_tickets t
     ${onlyOpen ? "WHERE t.status NOT IN ('closed', 'resolved')" : ''}
     ORDER BY t.created_at DESC, t.id DESC LIMIT 10`,
  );
  if (!result.rows.length) return onlyOpen ? '📬 Открытых обращений нет.' : '🗂 Обращений пока нет.';
  const lines = [onlyOpen ? '📬 Открытые обращения' : '🗂 Последние обращения', ''];
  for (const row of result.rows) {
    const body = String(row.body || '').replace(/\s+/g, ' ').trim();
    lines.push(
      `#${row.id} · ${category(row.tags)} · ${msk(row.created_at)}${row.user_id ? ` · ID ${row.user_id}` : ''}`,
      `«${body.length > 160 ? `${body.slice(0, 160)}…` : body}»`,
      '',
    );
  }
  return lines.join('\n').slice(0, 3_800);
}

export async function buildErrorsSummary(days: 1 | 7): Promise<string> {
  const result = await getPool().query(
    `SELECT event_type,
            COALESCE(NULLIF(CONCAT_WS(' · ', payload_json->>'scope', payload_json->>'diagnosticEvent'), ''),
                     payload_json->>'operation', 'без раздела') AS place,
            COALESCE(payload_json->>'errorCode', '—') AS error_code,
            COUNT(*)::int AS count, MAX(occurred_at) AS last_at
     FROM nebo_ops_outbox
     WHERE event_type IN ('ai_error', 'technical_error') AND occurred_at >= NOW() - $1 * INTERVAL '1 day'
     GROUP BY 1, 2, 3 ORDER BY count DESC, last_at DESC LIMIT 15`,
    [days],
  );
  const title = `📋 Ошибки за ${days === 1 ? 'сутки' : '7 дней'} · 🖥 ${neboServerLabel()}`;
  if (!result.rows.length) return `${title}\n\n✅ Ошибок не было.`;
  const total = result.rows.reduce((sum, row) => sum + Number(row.count), 0);
  const lines = [title, `Всего: ${total}`, ''];
  for (const row of result.rows) {
    const where = OPERATION_TITLES[String(row.place)] || String(row.place);
    const reason = ERROR_REASONS[String(row.error_code)] || String(row.error_code);
    lines.push(
      `${row.event_type === 'ai_error' ? '🤖' : '🚨'} ${row.count} раз · ${where}`,
      `   ${reason}`,
      `   последний раз: ${msk(row.last_at)}`,
    );
  }
  return lines.join('\n').slice(0, 3_800);
}

export async function buildHealthSummary(): Promise<string> {
  const pool = getPool();
  const started = Date.now();
  const lines = [`🩺 Состояние · 🖥 ${neboServerLabel()}`, ''];
  try {
    const queue = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE status IN ('pending', 'failed'))::int AS waiting,
              MAX(sent_at) AS last_sent
       FROM nebo_ops_outbox`,
    );
    lines.push(`✅ База отвечает · ${Date.now() - started} мс`);
    const row = queue.rows[0] || {};
    lines.push(`📨 В очереди уведомлений: ${Number(row.waiting || 0)}`);
    if (row.last_sent) lines.push(`📤 Последнее уведомление: ${msk(row.last_sent)}`);
  } catch {
    lines.push('❌ База не отвечает');
  }
  const version = String(process.env.RAILWAY_GIT_COMMIT_SHA || process.env.NEBO_DEPLOY_MARKER || '').trim();
  if (/^[0-9a-f]{7,40}$/i.test(version)) lines.push(`🧱 Сборка: ${version.slice(0, 7)}`);
  lines.push(`⏱ Сервер работает: ${Math.round(process.uptime() / 3600)} ч`);
  return lines.join('\n');
}
