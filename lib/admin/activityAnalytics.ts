import { AdminAuthError } from '../adminAuth';
import { getPool } from '../db';
import { activityId, activityScreen } from '../productActivity';
import { canonicalizeEvent, eventLabel } from './eventTaxonomy';
import type { AdminActivityRange, AdminActivityReport, AdminUserActivityReport } from './activityTypes';

/** Only user-initiated client activity. Push deliveries, generation and renewal callbacks are excluded. */
export const INTERACTIVE_EVENT_TYPES = [
  'app_opened', 'screen_view', 'activity_heartbeat', 'signup_started', 'signup_completed',
  'onboarding_started', 'onboarding_completed', 'birth_data_started', 'birth_data_completed',
  'natal_chart_opened', 'horoscope_opened', 'forecast_period_selected', 'first_value_viewed',
  'compatibility_started', 'compatibility_completed', 'natal_section_open', 'person_added',
  'future_open', 'question_sent', 'share', 'invite_open', 'paywall_view', 'paywall_viewed',
  'paywall_impression', 'checkout_start', 'checkout_started', 'plan_selected',
  'locked_feature_tapped', 'premium_promo_clicked', 'premium_promo_dismissed', 'restore_started',
  'push_opened', 'account_delete_requested', 'natal_story_open', 'natal_story_completed',
  'natal_card_swipe_next', 'natal_readmore_tap', 'natal_sheet_open', 'natal_today_cta_tap',
  'natal_checkin_cta_tap', 'natal_save_tap', 'natal_share_tap', 'natal_paywall_open', 'natal_paywall_dismiss',
];
const SCREENS: Record<string, string> = {
  dashboard: 'Сегодня', horoscope: 'Зодиак', chart: 'Натальная карта', synastry: 'Сравнить',
  menu: 'Меню', settings: 'Настройки', charts: 'Сохранённые карты', people: 'Люди', future: 'Будущее',
  matrix: 'Матрица судьбы', questions: 'Вопросы', premium: 'Premium', paywall: 'Premium',
  onboarding: 'Знакомство', encyclopedia: 'Энциклопедия', support: 'Поддержка', saved: 'Сохранённое',
  natal: 'Натальная карта', compatibility: 'Совместимость', personal_forecast: 'Личный прогноз',
};
const n = (value: unknown) => Number(value || 0);
const nullable = (value: unknown) => value == null ? null : n(value);
const iso = (value: unknown) => new Date(value as string).toISOString();
const date = (value: unknown): string | null => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
};
export function parseActivityRange(query: Record<string, unknown>, now = new Date()): AdminActivityRange {
  const timezone = typeof query.timezone === 'string' ? query.timezone : 'Europe/Moscow';
  let today: string;
  try { today = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
  catch { throw new AdminAuthError(400, 'INVALID_TIMEZONE', 'Неизвестный часовой пояс'); }
  const period = query.period || 'week';
  if (!['day', 'week', 'month', 'custom'].includes(String(period))) throw new AdminAuthError(400, 'INVALID_PERIOD', 'Неизвестный период');
  const to = query.to == null ? today : date(query.to);
  const defaultFrom = new Date(`${to || today}T00:00:00Z`);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - (period === 'month' ? 29 : period === 'day' ? 0 : 6));
  const from = query.from == null ? defaultFrom.toISOString().slice(0, 10) : date(query.from);
  if (!from || !to || from > to || to > today || (Date.parse(to) - Date.parse(from)) / 86_400_000 > 92) {
    throw new AdminAuthError(400, 'INVALID_DATE_RANGE', 'Выбери диапазон до 93 дней, не позднее сегодня');
  }
  const bucket = query.bucket || (from === to ? 'hour' : 'day');
  if (!['hour', 'day'].includes(String(bucket)) || (bucket === 'hour' && Date.parse(to) - Date.parse(from) > 6 * 86_400_000)) {
    throw new AdminAuthError(400, 'INVALID_BUCKET', 'Почасовой график доступен за 7 дней');
  }
  return { from, to, timezone, period: query.from || query.to ? 'custom' : period as AdminActivityRange['period'], bucket: bucket as 'hour' | 'day' };
}

// Existing timestamps are stored as UTC without time zone. Explicit conversion avoids server TZ drift.
const BOUNDS = `bounds AS (SELECT
  ($1::date::timestamp AT TIME ZONE $3 AT TIME ZONE 'UTC') AS start_at,
  (($2::date + 1)::timestamp AT TIME ZONE $3 AT TIME ZONE 'UTC') AS end_at)`;
const MEASURED_MS = `CASE WHEN e.event_type = 'activity_heartbeat' AND e.payload_json->>'measurement_version' = '1'
  AND e.payload_json->>'active_ms' ~ '^[0-9]{1,5}$'
  THEN LEAST(45000, (e.payload_json->>'active_ms')::int) END`;
const OBSERVATIONS = `observations AS (
  SELECT e.user_id, e.occurred_at AS at, e.event_type,
    e.payload_json->>'session_id' AS session_id, ${MEASURED_MS} AS active_ms,
    false AS visit, e.event_type <> 'activity_heartbeat' AS action
  FROM user_app_events e CROSS JOIN bounds b WHERE e.occurred_at >= b.start_at
    AND e.occurred_at < b.end_at AND e.event_type = ANY($4::text[])
  UNION ALL
  SELECT s.user_id, s.started_at, 'session_started', s.session_id, NULL::int, true, false
  FROM user_sessions s CROSS JOIN bounds b WHERE s.started_at >= b.start_at AND s.started_at < b.end_at
)`;
const summaryFields = (row: any) => ({
  visits: n(row.visits), events: n(row.events), activeMs: nullable(row.active_ms),
  avgActiveMs: nullable(row.avg_active_ms), measuredVisits: n(row.measured_visits),
});

export async function getActivityReport(range: AdminActivityRange): Promise<AdminActivityReport> {
  const pool = getPool();
  const params = [range.from, range.to, range.timezone, INTERACTIVE_EVENT_TYPES];
  const [summary, windows, series, actions, screens, funnel] = await Promise.all([
    pool.query(`WITH ${BOUNDS}, ${OBSERVATIONS}
      SELECT COUNT(DISTINCT o.user_id)::int AS unique_users,
        COUNT(*) FILTER(WHERE visit)::int AS visits, COUNT(*) FILTER(WHERE action)::int AS events,
        SUM(active_ms)::bigint AS active_ms,
        COUNT(DISTINCT (o.user_id, session_id)) FILTER(WHERE active_ms IS NOT NULL)::int AS measured_visits,
        ROUND(SUM(active_ms)::numeric / NULLIF(COUNT(DISTINCT (o.user_id, session_id)) FILTER(WHERE active_ms IS NOT NULL),0)) AS avg_active_ms,
        COUNT(DISTINCT o.user_id) FILTER(WHERE u.created_at >= b.start_at)::int AS new_users,
        COUNT(DISTINCT o.user_id) FILTER(WHERE u.created_at < b.start_at)::int AS returning_users
      FROM observations o JOIN users u ON u.id = o.user_id CROSS JOIN bounds b`, params),
    pool.query(`WITH ${BOUNDS}, endpoint AS (SELECT LEAST(end_at, NOW() AT TIME ZONE 'UTC') AS at FROM bounds), recent AS (
      SELECT e.user_id, e.occurred_at AS at FROM user_app_events e CROSS JOIN endpoint p
        WHERE e.occurred_at >= p.at - INTERVAL '30 days' AND e.occurred_at < p.at AND e.event_type = ANY($4::text[])
      UNION ALL SELECT s.user_id, s.started_at FROM user_sessions s CROSS JOIN endpoint p
        WHERE s.started_at >= p.at - INTERVAL '30 days' AND s.started_at < p.at)
      SELECT COUNT(DISTINCT user_id) FILTER(WHERE r.at >= p.at - INTERVAL '1 day')::int AS dau,
        COUNT(DISTINCT user_id) FILTER(WHERE r.at >= p.at - INTERVAL '7 days')::int AS wau,
        COUNT(DISTINCT user_id)::int AS mau FROM recent r CROSS JOIN endpoint p`, params),
    pool.query(`WITH ${BOUNDS}, ${OBSERVATIONS}, grouped AS (
      SELECT date_trunc($5, at AT TIME ZONE 'UTC' AT TIME ZONE $3) AS bucket,
        COUNT(DISTINCT user_id)::int AS users, COUNT(*) FILTER(WHERE visit)::int AS visits,
        COUNT(*) FILTER(WHERE action)::int AS events, SUM(active_ms)::bigint AS active_ms
      FROM observations GROUP BY 1), buckets AS (
        SELECT generate_series($1::date::timestamp, ($2::date + 1)::timestamp - ('1 ' || $5)::interval,
          ('1 ' || $5)::interval) AS bucket)
      SELECT to_char(b.bucket,'YYYY-MM-DD"T"HH24:MI:SS') AS at, COALESCE(g.users,0) AS users,
        COALESCE(g.visits,0) AS visits, COALESCE(g.events,0) AS events, g.active_ms
      FROM buckets b LEFT JOIN grouped g USING(bucket) ORDER BY b.bucket`, [...params, range.bucket]),
    pool.query(`WITH ${BOUNDS} SELECT e.event_type, COUNT(*)::int AS events, COUNT(DISTINCT e.user_id)::int AS users
      FROM user_app_events e CROSS JOIN bounds b WHERE occurred_at >= start_at AND occurred_at < end_at
        AND e.event_type = ANY($4::text[]) AND e.event_type NOT IN ('activity_heartbeat','screen_view','app_opened')
      GROUP BY e.event_type ORDER BY events DESC LIMIT 40`, params),
    pool.query(`WITH ${BOUNDS} SELECT e.section, COUNT(*) FILTER(WHERE event_type='screen_view')::int AS events,
        COUNT(DISTINCT e.user_id)::int AS users, SUM(${MEASURED_MS})::bigint AS active_ms
      FROM user_app_events e CROSS JOIN bounds b WHERE occurred_at >= start_at AND occurred_at < end_at
        AND event_type IN ('screen_view','activity_heartbeat') AND e.section IS NOT NULL
      GROUP BY e.section ORDER BY events DESC LIMIT 30`, params.slice(0, 3)),
    pool.query(`WITH ${BOUNDS}, cohort AS (
      SELECT u.id AS user_id, u.created_at AS started FROM users u CROSS JOIN bounds b
        WHERE u.created_at >= b.start_at AND u.created_at < b.end_at), journey AS (
      SELECT c.user_id, f.at AS forecast, p.at AS premium, x.at AS checkout, paid.at AS purchase FROM cohort c CROSS JOIN bounds b
      LEFT JOIN LATERAL (SELECT MIN(e.occurred_at) AS at FROM user_app_events e WHERE e.user_id=c.user_id
        AND e.occurred_at >= c.started AND e.occurred_at < b.end_at
        AND (e.event_type IN ('horoscope_opened','first_value_viewed') OR
          (e.event_type='first_result_ready' AND e.payload_json->>'result_type'='personal_forecast'))) f ON true
      LEFT JOIN LATERAL (SELECT MIN(e.occurred_at) AS at FROM user_app_events e WHERE e.user_id=c.user_id
        AND e.occurred_at >= f.at AND e.occurred_at < b.end_at
        AND e.event_type IN ('paywall_view','paywall_viewed','paywall_impression')) p ON true
      LEFT JOIN LATERAL (SELECT MIN(e.occurred_at) AS at FROM user_app_events e WHERE e.user_id=c.user_id
        AND e.occurred_at >= p.at AND e.occurred_at < b.end_at AND e.event_type IN ('checkout_start','checkout_started')) x ON true
      LEFT JOIN LATERAL (SELECT MIN(e.occurred_at) AS at FROM user_app_events e WHERE e.user_id=c.user_id
        AND e.occurred_at >= x.at AND e.occurred_at < b.end_at
        AND e.event_type IN ('purchase_success','purchase_succeeded','purchase','subscription_started')) paid ON true)
      SELECT COUNT(*)::int AS onboarding, COUNT(forecast)::int AS forecast, COUNT(premium)::int AS premium,
        COUNT(checkout)::int AS checkout, COUNT(purchase)::int AS purchase FROM journey`, params.slice(0, 3)),
  ]);
  const s = summary.rows[0] || {};
  const w = windows.rows[0] || {};
  const f = funnel.rows[0] || {};
  const steps = [['onboarding', 'Знакомство'], ['forecast', 'Личный прогноз'], ['premium', 'Открытие Premium'],
    ['checkout', 'Начало оплаты'], ['purchase', 'Покупка']];
  return {
    generatedAt: new Date().toISOString(), range,
    summary: { ...summaryFields(s), uniqueUsers: n(s.unique_users), newUsers: n(s.new_users),
      returningUsers: n(s.returning_users), dau: n(w.dau), wau: n(w.wau), mau: n(w.mau) },
    series: series.rows.map((r: any) => ({ at: r.at, users: n(r.users), visits: n(r.visits), events: n(r.events), activeMs: nullable(r.active_ms) })),
    funnels: steps.map(([key, label], index) => ({ key, label, users: n(f[key]),
      percent: n(f.onboarding) ? Math.round(100 * n(f[key]) / n(f.onboarding)) : null,
      pctOfPrev: n(f[index ? steps[index - 1][0] : key]) ? Math.round(100 * n(f[key]) / n(f[index ? steps[index - 1][0] : key])) : null })),
    topActions: actions.rows.map((r: any) => ({ key: canonicalizeEvent(r.event_type), label: eventLabel(r.event_type), events: n(r.events), users: n(r.users) })),
    topScreens: screens.rows.filter((r: any) => activityScreen(r.section)).map((r: any) => ({
      key: r.section, label: SCREENS[r.section], events: n(r.events), users: n(r.users), activeMs: nullable(r.active_ms) })),
  };
}

export async function getUserActivityReport(userId: string, range: AdminActivityRange, cursor?: string, limit = 40): Promise<AdminUserActivityReport> {
  if (cursor != null && !/^\d{1,20}$/.test(cursor)) throw new AdminAuthError(400, 'INVALID_CURSOR', 'Неверная страница');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new AdminAuthError(400, 'INVALID_LIMIT', 'Неверный размер страницы');
  const pool = getPool();
  const exists = await pool.query('SELECT id FROM users WHERE id=$1', [userId]);
  if (!exists.rows.length) throw new AdminAuthError(404, 'USER_NOT_FOUND', 'Пользователь не найден');
  const params = [range.from, range.to, range.timezone, userId];
  const [summary, timeline, visits] = await Promise.all([
    pool.query(`WITH ${BOUNDS}, measured AS (SELECT ${MEASURED_MS} AS active_ms, e.payload_json->>'session_id' AS session_id,
        e.event_type FROM user_app_events e CROSS JOIN bounds b
        WHERE e.user_id=$4 AND e.occurred_at>=start_at AND e.occurred_at<end_at AND e.event_type=ANY($5::text[]))
      SELECT (SELECT COUNT(*) FROM user_sessions s CROSS JOIN bounds b WHERE s.user_id=$4 AND s.started_at>=start_at AND s.started_at<end_at)::int AS visits,
        COUNT(*) FILTER(WHERE event_type<>'activity_heartbeat')::int AS events, SUM(active_ms)::bigint AS active_ms,
        COUNT(DISTINCT session_id) FILTER(WHERE active_ms IS NOT NULL)::int AS measured_visits,
        ROUND(SUM(active_ms)::numeric/NULLIF(COUNT(DISTINCT session_id) FILTER(WHERE active_ms IS NOT NULL),0)) AS avg_active_ms
      FROM measured`, [...params, INTERACTIVE_EVENT_TYPES]),
    pool.query(`WITH ${BOUNDS} SELECT e.id, e.occurred_at AT TIME ZONE 'UTC' AS occurred_at, e.event_type, e.section, e.source,
        e.payload_json->>'session_id' AS session_id FROM user_app_events e CROSS JOIN bounds b
      WHERE e.user_id=$4 AND e.occurred_at>=start_at AND e.occurred_at<end_at
        AND e.event_type<>'activity_heartbeat' AND ($5::bigint IS NULL OR e.id<$5)
      ORDER BY e.id DESC LIMIT $6`, [...params, cursor || null, limit + 1]),
    pool.query(`WITH ${BOUNDS} SELECT s.session_id, s.started_at AT TIME ZONE 'UTC' AS started_at,
        s.last_seen_at AT TIME ZONE 'UTC' AS last_seen_at, s.device_label, s.telegram_platform,
        m.active_ms FROM user_sessions s CROSS JOIN bounds b LEFT JOIN LATERAL (
          SELECT SUM(${MEASURED_MS})::bigint AS active_ms FROM user_app_events e
          WHERE e.user_id=s.user_id AND e.event_type='activity_heartbeat' AND e.payload_json->>'session_id'=s.session_id
            AND e.occurred_at>=b.start_at AND e.occurred_at<b.end_at) m ON true
      WHERE s.user_id=$4 AND s.started_at<b.end_at AND s.last_seen_at>=b.start_at
      ORDER BY s.started_at DESC LIMIT 100`, params),
  ]);
  const page = timeline.rows.slice(0, limit);
  return { generatedAt: new Date().toISOString(), range, summary: summaryFields(summary.rows[0] || {}),
    timeline: page.map((r: any) => ({ id: String(r.id), at: iso(r.occurred_at),
      type: canonicalizeEvent(r.event_type), label: eventLabel(r.event_type), section: activityScreen(r.section),
      source: typeof r.source === 'string' && /^[a-z][a-z0-9_]{0,50}$/.test(r.source) ? r.source : null,
      sessionId: activityId(r.session_id) })),
    visits: visits.rows.map((r: any) => ({ id: r.session_id, startedAt: iso(r.started_at), lastSeenAt: iso(r.last_seen_at),
      device: r.device_label || null, platform: r.telegram_platform || null, activeMs: nullable(r.active_ms) })),
    nextCursor: timeline.rows.length > limit ? String(page[page.length - 1].id) : null };
}
