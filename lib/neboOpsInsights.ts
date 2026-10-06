import { getPool } from './db';
import { ACTIONS, neboServerLabel } from './neboOps';
import { CHANNEL_LABELS, planLabel, PROVIDER_LABELS, SCREEN_LABELS } from './neboOpsStats';

/** On-demand owner views: who came in, who pays, one person, and quiet/error alarms. */

const MSK = 'Europe/Moscow';

function msk(value: unknown, withDate = true): string {
  const date = value instanceof Date ? value : new Date(String(value || ''));
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: MSK, ...(withDate ? { day: '2-digit', month: '2-digit' } : {}), hour: '2-digit', minute: '2-digit',
  }).format(date);
}
function name(value: unknown): string {
  const clean = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  return clean || 'Без имени';
}
function device(payload: Record<string, unknown> | null | undefined): string {
  if (!payload) return '';
  const model = String(payload.deviceModel || '').slice(0, 30);
  const os = payload.osName ? `${payload.osName}${payload.osVersion ? ` ${payload.osVersion}` : ''}` : '';
  const version = payload.appVersion ? `NEBO ${payload.appVersion}` : '';
  const store = CHANNEL_LABELS[String(payload.distributionChannel || '')] || '';
  return [model, os, version, store].filter(Boolean).join(' · ');
}

export async function buildLatestVisitors(limit = 10): Promise<string> {
  const result = await getPool().query(
    `WITH traces AS (
       SELECT user_id, occurred_at AS seen FROM user_app_events
       WHERE user_id IS NOT NULL AND occurred_at > (NOW() AT TIME ZONE 'UTC') - INTERVAL '7 days'
       UNION ALL SELECT user_id, last_seen_at FROM user_sessions
       WHERE last_seen_at > (NOW() AT TIME ZONE 'UTC') - INTERVAL '7 days'
     ), last_seen AS (
       SELECT user_id, MAX(seen) AS seen FROM traces GROUP BY user_id ORDER BY seen DESC LIMIT $1
     )
     SELECT u.id, u.name, u.auth_provider, u.created_at, ls.seen AT TIME ZONE 'UTC' AS seen,
            (SELECT o.payload_json FROM nebo_ops_outbox o
              WHERE o.user_id = u.id AND (o.event_type = 'login' OR o.payload_json ? 'deviceModel')
              ORDER BY o.occurred_at DESC LIMIT 1) AS device,
            COALESCE(u.premium_until > NOW(), FALSE)
              OR EXISTS (SELECT 1 FROM premium_entitlements pe WHERE pe.user_id = u.id AND pe.status = 'active'
                         AND pe.ends_at > (NOW() AT TIME ZONE 'UTC')) AS premium
     FROM last_seen ls JOIN users u ON u.id = ls.user_id ORDER BY ls.seen DESC`,
    [Math.max(1, Math.min(20, limit))],
  );
  if (!result.rows.length) return '👥 За неделю никто не заходил.';
  const lines = [`👥 Последние ${result.rows.length} заходивших · 🖥 ${neboServerLabel()}`, ''];
  for (const row of result.rows) {
    const isNew = Date.now() - new Date(row.created_at).getTime() < 24 * 60 * 60 * 1000;
    lines.push(
      `${row.premium ? '💎' : isNew ? '🆕' : '•'} ${name(row.name)} · ID ${row.id} · ${msk(row.seen)}`,
      `   ${[...new Set([PROVIDER_LABELS[String(row.auth_provider || '')], ...device(row.device).split(' · ')].filter(Boolean))].join(' · ') || 'устройство неизвестно'}`,
    );
  }
  lines.push('', 'Подробно о человеке: /user ID');
  return lines.join('\n').slice(0, 3_800);
}

export async function buildPremiumList(): Promise<string> {
  const result = await getPool().query(
    `SELECT u.id, u.name,
            GREATEST(u.premium_until, MAX(pe.ends_at) AT TIME ZONE 'UTC') AS until,
            (SELECT sp.external_product_id FROM store_purchases sp WHERE sp.user_id = u.id
              ORDER BY COALESCE(sp.purchased_at, sp.created_at) DESC LIMIT 1) AS product,
            (SELECT COUNT(*) FROM store_purchases sp WHERE sp.user_id = u.id
              AND sp.status NOT IN ('store_trial', 'refunded'))::int AS paid
     FROM users u
     LEFT JOIN premium_entitlements pe ON pe.user_id = u.id AND pe.status = 'active'
       AND pe.ends_at > (NOW() AT TIME ZONE 'UTC')
     GROUP BY u.id
     HAVING GREATEST(u.premium_until, MAX(pe.ends_at) AT TIME ZONE 'UTC') > NOW()
     ORDER BY until ASC LIMIT 30`,
  );
  if (!result.rows.length) return '💎 Активных Premium сейчас нет.';
  const lines = [`💎 Premium сейчас: ${result.rows.length} · 🖥 ${neboServerLabel()}`, ''];
  for (const row of result.rows) {
    const days = Math.ceil((new Date(row.until).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    const how = Number(row.paid) > 0 ? `${planLabel(String(row.product || ''))}, оплат: ${row.paid}` : 'подарок/вручную';
    const date = new Intl.DateTimeFormat('ru-RU', { timeZone: MSK, dateStyle: 'short' }).format(new Date(row.until));
    lines.push(`• ${name(row.name)} · ID ${row.id}`, `   до ${date}${days <= 60 ? ` (${days} дн.)` : ''} · ${how}`);
  }
  return lines.join('\n').slice(0, 3_800);
}

export async function buildUserCard(rawId: string): Promise<string> {
  const id = String(rawId || '').trim();
  if (!/^-?\d{1,20}$/.test(id)) return 'Напиши так: /user 123456 (ID есть в каждом уведомлении).';
  const pool = getPool();
  const user = (await pool.query(
    `SELECT u.id, u.name, u.language, u.auth_provider, u.platform, u.created_at, u.premium_until,
            GREATEST((SELECT MAX(occurred_at) FROM user_app_events e WHERE e.user_id = u.id),
                     (SELECT MAX(last_seen_at) FROM user_sessions us WHERE us.user_id = u.id)) AT TIME ZONE 'UTC' AS last_seen,
            (SELECT COUNT(DISTINCT ((e.occurred_at AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Moscow')::date)
               FROM user_app_events e WHERE e.user_id = u.id)::int AS visit_days,
            (SELECT COUNT(*) FROM store_purchases sp WHERE sp.user_id = u.id AND sp.status NOT IN ('store_trial', 'refunded'))::int AS paid,
            (SELECT COUNT(*) FROM support_tickets t WHERE t.user_id = u.id)::int AS tickets,
            (SELECT MAX(pe.ends_at) AT TIME ZONE 'UTC' FROM premium_entitlements pe WHERE pe.user_id = u.id AND pe.status = 'active') AS ent_until,
            (SELECT o.payload_json FROM nebo_ops_outbox o WHERE o.user_id = u.id AND o.payload_json ? 'deviceModel'
              ORDER BY o.occurred_at DESC LIMIT 1) AS device
     FROM users u WHERE u.id = $1`, [id],
  )).rows[0];
  if (!user) return `🔎 Пользователь ${id} не найден.`;
  const screens = (await pool.query(
    `SELECT section, COUNT(*)::int AS n FROM user_app_events
     WHERE user_id = $1 AND event_type = 'screen_view' AND section IS NOT NULL
     GROUP BY section ORDER BY n DESC LIMIT 4`, [id],
  )).rows;
  const until = [user.premium_until, user.ent_until].map((v) => (v ? new Date(v).getTime() : 0)).reduce((a, b) => Math.max(a, b), 0);
  const lines = [
    `🔎 ${name(user.name)} · ID ${user.id}`,
    `🔐 ${PROVIDER_LABELS[String(user.auth_provider || '')] || 'вход не известен'} · язык ${user.language || '—'}`,
  ];
  const dev = device(user.device);
  if (dev) lines.push(`📱 ${dev}`);
  lines.push(
    `📅 С нами с ${msk(user.created_at).split(',')[0]} · заходил ${user.visit_days} дн. · последний раз ${msk(user.last_seen)}`,
    until > Date.now() ? `💎 Premium до ${msk(new Date(until)).split(',')[0]}` : '🔓 Бесплатный доступ',
    `💳 Оплат: ${user.paid} · ✉️ обращений: ${user.tickets}`,
  );
  if (screens.length) lines.push(`🧭 Чаще всего: ${screens.map((s) => `${SCREEN_LABELS[s.section] || s.section} ${s.n}`).join(' · ')}`);
  const recent = (await pool.query(
    `SELECT event_type, section, occurred_at AT TIME ZONE 'UTC' AS at FROM user_app_events
     WHERE user_id = $1 AND event_type <> 'activity_heartbeat' ORDER BY occurred_at DESC, id DESC LIMIT 15`, [id],
  )).rows;
  if (recent.length) {
    lines.push('', '🕒 Последние действия:');
    for (const row of recent.reverse()) lines.push(`${seconds(row.at)} · ${actionText(row.event_type, row.section)}`);
  }
  return lines.join('\n').slice(0, 3_800);
}

function seconds(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value || ''));
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: MSK, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(date);
}

function actionText(eventType: unknown, section: unknown): string {
  const screen = SCREEN_LABELS[String(section || '')];
  if (eventType === 'screen_view') return `открыл экран «${screen || String(section || 'неизвестно')}»`;
  const action = ACTIONS[String(eventType || '')] || String(eventType || 'действие');
  return screen ? `${action} · ${screen}` : action;
}

/** Every recorded action of every person, newest first, to the second. */
export async function buildActivityFeed(limit = 40): Promise<string> {
  const result = await getPool().query(
    `SELECT e.user_id, u.name, e.event_type, e.section, e.occurred_at AT TIME ZONE 'UTC' AS at
     FROM user_app_events e LEFT JOIN users u ON u.id = e.user_id
     WHERE e.occurred_at > (NOW() AT TIME ZONE 'UTC') - INTERVAL '48 hours'
       AND COALESCE(e.source, '') NOT IN ('rustore_callback', 'entitlement_expiry')
       AND e.event_type <> 'activity_heartbeat'
     ORDER BY e.occurred_at DESC, e.id DESC LIMIT $1`,
    [Math.max(5, Math.min(60, limit))],
  );
  if (!result.rows.length) return '🕒 За двое суток в приложении не было действий.';
  const lines = [`🕒 Лента действий · последние ${result.rows.length} · 🖥 ${neboServerLabel()}`, ''];
  let lastPerson = '';
  for (const row of result.rows) {
    const person = `${name(row.name)} · ID ${row.user_id ?? '—'}`;
    if (person !== lastPerson) lines.push(`🙋 ${person}`);
    lastPerson = person;
    lines.push(`   ${seconds(row.at)} · ${actionText(row.event_type, row.section)}`);
  }
  lines.push('', 'Вся история человека: /user ID');
  return lines.join('\n').slice(0, 3_800);
}

/**
 * Alarms the owner should not have to look for. Each alarm is claimed once per
 * window in the database, so restarts and parallel servers never repeat it.
 */
async function claimAlarm(key: string): Promise<boolean> {
  const claimed = await getPool().query(
    `INSERT INTO nebo_ops_outbox (event_key, event_type, payload_json, occurred_at, status, sent_at)
     VALUES ($1, 'diagnostic', '{}'::jsonb, NOW(), 'sent', NOW())
     ON CONFLICT (event_key) DO NOTHING RETURNING id`,
    [key],
  );
  return (claimed.rowCount || 0) > 0;
}

export async function collectNeboAlarms(now = new Date()): Promise<string[]> {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: MSK, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false })
    .formatToParts(now).reduce<Record<string, string>>((acc, part) => ({ ...acc, [part.type]: part.value }), {});
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  const hour = Number(parts.hour);
  const row = (await getPool().query(
    `SELECT
       (SELECT MAX(occurred_at) FROM user_app_events) AT TIME ZONE 'UTC' AS last_event,
       (SELECT COUNT(DISTINCT user_id) FROM user_app_events
          WHERE occurred_at > (NOW() AT TIME ZONE 'UTC') - INTERVAL '7 days')::int AS people_7d,
       (SELECT COUNT(*) FROM nebo_ops_outbox WHERE event_type IN ('ai_error', 'technical_error')
          AND occurred_at > NOW() - INTERVAL '15 minutes')::int AS errors_15m`,
  )).rows[0] || {};
  const alarms: string[] = [];
  const lastEvent = row.last_event ? new Date(row.last_event).getTime() : 0;
  const silentHours = lastEvent ? (now.getTime() - lastEvent) / 3_600_000 : Infinity;
  // With a handful of daily users a quiet afternoon is normal; only a long daytime
  // silence in an app that usually has dozens of people is worth a message, once a day.
  if (hour >= 12 && hour < 22 && silentHours >= 8 && Number(row.people_7d) >= 30 && await claimAlarm(`alarm:quiet:${day}`)) {
    alarms.push([
      '🚨 Долгая тишина в приложении',
      `Уже ${Math.floor(silentHours)} ч ни одного действия пользователей, хотя за неделю заходило ${row.people_7d} человек.`,
      'Проверь: открой приложение сам. Если оно работает, просто тихий день.',
      `🖥 ${neboServerLabel()}`,
    ].join('\n'));
  }
  if (Number(row.errors_15m) >= 5 && await claimAlarm(`alarm:errors:${day}:${hour}`)) {
    alarms.push([
      `🚨 Всплеск ошибок: ${row.errors_15m} за 15 минут`,
      'Что-то сломалось массово. Подробности, кнопка «Ошибки за сутки» в боте поддержки.',
      `🖥 ${neboServerLabel()}`,
    ].join('\n'));
  }
  return alarms;
}
