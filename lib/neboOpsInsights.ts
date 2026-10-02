import { getPool } from './db';
import { neboServerLabel } from './neboOps';
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
  return lines.join('\n');
}

const alarmState = globalThis as typeof globalThis & { __neboOpsAlarmsV1?: Record<string, number> };

/** Alarms the owner should not have to look for: a silent app and an error spike. */
export async function collectNeboAlarms(now = new Date()): Promise<string[]> {
  const sent = (alarmState.__neboOpsAlarmsV1 ??= {});
  const hour = Number(new Intl.DateTimeFormat('ru-RU', { timeZone: MSK, hour: '2-digit', hour12: false }).format(now));
  const row = (await getPool().query(
    `SELECT
       (SELECT COUNT(*) FROM user_app_events WHERE occurred_at > (NOW() AT TIME ZONE 'UTC') - INTERVAL '3 hours')::int AS events_3h,
       (SELECT COUNT(*) FROM user_app_events WHERE occurred_at > (NOW() AT TIME ZONE 'UTC') - INTERVAL '7 days')::int AS events_7d,
       (SELECT COUNT(*) FROM nebo_ops_outbox WHERE event_type IN ('ai_error', 'technical_error')
          AND occurred_at > NOW() - INTERVAL '15 minutes')::int AS errors_15m`,
  )).rows[0] || {};
  const alarms: string[] = [];
  const due = (key: string, everyMs: number) => now.getTime() - (sent[key] || 0) > everyMs;
  // Quiet hours are not suspicious; a usually busy app silent for three daytime hours is.
  if (hour >= 10 && hour < 23 && Number(row.events_3h) === 0 && Number(row.events_7d) >= 50 && due('quiet', 6 * 3_600_000)) {
    sent.quiet = now.getTime();
    alarms.push([
      '🚨 Тишина в приложении',
      'Уже 3 часа днём ни одного действия пользователей, хотя обычно люди заходят.',
      'Похоже, приложение или сервер недоступны. Проверь: открой приложение сам.',
      `🖥 ${neboServerLabel()}`,
    ].join('\n'));
  }
  if (Number(row.errors_15m) >= 5 && due('errors', 3_600_000)) {
    sent.errors = now.getTime();
    alarms.push([
      `🚨 Всплеск ошибок: ${row.errors_15m} за 15 минут`,
      'Что-то сломалось массово. Подробности — кнопка «Ошибки за сутки» в боте поддержки.',
      `🖥 ${neboServerLabel()}`,
    ].join('\n'));
  }
  return alarms;
}
