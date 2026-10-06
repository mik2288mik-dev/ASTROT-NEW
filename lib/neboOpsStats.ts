import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import type { PoolClient } from 'pg';
import { getPool } from './db';
import { getPremiumPlan } from './premiumPricing';

/**
 * Single source of owner-facing numbers. Every bot report, chart and summary
 * reads these definitions, so the same period always produces the same counts:
 * - «заходили» — distinct accounts with any visit trace in the period (see VISITORS);
 * - «новые» — accounts created in the period; «вернулись» = заходили − новые;
 * - «покупки» — RuStore purchases made in the period (trials and refunds excluded),
 *   valued at the list price of the purchased plan.
 * Legacy TIMESTAMP columns store UTC wall time, TIMESTAMPTZ columns absolute instants.
 */

type Queryable = Pick<PoolClient, 'query'>;
export type NeboReportKind = 'today' | 'yesterday' | 'week' | 'month';
export type NeboPeriod = { kind: NeboReportKind; start: Date; end: Date; label: string };
export type NeboCoreStats = {
  visitors: number;
  newUsers: number;
  purchases: number;
  revenueRub: number;
};
export type NeboCount = { label: string; count: number };
export type NeboStats = NeboCoreStats & {
  returning: number;
  totalUsers: number;
  premiumActive: number;
  paywallUsers: number;
  checkoutUsers: number;
  trials: number;
  starsPurchases: number;
  starsAmount: number;
  supportTickets: number;
  errors: number;
  newByProvider: NeboCount[];
  newByChannel: NeboCount[];
  topScreens: NeboCount[];
  purchasesByPlan: NeboCount[];
  nextDayReturn: { cohort: number; returned: number };
};
export type NeboDayPoint = NeboCoreStats & { day: string };

const TZ = 'Europe/Moscow';
const DAY_MS = 24 * 60 * 60 * 1000;
const PAID_EXCLUDED_STATUSES = ['store_trial', 'refunded'];

export const PROVIDER_LABELS: Record<string, string> = {
  telegram: 'Telegram', web_guest: 'Гость', guest: 'Гость', native: 'Гость',
  vk: 'VK ID', vk_id: 'VK ID', yandex: 'Яндекс ID', google: 'Google',
  email: 'Email', password: 'Email',
};
export const CHANNEL_LABELS: Record<string, string> = {
  rustore: 'RuStore', google_play: 'Google Play', telegram: 'Telegram', development: 'Тестовая сборка',
  native: 'Приложение', web: 'Сайт', site: 'Сайт',
};
export const SCREEN_LABELS: Record<string, string> = {
  dashboard: 'Сегодня', today: 'Сегодня', personal_forecast: 'Личный прогноз',
  horoscope: 'Гороскоп', zodiac: 'Гороскоп', chart: 'Натальная карта',
  natal_map: 'Натальная карта', natal_reading: 'Разбор карты', natal_questions: 'Спросить о себе',
  natal_matrix: 'Матрица судьбы', synastry: 'Совместимость', compatibility: 'Совместимость',
  settings: 'Настройки', menu: 'Меню', services: 'Меню', onboarding: 'Знакомство',
  premium: 'Premium', paywall: 'Premium', encyclopedia: 'Энциклопедия',
  charts: 'Сохранённые карты', personality: 'Разбор карты', natal_story: 'Разбор карты',
  natal: 'Натальная карта', matrix: 'Матрица судьбы', sounds: 'Звуки', tests: 'Тесты', stories: 'Истории',
  future: 'Будущее', knowledge: 'Энциклопедия',
};
const PLAN_LABELS: Record<string, string> = {
  premium_week: 'Неделя', premium_month: 'Месяц', premium_quarter: '3 месяца', premium_year: 'Год',
};

export function planPriceRub(productId: string): number {
  return getPremiumPlan(productId)?.priceRub ?? 0;
}
export function planLabel(productId: string): string {
  return PLAN_LABELS[productId] || productId;
}

function moscowDayStart(date: Date): Date {
  return fromZonedTime(`${formatInTimeZone(date, TZ, 'yyyy-MM-dd')}T00:00:00`, TZ);
}
function dm(date: Date): string {
  return formatInTimeZone(date, TZ, 'dd.MM');
}
function hm(date: Date): string {
  return formatInTimeZone(date, TZ, 'HH:mm');
}

export function neboReportPeriod(kind: NeboReportKind, now = new Date()): NeboPeriod {
  const today = moscowDayStart(now);
  if (kind === 'today') {
    return { kind, start: today, end: now, label: `Сегодня, ${dm(today)} · 00:00–${hm(now)} МСК` };
  }
  if (kind === 'yesterday') {
    const start = moscowDayStart(new Date(today.getTime() - DAY_MS / 2));
    return { kind, start, end: today, label: `Вчера, ${dm(start)} · весь день` };
  }
  const days = kind === 'week' ? 7 : 30;
  const start = moscowDayStart(new Date(today.getTime() - (days - 1) * DAY_MS + DAY_MS / 2));
  return { kind, start, end: now, label: `${days} дней · ${dm(start)}–${dm(now)}` };
}

/** The comparable span before the period: today vs yesterday at the same hour, otherwise the preceding span. */
export function previousPeriod(period: NeboPeriod): { start: Date; end: Date } {
  if (period.kind === 'today') {
    const start = moscowDayStart(new Date(period.start.getTime() - DAY_MS / 2));
    return { start, end: new Date(start.getTime() + (period.end.getTime() - period.start.getTime())) };
  }
  if (period.kind === 'yesterday') {
    const start = moscowDayStart(new Date(period.start.getTime() - DAY_MS / 2));
    return { start, end: period.start };
  }
  const length = period.end.getTime() - period.start.getTime();
  return { start: new Date(period.start.getTime() - length), end: period.start };
}

const BOUNDS = `bounds AS (
  SELECT $1::timestamptz AS s, $2::timestamptz AS e,
         $1::timestamptz AT TIME ZONE 'UTC' AS su, $2::timestamptz AT TIME ZONE 'UTC' AS eu
)`;
const EVENTS = `ev AS (
  SELECT e.user_id, e.event_type, e.section FROM user_app_events e CROSS JOIN bounds b
  WHERE e.occurred_at >= b.su AND e.occurred_at < b.eu
    AND COALESCE(e.source, '') NOT IN ('rustore_callback', 'entitlement_expiry')
)`;
// A visit leaves a trace in different places depending on the client: app events,
// a new auth session, the per-session «last seen» row, or an owner-bot visit/login fact.
const VISITORS = `visitors AS (
  SELECT user_id FROM ev WHERE user_id IS NOT NULL
  UNION SELECT s.user_id FROM app_sessions s CROSS JOIN bounds b
    WHERE (s.created_at >= b.su AND s.created_at < b.eu) OR (s.last_seen_at >= b.su AND s.last_seen_at < b.eu)
  UNION SELECT us.user_id FROM user_sessions us CROSS JOIN bounds b
    WHERE (us.last_seen_at >= b.su AND us.last_seen_at < b.eu) OR (us.started_at >= b.su AND us.started_at < b.eu)
  UNION SELECT o.user_id FROM nebo_ops_outbox o CROSS JOIN bounds b
    WHERE o.user_id IS NOT NULL AND o.event_type IN ('login', 'activity') AND o.occurred_at >= b.s AND o.occurred_at < b.e
)`;
const PURCHASES = `purchases AS (
  SELECT p.user_id, p.external_product_id FROM store_purchases p CROSS JOIN bounds b
  WHERE COALESCE(p.purchased_at, p.created_at) >= b.s AND COALESCE(p.purchased_at, p.created_at) < b.e
    AND p.status <> ALL($3::text[])
)`;

function revenue(rows: Array<{ product: string; count: number }>): number {
  return rows.reduce((sum, row) => sum + planPriceRub(row.product) * Number(row.count), 0);
}

export async function collectNeboCoreStats(db: Queryable, start: Date, end: Date): Promise<NeboCoreStats> {
  const result = await db.query(
    `WITH ${BOUNDS}, ${EVENTS}, ${VISITORS}, ${PURCHASES}
     SELECT (SELECT COUNT(*) FROM visitors)::int AS visitors,
            (SELECT COUNT(*) FROM users u CROSS JOIN bounds b WHERE u.created_at >= b.s AND u.created_at < b.e)::int AS new_users,
            (SELECT COALESCE(jsonb_agg(jsonb_build_object('product', product, 'count', count)), '[]'::jsonb)
               FROM (SELECT external_product_id AS product, COUNT(*)::int AS count FROM purchases GROUP BY 1) x) AS plans`,
    [start.toISOString(), end.toISOString(), PAID_EXCLUDED_STATUSES],
  );
  const row = result.rows[0] || {};
  const plans = Array.isArray(row.plans) ? row.plans : [];
  return {
    visitors: Number(row.visitors || 0),
    newUsers: Number(row.new_users || 0),
    purchases: plans.reduce((sum: number, plan: { count: number }) => sum + Number(plan.count), 0),
    revenueRub: revenue(plans),
  };
}

export async function collectNeboStats(start: Date, end: Date, db: Queryable = getPool()): Promise<NeboStats> {
  const params = [start.toISOString(), end.toISOString(), PAID_EXCLUDED_STATUSES];
  const [core, extra, lists] = await Promise.all([
    collectNeboCoreStats(db, start, end),
    db.query(
      `WITH ${BOUNDS}, ${EVENTS}
       SELECT (SELECT COUNT(*) FROM users)::int AS total_users,
              (SELECT COUNT(DISTINCT u.id) FROM users u
                 LEFT JOIN premium_entitlements pe ON pe.user_id = u.id AND pe.status = 'active'
                   AND pe.ends_at > (NOW() AT TIME ZONE 'UTC')
                WHERE u.premium_until > NOW() OR pe.user_id IS NOT NULL)::int AS premium_active,
              (SELECT COUNT(DISTINCT user_id) FROM ev WHERE event_type IN ('paywall_view', 'paywall_viewed', 'paywall_impression'))::int AS paywall_users,
              (SELECT COUNT(DISTINCT user_id) FROM ev WHERE event_type IN ('checkout_start', 'plan_selected'))::int AS checkout_users,
              (SELECT COUNT(*) FROM store_purchases p CROSS JOIN bounds b
                WHERE p.status = 'store_trial' AND COALESCE(p.purchased_at, p.created_at) >= b.s
                  AND COALESCE(p.purchased_at, p.created_at) < b.e)::int AS trials,
              (SELECT COUNT(*) FROM star_payments p CROSS JOIN bounds b
                WHERE p.created_at >= b.su AND p.created_at < b.eu AND COALESCE(p.status, 'completed') <> 'refunded')::int AS stars_purchases,
              (SELECT COALESCE(SUM(p.stars_amount), 0) FROM star_payments p CROSS JOIN bounds b
                WHERE p.created_at >= b.su AND p.created_at < b.eu AND COALESCE(p.status, 'completed') <> 'refunded')::int AS stars_amount,
              (SELECT COUNT(*) FROM support_tickets t CROSS JOIN bounds b WHERE t.created_at >= b.su AND t.created_at < b.eu)::int AS support_tickets,
              (SELECT COUNT(*) FROM nebo_ops_outbox o CROSS JOIN bounds b
                WHERE o.event_type IN ('ai_error', 'technical_error') AND o.occurred_at >= b.s AND o.occurred_at < b.e)::int AS errors,
              (SELECT COUNT(*) FROM users u CROSS JOIN bounds b
                WHERE u.created_at >= b.s AND u.created_at < b.e AND u.created_at <= NOW() - INTERVAL '2 days')::int AS cohort,
              (SELECT COUNT(*) FROM users u CROSS JOIN bounds b
                WHERE u.created_at >= b.s AND u.created_at < b.e AND u.created_at <= NOW() - INTERVAL '2 days'
                  AND EXISTS (SELECT 1 FROM user_app_events e WHERE e.user_id = u.id
                    AND e.occurred_at >= (u.created_at AT TIME ZONE 'UTC') + INTERVAL '1 day'
                    AND e.occurred_at < (u.created_at AT TIME ZONE 'UTC') + INTERVAL '2 days'))::int AS returned`,
      params.slice(0, 2),
    ),
    db.query(
      `WITH ${BOUNDS}, ${EVENTS}, ${PURCHASES},
       fresh AS (SELECT u.id, u.auth_provider, u.platform FROM users u CROSS JOIN bounds b
                 WHERE u.created_at >= b.s AND u.created_at < b.e),
       first_login AS (SELECT DISTINCT ON (o.user_id) o.user_id, o.payload_json->>'distributionChannel' AS channel
                       FROM nebo_ops_outbox o JOIN fresh f ON f.id = o.user_id
                       WHERE o.event_type = 'login' ORDER BY o.user_id, o.occurred_at, o.id)
       SELECT
         (SELECT COALESCE(jsonb_agg(jsonb_build_object('label', label, 'count', count) ORDER BY count DESC, label), '[]'::jsonb)
            FROM (SELECT COALESCE(auth_provider, 'unknown') AS label, COUNT(*)::int AS count FROM fresh GROUP BY 1) x) AS providers,
         (SELECT COALESCE(jsonb_agg(jsonb_build_object('label', label, 'count', count) ORDER BY count DESC, label), '[]'::jsonb)
            FROM (SELECT COALESCE(NULLIF(fl.channel, ''), f.platform, 'unknown') AS label, COUNT(*)::int AS count
                  FROM fresh f LEFT JOIN first_login fl ON fl.user_id = f.id GROUP BY 1) x) AS channels,
         (SELECT COALESCE(jsonb_agg(jsonb_build_object('label', label, 'count', count) ORDER BY count DESC, label), '[]'::jsonb)
            FROM (SELECT section AS label, COUNT(*)::int AS count FROM ev
                  WHERE event_type = 'screen_view' AND section IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 12) x) AS screens,
         (SELECT COALESCE(jsonb_agg(jsonb_build_object('label', label, 'count', count) ORDER BY count DESC, label), '[]'::jsonb)
            FROM (SELECT external_product_id AS label, COUNT(*)::int AS count FROM purchases GROUP BY 1) x) AS plans`,
      params,
    ),
  ]);
  const e = extra.rows[0] || {};
  const l = lists.rows[0] || {};
  const n = (value: unknown) => Number(value || 0);
  const list = (value: unknown): NeboCount[] => (Array.isArray(value) ? value : [])
    .map((item: { label?: unknown; count?: unknown }) => ({ label: String(item.label ?? ''), count: n(item.count) }));
  // Several technical sections share one human label; merge them after mapping.
  const screens = new Map<string, number>();
  for (const item of list(l.screens)) {
    const label = SCREEN_LABELS[item.label];
    if (label) screens.set(label, (screens.get(label) || 0) + item.count);
  }
  return {
    ...core,
    returning: Math.max(0, core.visitors - core.newUsers),
    totalUsers: n(e.total_users),
    premiumActive: n(e.premium_active),
    paywallUsers: n(e.paywall_users),
    checkoutUsers: n(e.checkout_users),
    trials: n(e.trials),
    starsPurchases: n(e.stars_purchases),
    starsAmount: n(e.stars_amount),
    supportTickets: n(e.support_tickets),
    errors: n(e.errors),
    newByProvider: mergeLabels(list(l.providers), PROVIDER_LABELS),
    newByChannel: mergeLabels(list(l.channels), CHANNEL_LABELS),
    topScreens: [...screens].map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count).slice(0, 5),
    purchasesByPlan: list(l.plans).map((item) => ({ label: planLabel(item.label), count: item.count })),
    nextDayReturn: { cohort: n(e.cohort), returned: n(e.returned) },
  };
}

function mergeLabels(items: NeboCount[], labels: Record<string, string>): NeboCount[] {
  const merged = new Map<string, number>();
  for (const item of items) {
    const label = labels[item.label] || 'Не определено';
    merged.set(label, (merged.get(label) || 0) + item.count);
  }
  return [...merged].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

/** Daily points ending with today (Moscow), oldest first. */
export async function collectNeboDailySeries(days: number, now = new Date(), db: Queryable = getPool()): Promise<NeboDayPoint[]> {
  const count = Math.max(2, Math.min(60, Math.trunc(days)));
  const today = moscowDayStart(now);
  const points: NeboDayPoint[] = [];
  for (let index = count - 1; index >= 0; index--) {
    const start = moscowDayStart(new Date(today.getTime() - index * DAY_MS + DAY_MS / 2));
    const end = index === 0 ? now : moscowDayStart(new Date(start.getTime() + DAY_MS + DAY_MS / 2));
    points.push({ day: dm(start), ...(await collectNeboCoreStats(db, start, end)) });
  }
  return points;
}

function rub(value: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(value)} ₽`;
}
function pct(part: number, total: number): string {
  return total > 0 ? `${Math.round((part * 100) / total)}%` : '—';
}
function delta(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? '' : ' (раньше 0)';
  const change = Math.round(((current - previous) * 100) / previous);
  return change === 0 ? ' (как раньше)' : ` (${change > 0 ? '+' : ''}${change}%)`;
}
function inline(items: NeboCount[]): string {
  return items.map((item) => `${item.label} ${item.count}`).join(' · ');
}

export function renderNeboReport(
  period: NeboPeriod,
  stats: NeboStats,
  previous: NeboCoreStats,
  server: string,
): string {
  const previousLabel = period.kind === 'today' ? 'вчера к этому времени'
    : period.kind === 'yesterday' ? 'позавчера' : 'прошлый такой же период';
  const lines = [
    `📊 NEBO · ${period.label}`,
    `🖥 ${server}`,
    '',
    `👥 Заходили: ${stats.visitors}${delta(stats.visitors, previous.visitors)}`,
    `   новых ${stats.newUsers} · вернулись ${stats.returning}`,
    `📈 Всего аккаунтов: ${stats.totalUsers}`,
  ];
  if (stats.newUsers > 0) {
    if (stats.newByChannel.length) lines.push(`📥 Откуда новые: ${inline(stats.newByChannel)}`);
    if (stats.newByProvider.length) lines.push(`🔐 Как вошли: ${inline(stats.newByProvider)}`);
  }
  lines.push(
    '',
    `💳 Оплата: открыли ${stats.paywallUsers} → начали ${stats.checkoutUsers} → купили ${stats.purchases}`,
    `💰 Выручка: ${rub(stats.revenueRub)}${delta(stats.revenueRub, previous.revenueRub)}`,
  );
  if (stats.purchasesByPlan.length) lines.push(`🧾 Тарифы: ${inline(stats.purchasesByPlan)}`);
  if (stats.trials > 0) lines.push(`🎁 Пробных периодов: ${stats.trials}`);
  if (stats.starsPurchases > 0) lines.push(`⭐ Telegram Stars: ${stats.starsPurchases} · ${stats.starsAmount} Stars`);
  lines.push(`💎 Premium сейчас у ${stats.premiumActive}`);
  if (period.kind === 'week' || period.kind === 'month') {
    const { cohort, returned } = stats.nextDayReturn;
    if (cohort > 0) lines.push('', `🔁 Вернулись на следующий день после регистрации: ${returned} из ${cohort} (${pct(returned, cohort)})`);
  }
  if (stats.topScreens.length) lines.push('', `🧭 Смотрели: ${inline(stats.topScreens)}`);
  lines.push(
    '',
    `⚠️ Ошибок: ${stats.errors} · ✉️ Обращений: ${stats.supportTickets}`,
    `Сравнение, с периодом «${previousLabel}». Время московское.`,
  );
  return lines.join('\n').slice(0, 3_800);
}
