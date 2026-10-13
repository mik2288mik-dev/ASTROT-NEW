import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import type { PoolClient } from 'pg';
import { getPool } from './db';
import { getPremiumPlan } from './premiumPricing';

/**
 * The only place where owner-facing numbers are defined. The admin and every
 * owner bot read these functions, so the same period always gives the same
 * numbers everywhere. Days are Moscow days.
 *
 * Definitions (also shown to the owner, see METRIC_GLOSSARY):
 * - first launch: a new account. The app creates one on its very first start
 *   (a guest), the website and the Telegram version on the first visit. An
 *   install in RuStore that is never opened is not visible here;
 * - registration: the first sign-in with VK ID, Яндекс, email, Google or Telegram;
 * - active («заходили»): any trace of a person in the app in the period;
 * - payment: a confirmed paid RuStore period (the first one or a renewal),
 *   valued at the plan's list price; test (sandbox) payments are excluded;
 * - activation: a first launch that got a natal chart or a first result within 24 hours.
 */

type Queryable = Pick<PoolClient, 'query'>;
export type Period = { start: Date; end: Date };
export type Count = { label: string; count: number };

const TZ = 'Europe/Moscow';
const DAY_MS = 24 * 60 * 60 * 1000;
export const PAYWALL_EVENTS = ['paywall_view', 'paywall_viewed', 'paywall_impression'];
export const CHECKOUT_EVENTS = ['checkout_start', 'plan_selected'];
const FIRST_VALUE_EVENTS = ['first_value_viewed', 'first_result_ready'];
const SYSTEM_EVENT_SOURCES = ['rustore_callback', 'entitlement_expiry'];

export const METRIC_GLOSSARY: Record<string, string> = {
  firstLaunches: 'Первые запуски: новые люди. Приложение создаёт аккаунт при самом первом открытии, сайт и Telegram при первом заходе. Скачал в RuStore, но не открыл: сюда не попадает, это видно только в консоли RuStore.',
  registrations: 'Регистрации: первый вход через VK ID, Яндекс, почту, Google или Telegram.',
  active: 'Заходили: люди, которые открывали приложение в этот период хотя бы раз.',
  dau: 'За день: сколько разных людей заходило сегодня.',
  wau: 'За неделю: сколько разных людей заходило за последние 7 дней.',
  mau: 'За месяц: сколько разных людей заходило за последние 30 дней.',
  payments: 'Оплаты: оплаченные периоды Premium в RuStore, и первые покупки, и продления. Тестовые оплаты не считаются.',
  revenue: 'Выручка: сумма оплат по цене тарифа, до комиссии RuStore и налогов.',
  activation: 'Активация за 24 часа: доля новых людей, которые за первые сутки получили натальную карту или первый результат.',
  retention: 'Удержание, день N: доля людей, которые снова зашли ровно на N-й день после первого запуска.',
  paywall: 'Экран оплаты: сколько людей открыли предложение Premium, сколько начали оплату и сколько оплатили.',
};

export const PROVIDER_LABELS: Record<string, string> = {
  telegram: 'Telegram', web_guest: 'Гость', guest: 'Гость', native: 'Гость',
  vk: 'VK ID', vk_id: 'VK ID', yandex: 'Яндекс ID', google: 'Google',
  email: 'Почта', password: 'Почта', admin_link: 'Ссылка из бота',
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
  natal: 'Натальная карта', matrix: 'Матрица судьбы', sounds: 'Звуки', tests: 'Тесты', stories: 'Рассказы',
  future: 'Будущее', knowledge: 'Энциклопедия', mood: 'Настроение', antistress: 'Антистресс',
  auth: 'Вход', legal: 'Согласие', startup: 'Запуск',
};
const PLAN_LABELS: Record<string, string> = {
  premium_week: 'Неделя', premium_month: 'Месяц', premium_quarter: '3 месяца', premium_year: 'Год',
};

export function planPriceRub(productId: string): number {
  return getPremiumPlan(productId)?.priceRub ?? 0;
}
export function planLabel(productId: string): string {
  return PLAN_LABELS[productId] || productId || 'тариф не известен';
}

export function moscowDayStart(date: Date): Date {
  return fromZonedTime(`${formatInTimeZone(date, TZ, 'yyyy-MM-dd')}T00:00:00`, TZ);
}
export function moscowDay(date: Date): string {
  return formatInTimeZone(date, TZ, 'yyyy-MM-dd');
}
/** Start of the Moscow day `days` days before the day of `date`. */
export function moscowDaysBack(date: Date, days: number): Date {
  return moscowDayStart(new Date(moscowDayStart(date).getTime() - days * DAY_MS + DAY_MS / 2));
}
export function moscowMonthStart(date: Date): Date {
  return fromZonedTime(`${formatInTimeZone(date, TZ, 'yyyy-MM')}-01T00:00:00`, TZ);
}

/**
 * Rows (user_id, at) for every trace of a person between $1 and $2 (timestamptz).
 * Legacy TIMESTAMP columns store UTC wall time, TIMESTAMPTZ columns absolute instants.
 */
export const ACTIVITY_SQL = `acts AS (
  SELECT e.user_id, e.occurred_at AT TIME ZONE 'UTC' AS at FROM user_app_events e
  WHERE e.user_id IS NOT NULL AND e.occurred_at >= $1::timestamptz AT TIME ZONE 'UTC' AND e.occurred_at < $2::timestamptz AT TIME ZONE 'UTC'
    AND COALESCE(e.source, '') <> ALL('{${SYSTEM_EVENT_SOURCES.join(',')}}'::text[])
  UNION ALL SELECT s.user_id, s.created_at AT TIME ZONE 'UTC' FROM app_sessions s
  WHERE s.created_at >= $1::timestamptz AT TIME ZONE 'UTC' AND s.created_at < $2::timestamptz AT TIME ZONE 'UTC'
  UNION ALL SELECT s.user_id, s.last_seen_at AT TIME ZONE 'UTC' FROM app_sessions s
  WHERE s.last_seen_at >= $1::timestamptz AT TIME ZONE 'UTC' AND s.last_seen_at < $2::timestamptz AT TIME ZONE 'UTC'
  UNION ALL SELECT us.user_id, us.started_at AT TIME ZONE 'UTC' FROM user_sessions us
  WHERE us.started_at >= $1::timestamptz AT TIME ZONE 'UTC' AND us.started_at < $2::timestamptz AT TIME ZONE 'UTC'
  UNION ALL SELECT us.user_id, us.last_seen_at AT TIME ZONE 'UTC' FROM user_sessions us
  WHERE us.last_seen_at >= $1::timestamptz AT TIME ZONE 'UTC' AND us.last_seen_at < $2::timestamptz AT TIME ZONE 'UTC'
  UNION ALL SELECT o.user_id, o.occurred_at FROM nebo_ops_outbox o
  WHERE o.user_id IS NOT NULL AND o.event_type IN ('login', 'activity')
    AND o.occurred_at >= $1::timestamptz AND o.occurred_at < $2::timestamptz
)`;

/** Paid RuStore periods between $1 and $2; a renewal is any paid period after the person's first one. */
const PAYMENTS_SQL = `pays AS (
  SELECT o.user_id, o.payload_json->>'productId' AS product, o.occurred_at,
         EXISTS (SELECT 1 FROM nebo_ops_outbox p WHERE p.user_id = o.user_id AND p.event_type = 'payment_confirmed'
                   AND p.occurred_at < o.occurred_at AND COALESCE(p.payload_json->>'sandbox', 'false') <> 'true') AS renewal
  FROM nebo_ops_outbox o
  WHERE o.event_type = 'payment_confirmed' AND COALESCE(o.payload_json->>'sandbox', 'false') <> 'true'
    AND o.occurred_at >= $1::timestamptz AND o.occurred_at < $2::timestamptz
)`;

export type Metrics = {
  firstLaunches: number;
  firstLaunchesApp: number;
  registrations: number;
  registrationsByProvider: Count[];
  active: number;
  returning: number;
  payments: number;
  firstPayments: number;
  renewals: number;
  revenueRub: number;
  paymentsByPlan: Count[];
  trials: number;
  cancellations: number;
  refunds: number;
  expired: number;
  stars: { payments: number; amount: number };
  paywallViewers: number;
  checkoutStarted: number;
  buyers: number;
  activation: { cohort: number; activated: number };
  supportTickets: number;
  errors: number;
  sources: Count[];
  totalUsers: number;
  premiumActive: number;
};

const n = (value: unknown) => Number(value || 0);
function counts(value: unknown, labels: Record<string, string> = {}, fallback = 'Не определено'): Count[] {
  const merged = new Map<string, number>();
  for (const item of Array.isArray(value) ? value : []) {
    const raw = String((item as { label?: unknown }).label ?? '');
    const label = labels[raw] || raw || fallback;
    merged.set(label, (merged.get(label) || 0) + n((item as { count?: unknown }).count));
  }
  return [...merged].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Where a new person came from: ad attribution first, then a campaign link, then the store or the website. */
const SOURCE_SQL = `COALESCE(
  NULLIF(CONCAT_WS(' · ', NULLIF(mt.traffic_source, ''), NULLIF(mt.campaign_title, '')), ''),
  CASE WHEN ak.source IS NOT NULL THEN CONCAT_WS(' · ', INITCAP(ak.source), ak.campaign_key) END,
  CASE (SELECT o.payload_json->>'distributionChannel' FROM nebo_ops_outbox o
          WHERE o.user_id = u.id AND o.payload_json ? 'distributionChannel' ORDER BY o.occurred_at LIMIT 1)
    WHEN 'rustore' THEN 'RuStore, сам нашёл' WHEN 'google_play' THEN 'Google Play' WHEN 'development' THEN 'Тестовая сборка' ELSE NULL END,
  CASE WHEN u.platform = 'native' THEN 'Приложение, источник не известен'
       WHEN u.platform = 'telegram' OR u.auth_provider = 'telegram' THEN 'Telegram'
       ELSE 'Сайт' END
)`;
export const PERSON_SOURCE_SQL = SOURCE_SQL;
export const PERSON_SOURCE_JOINS = `LEFT JOIN mytracker_users mt ON mt.user_id = u.id
  LEFT JOIN user_acquisition_keys ak ON ak.user_id = u.id`;

export async function collectMetrics(period: Period, db: Queryable = getPool()): Promise<Metrics> {
  const params = [period.start.toISOString(), period.end.toISOString()];
  const [people, money, lists] = await Promise.all([
    db.query(
      `WITH ${ACTIVITY_SQL},
       fresh AS (SELECT u.id, u.created_at, u.platform FROM users u
                 WHERE u.created_at >= $1::timestamptz AND u.created_at < $2::timestamptz),
       first_identity AS (SELECT user_id, MIN(created_at) AS at FROM account_identities GROUP BY user_id)
       SELECT
         (SELECT COUNT(*) FROM fresh)::int AS first_launches,
         (SELECT COUNT(*) FROM fresh WHERE platform = 'native')::int AS first_launches_app,
         (SELECT COUNT(DISTINCT user_id) FROM acts)::int AS active,
         (SELECT COUNT(DISTINCT a.user_id) FROM acts a WHERE NOT EXISTS (SELECT 1 FROM fresh f WHERE f.id = a.user_id))::int AS returning,
         (SELECT COUNT(*) FROM first_identity fi
            WHERE fi.at >= $1::timestamptz AT TIME ZONE 'UTC' AND fi.at < $2::timestamptz AT TIME ZONE 'UTC')::int AS registrations,
         (SELECT COUNT(DISTINCT e.user_id) FROM user_app_events e
            WHERE e.event_type = ANY($3::text[]) AND e.occurred_at >= $1::timestamptz AT TIME ZONE 'UTC'
              AND e.occurred_at < $2::timestamptz AT TIME ZONE 'UTC')::int AS paywall_viewers,
         (SELECT COUNT(DISTINCT e.user_id) FROM user_app_events e
            WHERE e.event_type = ANY($4::text[]) AND e.occurred_at >= $1::timestamptz AT TIME ZONE 'UTC'
              AND e.occurred_at < $2::timestamptz AT TIME ZONE 'UTC')::int AS checkout_started,
         (SELECT COUNT(*) FROM fresh f WHERE f.created_at <= NOW() - INTERVAL '24 hours')::int AS activation_cohort,
         (SELECT COUNT(*) FROM fresh f WHERE f.created_at <= NOW() - INTERVAL '24 hours' AND (
            EXISTS (SELECT 1 FROM natal_charts c WHERE c.user_id = f.id
              AND c.created_at < (f.created_at + INTERVAL '24 hours') AT TIME ZONE 'UTC')
            OR EXISTS (SELECT 1 FROM user_app_events e WHERE e.user_id = f.id AND e.event_type = ANY($5::text[])
              AND e.occurred_at < (f.created_at + INTERVAL '24 hours') AT TIME ZONE 'UTC')))::int AS activated,
         (SELECT COUNT(*) FROM support_tickets t
            WHERE t.created_at >= $1::timestamptz AT TIME ZONE 'UTC' AND t.created_at < $2::timestamptz AT TIME ZONE 'UTC')::int AS support_tickets,
         (SELECT COUNT(*) FROM nebo_ops_outbox o WHERE o.event_type IN ('ai_error', 'technical_error')
            AND o.occurred_at >= $1::timestamptz AND o.occurred_at < $2::timestamptz)::int AS errors,
         (SELECT COUNT(*) FROM users)::int AS total_users,
         (SELECT COUNT(DISTINCT u.id) FROM users u
            LEFT JOIN premium_entitlements pe ON pe.user_id = u.id AND pe.status = 'active'
              AND pe.ends_at > (NOW() AT TIME ZONE 'UTC')
           WHERE u.premium_until > NOW() OR pe.user_id IS NOT NULL)::int AS premium_active`,
      [...params, PAYWALL_EVENTS, CHECKOUT_EVENTS, FIRST_VALUE_EVENTS],
    ),
    db.query(
      `WITH ${PAYMENTS_SQL}
       SELECT
         (SELECT COALESCE(jsonb_agg(jsonb_build_object('product', product, 'renewal', renewal, 'count', count)), '[]'::jsonb)
            FROM (SELECT product, renewal, COUNT(*)::int AS count FROM pays GROUP BY 1, 2) x) AS paid,
         (SELECT COUNT(DISTINCT user_id) FROM pays)::int AS buyers,
         ${['trial_started', 'subscription_cancelled', 'payment_refunded', 'subscription_expired'].map((type) =>
           `(SELECT COUNT(*) FROM nebo_ops_outbox o WHERE o.event_type = '${type}'
              AND COALESCE(o.payload_json->>'sandbox', 'false') <> 'true'
              AND o.occurred_at >= $1::timestamptz AND o.occurred_at < $2::timestamptz)::int AS ${type}`).join(',\n         ')},
         (SELECT COUNT(*) FROM star_payments p WHERE COALESCE(p.status, 'completed') <> 'refunded'
            AND p.created_at >= $1::timestamptz AT TIME ZONE 'UTC' AND p.created_at < $2::timestamptz AT TIME ZONE 'UTC')::int AS stars_payments,
         (SELECT COALESCE(SUM(p.stars_amount), 0) FROM star_payments p WHERE COALESCE(p.status, 'completed') <> 'refunded'
            AND p.created_at >= $1::timestamptz AT TIME ZONE 'UTC' AND p.created_at < $2::timestamptz AT TIME ZONE 'UTC')::int AS stars_amount`,
      params,
    ),
    db.query(
      `WITH fresh AS (SELECT u.* FROM users u WHERE u.created_at >= $1::timestamptz AND u.created_at < $2::timestamptz),
       first_identity AS (SELECT DISTINCT ON (user_id) user_id, provider, created_at FROM account_identities ORDER BY user_id, created_at, id)
       SELECT
         (SELECT COALESCE(jsonb_agg(jsonb_build_object('label', label, 'count', count)), '[]'::jsonb) FROM (
            SELECT ${SOURCE_SQL} AS label, COUNT(*)::int AS count
            FROM fresh u ${PERSON_SOURCE_JOINS} GROUP BY 1) x) AS sources,
         (SELECT COALESCE(jsonb_agg(jsonb_build_object('label', provider, 'count', count)), '[]'::jsonb) FROM (
            SELECT provider, COUNT(*)::int AS count FROM first_identity
            WHERE created_at >= $1::timestamptz AT TIME ZONE 'UTC' AND created_at < $2::timestamptz AT TIME ZONE 'UTC'
            GROUP BY 1) x) AS providers`,
      params,
    ),
  ]);
  const p = people.rows[0] || {};
  const m = money.rows[0] || {};
  const l = lists.rows[0] || {};
  const paid = (Array.isArray(m.paid) ? m.paid : []) as Array<{ product: string; renewal: boolean; count: number }>;
  const byPlan = new Map<string, number>();
  for (const row of paid) byPlan.set(planLabel(row.product), (byPlan.get(planLabel(row.product)) || 0) + n(row.count));
  return {
    firstLaunches: n(p.first_launches),
    firstLaunchesApp: n(p.first_launches_app),
    registrations: n(p.registrations),
    registrationsByProvider: counts(l.providers, PROVIDER_LABELS),
    active: n(p.active),
    returning: n(p.returning),
    payments: paid.reduce((sum, row) => sum + n(row.count), 0),
    firstPayments: paid.filter((row) => !row.renewal).reduce((sum, row) => sum + n(row.count), 0),
    renewals: paid.filter((row) => row.renewal).reduce((sum, row) => sum + n(row.count), 0),
    revenueRub: paid.reduce((sum, row) => sum + planPriceRub(row.product) * n(row.count), 0),
    paymentsByPlan: [...byPlan].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
    trials: n(m.trial_started),
    cancellations: n(m.subscription_cancelled),
    refunds: n(m.payment_refunded),
    expired: n(m.subscription_expired),
    stars: { payments: n(m.stars_payments), amount: n(m.stars_amount) },
    paywallViewers: n(p.paywall_viewers),
    checkoutStarted: n(p.checkout_started),
    buyers: n(m.buyers),
    activation: { cohort: n(p.activation_cohort), activated: n(p.activated) },
    supportTickets: n(p.support_tickets),
    errors: n(p.errors),
    sources: counts(l.sources),
    totalUsers: n(p.total_users),
    premiumActive: n(p.premium_active),
  };
}

export type Audience = { dau: number; wau: number; mau: number };

/** Distinct people today, in the last 7 and in the last 30 Moscow days (including today). */
export async function collectAudience(now = new Date(), db: Queryable = getPool()): Promise<Audience> {
  const today = moscowDayStart(now);
  const result = await db.query(
    `WITH ${ACTIVITY_SQL}
     SELECT COUNT(DISTINCT user_id) FILTER (WHERE at >= $3::timestamptz)::int AS dau,
            COUNT(DISTINCT user_id) FILTER (WHERE at >= $4::timestamptz)::int AS wau,
            COUNT(DISTINCT user_id)::int AS mau
     FROM acts`,
    [moscowDaysBack(now, 29).toISOString(), now.toISOString(), today.toISOString(), moscowDaysBack(now, 6).toISOString()],
  );
  const row = result.rows[0] || {};
  return { dau: n(row.dau), wau: n(row.wau), mau: n(row.mau) };
}

export type RetentionPoint = { day: number; cohort: number; returned: number };

/**
 * Classic day-N retention over people who first launched in the last 60 days.
 * A person counts only once their day N has fully passed.
 */
export async function collectRetention(days: number[], now = new Date(), db: Queryable = getPool()): Promise<RetentionPoint[]> {
  const wanted = [...new Set(days.filter((d) => Number.isInteger(d) && d >= 1 && d <= 60))].sort((a, b) => a - b);
  if (!wanted.length) return [];
  const from = moscowDaysBack(now, 60 + Math.max(...wanted));
  const result = await db.query(
    `WITH ${ACTIVITY_SQL},
     cohort AS (SELECT u.id, (u.created_at AT TIME ZONE '${TZ}')::date AS d0 FROM users u
                WHERE u.created_at >= $1::timestamptz AND u.created_at < $2::timestamptz),
     act_days AS (SELECT DISTINCT user_id, (at AT TIME ZONE '${TZ}')::date AS d FROM acts)
     SELECT k AS day,
            COUNT(*) FILTER (WHERE c.d0 + k < $3::date)::int AS cohort,
            COUNT(*) FILTER (WHERE c.d0 + k < $3::date AND EXISTS (
              SELECT 1 FROM act_days a WHERE a.user_id = c.id AND a.d = c.d0 + k))::int AS returned
     FROM cohort c CROSS JOIN unnest($4::int[]) AS k
     GROUP BY k ORDER BY k`,
    [from.toISOString(), now.toISOString(), moscowDay(now), wanted],
  );
  const byDay = new Map(result.rows.map((row) => [Number(row.day), row]));
  return wanted.map((day) => ({ day, cohort: n(byDay.get(day)?.cohort), returned: n(byDay.get(day)?.returned) }));
}

export type DayPoint = {
  day: string;
  active: number;
  firstLaunches: number;
  registrations: number;
  payments: number;
  revenueRub: number;
};

/** One point per Moscow day, oldest first, ending with today. */
export async function collectDailySeries(days: number, now = new Date(), db: Queryable = getPool()): Promise<DayPoint[]> {
  const count = Math.max(2, Math.min(90, Math.trunc(days)));
  const from = moscowDaysBack(now, count - 1);
  const result = await db.query(
    `WITH ${ACTIVITY_SQL}, ${PAYMENTS_SQL},
     days AS (SELECT d::date AS day FROM generate_series($3::date, $4::date, INTERVAL '1 day') d),
     first_identity AS (SELECT user_id, MIN(created_at) AS at FROM account_identities GROUP BY user_id)
     SELECT to_char(days.day, 'YYYY-MM-DD') AS day,
            (SELECT COUNT(DISTINCT user_id) FROM acts WHERE (at AT TIME ZONE '${TZ}')::date = days.day)::int AS active,
            (SELECT COUNT(*) FROM users u WHERE u.created_at >= $1::timestamptz AND u.created_at < $2::timestamptz
               AND (u.created_at AT TIME ZONE '${TZ}')::date = days.day)::int AS first_launches,
            (SELECT COUNT(*) FROM first_identity fi WHERE ((fi.at AT TIME ZONE 'UTC') AT TIME ZONE '${TZ}')::date = days.day)::int AS registrations,
            (SELECT COALESCE(jsonb_agg(product), '[]'::jsonb) FROM pays WHERE (occurred_at AT TIME ZONE '${TZ}')::date = days.day) AS paid
     FROM days ORDER BY days.day`,
    [from.toISOString(), now.toISOString(), moscowDay(from), moscowDay(now)],
  );
  return result.rows.map((row) => {
    const paid = (Array.isArray(row.paid) ? row.paid : []) as string[];
    return {
      day: String(row.day),
      active: n(row.active),
      firstLaunches: n(row.first_launches),
      registrations: n(row.registrations),
      payments: paid.length,
      revenueRub: paid.reduce((sum, product) => sum + planPriceRub(String(product)), 0),
    };
  });
}

export type VersionStats = { latest: string | null; versions: Count[]; outdated: number; people: number };

export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.+-]/).map((part) => Number.parseInt(part, 10) || 0);
  const pb = b.split(/[.+-]/).map((part) => Number.parseInt(part, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}

/** App versions of people who used the installed app in the last 30 days (their latest version). */
export async function collectVersions(now = new Date(), db: Queryable = getPool()): Promise<VersionStats> {
  const result = await db.query(
    `SELECT version, COUNT(*)::int AS count FROM (
       SELECT DISTINCT ON (e.user_id) e.user_id, e.payload_json->>'app_version' AS version
       FROM user_app_events e
       WHERE e.payload_json->>'runtime' = 'native' AND e.payload_json ? 'app_version'
         AND e.occurred_at >= $1::timestamptz AT TIME ZONE 'UTC'
       ORDER BY e.user_id, e.occurred_at DESC
     ) latest GROUP BY version`,
    [moscowDaysBack(now, 29).toISOString()],
  );
  const versions = result.rows
    .map((row) => ({ label: String(row.version), count: n(row.count) }))
    .sort((a, b) => compareVersions(b.label, a.label));
  const latest = versions[0]?.label || null;
  const outdated = latest ? versions.filter((v) => compareVersions(v.label, latest) < 0).reduce((s, v) => s + v.count, 0) : 0;
  return { latest, versions, outdated, people: versions.reduce((s, v) => s + v.count, 0) };
}

export function percent(part: number, total: number): number | null {
  return total > 0 ? Math.round((part * 1000) / total) / 10 : null;
}
