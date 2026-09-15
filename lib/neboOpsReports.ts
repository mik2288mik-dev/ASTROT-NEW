import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { getPool } from './db';
import { sendNeboOpsText } from './neboOps';
import { getNeboOpsPreferences } from './neboOpsSettings';

type ReportKind = 'today' | 'week';

function reportWindow(kind: ReportKind, now: Date) {
  const dateKey = formatInTimeZone(now, 'Europe/Moscow', 'yyyy-MM-dd');
  const todayStart = fromZonedTime(`${dateKey}T00:00:00`, 'Europe/Moscow');
  return {
    start: kind === 'today' ? todayStart : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    end: now,
    key: kind === 'today' ? dateKey : formatInTimeZone(now, 'Europe/Moscow', "RRRR-'W'II"),
  };
}

function pct(part: number, total: number): string {
  return total > 0 ? `${Math.round(part * 1000 / total) / 10}%` : '—';
}

function msk(value: Date): string {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', dateStyle: 'short', timeStyle: 'short' }).format(value);
}

export async function buildNeboOpsBusinessReport(kind: ReportKind, now = new Date()): Promise<string> {
  const { start, end } = reportWindow(kind, now);
  const pool = getPool();
  const [summary, stores, languages] = await Promise.all([
    pool.query(`WITH bounds AS (
      SELECT $1::timestamptz AS start_at, $2::timestamptz AS end_at,
             $1::timestamptz AT TIME ZONE 'UTC' AS start_utc,
             $2::timestamptz AT TIME ZONE 'UTC' AS end_utc
    ), events AS (
      SELECT e.* FROM user_app_events e CROSS JOIN bounds b
      WHERE e.occurred_at >= b.start_utc AND e.occurred_at < b.end_utc
    ), buyers AS (
      SELECT p.user_id FROM star_payments p CROSS JOIN bounds b
      WHERE p.created_at >= b.start_utc AND p.created_at < b.end_utc
        AND COALESCE(p.status, 'completed') <> 'refunded'
      UNION
      SELECT p.user_id FROM store_purchases p CROSS JOIN bounds b
      WHERE COALESCE(p.purchased_at, p.created_at) >= b.start_at
        AND COALESCE(p.purchased_at, p.created_at) < b.end_at
        AND p.status IN ('store_trial', 'paid', 'grace', 'cancelled_active')
    ), activation AS (
      SELECT u.id,
        EXISTS (SELECT 1 FROM user_app_events e WHERE e.user_id = u.id
          AND e.event_type IN ('first_result_ready', 'first_value_viewed')
          AND e.occurred_at >= u.created_at
          AND e.occurred_at < u.created_at + INTERVAL '24 hours') AS activated
      FROM users u CROSS JOIN bounds b
      WHERE u.created_at >= b.start_utc AND u.created_at < b.end_utc
        AND u.created_at <= (b.end_at - INTERVAL '24 hours') AT TIME ZONE 'UTC'
    ), retention AS (
      SELECT u.id,
        EXTRACT(DAY FROM b.end_at - (u.created_at AT TIME ZONE 'UTC')) AS age,
        EXISTS (SELECT 1 FROM user_app_events e WHERE e.user_id = u.id
          AND e.occurred_at >= u.created_at + INTERVAL '1 day'
          AND e.occurred_at < u.created_at + INTERVAL '2 days') AS d1,
        EXISTS (SELECT 1 FROM user_app_events e WHERE e.user_id = u.id
          AND e.occurred_at >= u.created_at + INTERVAL '7 days'
          AND e.occurred_at < u.created_at + INTERVAL '8 days') AS d7
      FROM users u CROSS JOIN bounds b
      WHERE u.created_at >= b.start_utc - INTERVAL '90 days' AND u.created_at < b.end_utc
    ) SELECT
      (SELECT COUNT(*) FROM users)::int AS total_users,
      (SELECT COUNT(*) FROM users u CROSS JOIN bounds b WHERE u.created_at >= b.start_utc AND u.created_at < b.end_utc)::int AS new_users,
      (SELECT COUNT(DISTINCT user_id) FROM events WHERE user_id IS NOT NULL)::int AS active_users,
      (SELECT COUNT(*) FROM events)::int AS actions,
      (SELECT COUNT(DISTINCT user_id) FROM events WHERE event_type IN ('paywall_view','paywall_viewed','paywall_impression'))::int AS paywall_users,
      (SELECT COUNT(*) FROM buyers)::int AS buyers,
      (SELECT COUNT(DISTINCT u.id) FROM users u LEFT JOIN premium_entitlements pe ON pe.user_id=u.id AND pe.status='active' AND pe.ends_at>NOW()
        WHERE GREATEST(u.premium_until, pe.ends_at)>NOW())::int AS premium_active,
      (SELECT COUNT(*) FROM premium_entitlements pe CROSS JOIN bounds b WHERE pe.entitlement_state='store_trial' AND pe.created_at>=b.start_utc AND pe.created_at<b.end_utc)::int AS trials,
      (SELECT COUNT(*) FROM support_tickets t CROSS JOIN bounds b WHERE t.created_at>=b.start_utc AND t.created_at<b.end_utc)::int AS support_tickets,
      (SELECT COUNT(*) FROM star_payments p CROSS JOIN bounds b WHERE p.created_at>=b.start_utc AND p.created_at<b.end_utc AND COALESCE(p.status,'completed')<>'refunded')::int AS star_purchases,
      (SELECT COALESCE(SUM(stars_amount),0) FROM star_payments p CROSS JOIN bounds b WHERE p.created_at>=b.start_utc AND p.created_at<b.end_utc AND COALESCE(p.status,'completed')<>'refunded')::int AS stars_gross,
      (SELECT COUNT(*) FROM store_purchases p CROSS JOIN bounds b WHERE COALESCE(p.purchased_at,p.created_at)>=b.start_at AND COALESCE(p.purchased_at,p.created_at)<b.end_at AND p.status IN ('store_trial','paid','grace','cancelled_active'))::int AS rustore_purchases,
      (SELECT COUNT(*) FROM activation)::int AS activation_mature,
      (SELECT COUNT(*) FROM activation WHERE activated)::int AS activated_24h,
      (SELECT COUNT(*) FROM retention WHERE age>=1)::int AS d1_mature,
      (SELECT COUNT(*) FROM retention WHERE age>=1 AND d1)::int AS d1_returned,
      (SELECT COUNT(*) FROM retention WHERE age>=7)::int AS d7_mature,
      (SELECT COUNT(*) FROM retention WHERE age>=7 AND d7)::int AS d7_returned
    `, [start.toISOString(), end.toISOString()]),
    pool.query(`WITH first_login AS (
      SELECT DISTINCT ON (user_id) user_id, payload_json FROM nebo_ops_outbox
      WHERE event_type='login' AND user_id IS NOT NULL ORDER BY user_id, occurred_at, id
    ) SELECT COALESCE(NULLIF(m.traffic_source,''), CASE COALESCE(fl.payload_json->>'distributionChannel', u.platform, u.auth_provider)
        WHEN 'rustore' THEN 'RuStore' WHEN 'google_play' THEN 'Google Play' WHEN 'telegram' THEN 'Telegram'
        WHEN 'native' THEN 'Приложение · прямой' WHEN 'web' THEN 'Веб · прямой' ELSE 'Не определён' END) AS label,
      COUNT(*)::int AS count
      FROM users u LEFT JOIN mytracker_users m ON m.user_id=u.id LEFT JOIN first_login fl ON fl.user_id=u.id
      WHERE u.created_at >= ($1::timestamptz AT TIME ZONE 'UTC') AND u.created_at < ($2::timestamptz AT TIME ZONE 'UTC')
      GROUP BY 1 ORDER BY count DESC, label LIMIT 6`, [start.toISOString(), end.toISOString()]),
    pool.query(`SELECT COALESCE(language,'не указан') AS label, COUNT(*)::int AS count FROM users
      WHERE created_at >= ($1::timestamptz AT TIME ZONE 'UTC') AND created_at < ($2::timestamptz AT TIME ZONE 'UTC')
      GROUP BY 1 ORDER BY count DESC, label LIMIT 6`, [start.toISOString(), end.toISOString()]),
  ]);
  const r = summary.rows[0] || {};
  const n = (key: string) => Number(r[key] || 0);
  const lines = [
    kind === 'today' ? '📊 NEBO · Отчёт за сегодня' : '📈 NEBO · Полный отчёт за 7 дней',
    `${msk(start)} — ${msk(end)} МСК`,
    '',
    '👥 Аудитория',
    `Новых: ${n('new_users')} · активных: ${n('active_users')} · всего: ${n('total_users')}`,
    `Действий в приложении: ${n('actions')}`,
    '',
    '🚀 Активация за первые 24 часа',
    `Зрелая когорта: ${n('activation_mature')} · получили первый результат: ${n('activated_24h')} · ${pct(n('activated_24h'), n('activation_mature'))}`,
    '',
    '🔁 Retention — точный день',
    `D1: ${n('d1_returned')} из ${n('d1_mature')} · ${pct(n('d1_returned'), n('d1_mature'))}`,
    `D7: ${n('d7_returned')} из ${n('d7_mature')} · ${pct(n('d7_returned'), n('d7_mature'))}`,
    '',
    '💎 Premium и paywall',
    `Активных Premium: ${n('premium_active')}`,
    `Paywall: ${n('paywall_users')} · покупателей: ${n('buyers')} · конверсия: ${pct(n('buyers'), n('paywall_users'))}`,
    `Бесплатных триалов: ${n('trials')}`,
    '',
    '💳 Покупки',
    `Telegram Stars: ${n('star_purchases')} · ${n('stars_gross')} Stars`,
    `RuStore: ${n('rustore_purchases')}`,
    '',
    '🏪 Каналы первых входов',
    ...(stores.rows.length ? stores.rows.map((row) => `• ${row.label}: ${row.count}`) : ['• Нет новых входов']),
    '',
    '🌐 Языки новых аккаунтов',
    ...(languages.rows.length ? languages.rows.map((row) => `• ${row.label}: ${row.count}`) : ['• Нет новых аккаунтов']),
    '',
    `✉️ Обращений в поддержку: ${n('support_tickets')}`,
    'Все сутки и расписание — Europe/Moscow.',
  ];
  return lines.join('\n').slice(0, 3_800);
}

export async function sendNeboOpsBusinessReport(kind: ReportKind, now = new Date()): Promise<boolean> {
  const message = await buildNeboOpsBusinessReport(kind, now);
  return (await sendNeboOpsText(message)).ok;
}

export async function maybeSendScheduledNeboOpsReports(now = new Date()): Promise<void> {
  const prefs = await getNeboOpsPreferences();
  const hour = Number(formatInTimeZone(now, 'Europe/Moscow', 'H'));
  const weekday = Number(formatInTimeZone(now, 'Europe/Moscow', 'i')) % 7;
  const pool = getPool();
  for (const kind of ['today', 'week'] as const) {
    const window = reportWindow(kind, now);
    const scheduled = kind === 'today'
      ? prefs.daily_report_hour === hour
      : prefs.weekly_report_hour === hour && prefs.weekly_report_weekday === weekday;
    const field = kind === 'today' ? 'last_daily_report_key' : 'last_weekly_report_key';
    if (!scheduled || prefs[field] === window.key) continue;
    const claim = await pool.query(`UPDATE nebo_ops_preferences SET ${field}=$1, updated_at=NOW()
      WHERE id=1 AND ${field} IS DISTINCT FROM $1 RETURNING id`, [window.key]);
    if (!claim.rowCount) continue;
    if (!(await sendNeboOpsBusinessReport(kind, now))) {
      await pool.query(`UPDATE nebo_ops_preferences SET ${field}=NULL WHERE id=1 AND ${field}=$1`, [window.key]);
    }
  }
}
