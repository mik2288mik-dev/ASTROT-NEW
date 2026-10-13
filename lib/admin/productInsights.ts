import type { PoolClient } from 'pg';
import { getPool } from '../db';
import { CHECKOUT_EVENTS, PAYWALL_EVENTS, type Period } from '../productMetrics';
import { STEP_LABELS, ONBOARDING_STEPS } from '../journeyTelemetry';
import { TRACE_SCREEN_LABELS } from '../appTelemetry';
import { operationLabel, readableLabel } from './telemetryCopy';
import { aiScenarioLabel } from '../aiScenarioLabels';

/** Path, waits and reading: what the admin shows under «Путь и воронки». */

type Queryable = Pick<PoolClient, 'query'>;
const n = (value: unknown) => Number(value || 0);

export type FunnelStep = { key: string; label: string; hint: string; count: number };

/**
 * People who first launched in the period, followed through the product.
 * Each step counts people who reached it at any time after their first launch.
 */
export async function collectProductFunnel(period: Period, db: Queryable = getPool()): Promise<FunnelStep[]> {
  const result = await db.query(
    `WITH fresh AS (SELECT u.id, u.created_at, u.birth_date, u.is_guest FROM users u
                    WHERE u.created_at >= $1::timestamptz AND u.created_at < $2::timestamptz),
     ev AS (SELECT e.user_id, e.event_type, e.occurred_at FROM user_app_events e JOIN fresh f ON f.id = e.user_id)
     SELECT
       (SELECT COUNT(*) FROM fresh)::int AS launched,
       (SELECT COUNT(*) FROM fresh f WHERE f.birth_date IS NOT NULL
          OR EXISTS (SELECT 1 FROM natal_charts c WHERE c.user_id = f.id))::int AS birth_data,
       (SELECT COUNT(*) FROM fresh f WHERE EXISTS (SELECT 1 FROM natal_charts c WHERE c.user_id = f.id))::int AS chart,
       (SELECT COUNT(DISTINCT user_id) FROM ev WHERE event_type IN ('first_value_viewed', 'first_result_ready'))::int AS first_value,
       (SELECT COUNT(*) FROM fresh f WHERE f.is_guest IS NOT TRUE)::int AS registered,
       (SELECT COUNT(*) FROM fresh f WHERE EXISTS (SELECT 1 FROM user_app_events e WHERE e.user_id = f.id
          AND e.occurred_at >= (f.created_at + INTERVAL '1 day') AT TIME ZONE 'UTC'))::int AS returned,
       (SELECT COUNT(DISTINCT user_id) FROM ev WHERE event_type = ANY($3::text[]))::int AS paywall,
       (SELECT COUNT(DISTINCT user_id) FROM ev WHERE event_type = ANY($4::text[]))::int AS checkout,
       (SELECT COUNT(DISTINCT o.user_id) FROM nebo_ops_outbox o JOIN fresh f ON f.id = o.user_id
          WHERE o.event_type = 'payment_confirmed' AND COALESCE(o.payload_json->>'sandbox', 'false') <> 'true')::int AS paid`,
    [period.start.toISOString(), period.end.toISOString(), PAYWALL_EVENTS, CHECKOUT_EVENTS],
  );
  const r = result.rows[0] || {};
  return [
    { key: 'launched', label: 'Первый запуск', hint: 'Открыли приложение или сайт впервые', count: n(r.launched) },
    { key: 'birth_data', label: 'Ввели данные рождения', hint: 'Дата рождения сохранена', count: n(r.birth_data) },
    { key: 'chart', label: 'Получили натальную карту', hint: 'Карта посчитана и сохранена', count: n(r.chart) },
    { key: 'first_value', label: 'Увидели первый результат', hint: 'Открыли свой разбор или прогноз', count: n(r.first_value) },
    { key: 'registered', label: 'Зарегистрировались', hint: 'Вошли через VK, Яндекс, почту или Telegram', count: n(r.registered) },
    { key: 'returned', label: 'Вернулись на следующий день', hint: 'Зашли снова через сутки и позже', count: n(r.returned) },
    { key: 'paywall', label: 'Открыли экран оплаты', hint: 'Увидели предложение Premium', count: n(r.paywall) },
    { key: 'checkout', label: 'Начали оплату', hint: 'Выбрали тариф и нажали оплатить', count: n(r.checkout) },
    { key: 'paid', label: 'Оплатили', hint: 'Оплата подтверждена RuStore', count: n(r.paid) },
  ];
}

const PLACEMENT_LABELS: Record<string, string> = {
  matrix: 'Матрица судьбы', today: 'Прогноз на сегодня', week: 'Прогноз на неделю', month: 'Прогноз на месяц',
  deep_natal: 'Подробный разбор карты', personality_deep: 'Разбор личности', natal_questions: 'Спросить о себе',
  compatibility_by_charts: 'Совместимость по картам', saved_people: 'Мои люди', settings: 'Настройки',
};

/** From which place in the app people open the Premium offer, and how many of them then paid. */
export async function collectPaywallPlacements(period: Period, db: Queryable = getPool()): Promise<Array<{ label: string; count: number; note?: string }>> {
  const result = await db.query(
    `WITH views AS (
       SELECT DISTINCT e.user_id, COALESCE(NULLIF(e.payload_json->>'placement', ''), e.section, 'unknown') AS placement
       FROM user_app_events e
       WHERE e.event_type = ANY($3::text[])
         AND e.occurred_at >= $1::timestamptz AT TIME ZONE 'UTC' AND e.occurred_at < $2::timestamptz AT TIME ZONE 'UTC'
     )
     SELECT placement, COUNT(*)::int AS people,
            COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM nebo_ops_outbox o WHERE o.user_id = v.user_id
              AND o.event_type = 'payment_confirmed' AND o.occurred_at >= $1::timestamptz
              AND COALESCE(o.payload_json->>'sandbox', 'false') <> 'true'))::int AS paid
     FROM views v GROUP BY 1 ORDER BY people DESC LIMIT 12`,
    [period.start.toISOString(), period.end.toISOString(), PAYWALL_EVENTS],
  );
  return result.rows.map((row) => ({
    label: PLACEMENT_LABELS[String(row.placement)] || (row.placement === 'unknown' ? 'Место не известно' : String(row.placement).replace(/_/g, ' ')),
    count: n(row.people),
    note: n(row.paid) ? `оплатили ${n(row.paid)}` : undefined,
  }));
}
export type OnboardingStep = { step: string; label: string; reached: number; leftHere: number; medianSeconds: number | null };

/** Where the first acquaintance loses people: the last step each attempt reached. */
export async function collectOnboarding(period: Period, db: Queryable = getPool()): Promise<{ attempts: number; finished: number; steps: OnboardingStep[] }> {
  const result = await db.query(
    `WITH views AS (
       SELECT e.user_id, COALESCE(e.payload_json->>'attempt_id', e.user_id::text) AS attempt,
              e.payload_json->>'step' AS step, e.event_type, e.occurred_at,
              NULLIF(e.payload_json->>'visible_ms', '')::bigint AS visible_ms
       FROM user_app_events e
       WHERE e.event_type IN ('onboarding_step_view', 'onboarding_step_exit', 'onboarding_completed')
         AND e.occurred_at >= $1::timestamptz AT TIME ZONE 'UTC' AND e.occurred_at < $2::timestamptz AT TIME ZONE 'UTC'
     ),
     last_step AS (
       SELECT DISTINCT ON (attempt) attempt, step FROM views
       WHERE event_type = 'onboarding_step_view' ORDER BY attempt, occurred_at DESC
     ),
     finished AS (SELECT DISTINCT attempt FROM views WHERE event_type = 'onboarding_completed')
     SELECT
       (SELECT COUNT(DISTINCT attempt) FROM views)::int AS attempts,
       (SELECT COUNT(*) FROM finished)::int AS finished,
       (SELECT COALESCE(jsonb_object_agg(step, c), '{}'::jsonb) FROM (
          SELECT step, COUNT(DISTINCT attempt)::int AS c FROM views WHERE event_type = 'onboarding_step_view' GROUP BY step) x) AS reached,
       (SELECT COALESCE(jsonb_object_agg(step, c), '{}'::jsonb) FROM (
          SELECT l.step, COUNT(*)::int AS c FROM last_step l
          WHERE NOT EXISTS (SELECT 1 FROM finished f WHERE f.attempt = l.attempt) GROUP BY l.step) x) AS left_here,
       (SELECT COALESCE(jsonb_object_agg(step, m), '{}'::jsonb) FROM (
          SELECT step, percentile_cont(0.5) WITHIN GROUP (ORDER BY visible_ms) / 1000.0 AS m FROM views
          WHERE event_type = 'onboarding_step_exit' AND visible_ms IS NOT NULL GROUP BY step) x) AS median`,
    [period.start.toISOString(), period.end.toISOString()],
  );
  const r = result.rows[0] || {};
  const steps = ONBOARDING_STEPS
    .map((step) => ({
      step, label: STEP_LABELS[step] || step,
      reached: n(r.reached?.[step]), leftHere: n(r.left_here?.[step]),
      medianSeconds: r.median?.[step] == null ? null : Math.round(Number(r.median[step])),
    }))
    .filter((step) => step.reached > 0);
  return { attempts: n(r.attempts), finished: n(r.finished), steps };
}

export type WaitRow = { key: string; label: string; count: number; failed: number; medianSeconds: number | null; p90Seconds: number | null };

async function tableExists(db: Queryable, name: string): Promise<boolean> {
  const result = await db.query('SELECT to_regclass($1) IS NOT NULL AS ok', [name]);
  return result.rows[0]?.ok === true;
}

/**
 * How long people wait. Three honest sources: the natal reading queue (server),
 * every AI request (server), and loading spinners measured on the phone.
 */
export async function collectWaits(period: Period, db: Queryable = getPool()): Promise<{ server: WaitRow[]; ai: WaitRow[]; screens: WaitRow[] }> {
  const params = [period.start.toISOString(), period.end.toISOString()];
  const server: WaitRow[] = [];
  if (await tableExists(db, 'natal_reading_jobs')) {
    const jobs = (await db.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'ready')::int AS ready,
              COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM updated_at - created_at)) FILTER (WHERE status = 'ready') AS median,
              percentile_cont(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM updated_at - created_at)) FILTER (WHERE status = 'ready') AS p90
       FROM natal_reading_jobs WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz`, params,
    )).rows[0] || {};
    server.push({ key: 'natal_reading', label: 'Подробный разбор натальной карты', count: n(jobs.ready) + n(jobs.failed),
      failed: n(jobs.failed), medianSeconds: jobs.median == null ? null : Math.round(jobs.median), p90Seconds: jobs.p90 == null ? null : Math.round(jobs.p90) });
  }
  const onboardingWaits = (await db.query(
    `SELECT e.payload_json->>'phase' AS phase, COUNT(*)::int AS count,
            COUNT(*) FILTER (WHERE e.payload_json->>'outcome' IN ('failed', 'cancelled'))::int AS failed,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY (e.payload_json->>'elapsed_ms')::bigint) / 1000.0 AS median,
            percentile_cont(0.9) WITHIN GROUP (ORDER BY (e.payload_json->>'elapsed_ms')::bigint) / 1000.0 AS p90
     FROM user_app_events e
     WHERE e.event_type = 'onboarding_wait_finished' AND e.payload_json ? 'elapsed_ms'
       AND e.occurred_at >= $1::timestamptz AT TIME ZONE 'UTC' AND e.occurred_at < $2::timestamptz AT TIME ZONE 'UTC'
     GROUP BY 1`, params,
  )).rows;
  for (const row of onboardingWaits) {
    server.push({ key: `onboarding_${row.phase}`, label: row.phase === 'reading' ? 'Ожидание первого разбора при знакомстве' : 'Ожидание расчёта карты при знакомстве',
      count: n(row.count), failed: n(row.failed), medianSeconds: Math.round(Number(row.median || 0)), p90Seconds: Math.round(Number(row.p90 || 0)) });
  }
  const ai = (await db.query(
    `SELECT scenario, COUNT(*)::int AS count, COUNT(*) FILTER (WHERE status <> 'success')::int AS failed,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms) / 1000.0 AS median,
            percentile_cont(0.9) WITHIN GROUP (ORDER BY duration_ms) / 1000.0 AS p90
     FROM app_ai_requests WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz
       AND scenario <> 'content_diagnostic'
     GROUP BY scenario ORDER BY count DESC LIMIT 20`, params,
  ).catch(() => ({ rows: [] as any[] }))).rows.map((row) => ({
    key: String(row.scenario), label: aiScenarioLabel(String(row.scenario)), count: n(row.count), failed: n(row.failed),
    medianSeconds: row.median == null ? null : Math.round(Number(row.median) * 10) / 10,
    p90Seconds: row.p90 == null ? null : Math.round(Number(row.p90) * 10) / 10,
  }));
  let screens: WaitRow[] = [];
  if (await tableExists(db, 'product_trace_events')) {
    const rows = (await db.query(
      `SELECT payload_json->>'operation' AS operation, COUNT(*)::int AS count,
              COUNT(*) FILTER (WHERE payload_json->>'outcome' IS DISTINCT FROM 'success')::int AS failed,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY (payload_json->>'duration_ms')::bigint) / 1000.0 AS median,
              percentile_cont(0.9) WITHIN GROUP (ORDER BY (payload_json->>'duration_ms')::bigint) / 1000.0 AS p90
       FROM product_trace_events
       WHERE event_type = 'request_finished' AND payload_json ? 'duration_ms' AND payload_json ? 'operation'
         AND occurred_at >= $1::timestamptz AND occurred_at < $2::timestamptz
       GROUP BY 1`, params,
    )).rows;
    const merged = new Map<string, WaitRow>();
    for (const row of rows) {
      const label = operationLabel(String(row.operation));
      const current = merged.get(label);
      // Several endpoints share one human name; keep the slowest figures.
      merged.set(label, {
        key: label, label, count: (current?.count || 0) + n(row.count), failed: (current?.failed || 0) + n(row.failed),
        medianSeconds: Math.max(current?.medianSeconds || 0, Math.round(Number(row.median) * 10) / 10),
        p90Seconds: Math.max(current?.p90Seconds || 0, Math.round(Number(row.p90) * 10) / 10),
      });
    }
    screens = [...merged.values()].sort((a, b) => (b.p90Seconds || 0) - (a.p90Seconds || 0)).slice(0, 15);
  }
  return { server, ai, screens };
}

export type ReadingRow = { screen: string; block: string; people: number; medianSeconds: number; focusSeconds: number };

/** Which blocks people actually read: time on screen per block, from the phone. */
export async function collectReading(period: Period, db: Queryable = getPool()): Promise<{ blocks: ReadingRow[]; screens: Array<{ screen: string; people: number; medianSeconds: number }> }> {
  if (!(await tableExists(db, 'product_trace_events'))) return { blocks: [], screens: [] };
  const params = [period.start.toISOString(), period.end.toISOString()];
  const blocks = (await db.query(
    `WITH per_view AS (
       SELECT v.user_id, COALESCE(v.user_id::text, v.id::text) AS who, e.screen, e.payload_json->>'block' AS block,
              e.payload_json->>'view_id' AS view_id,
              MAX((e.payload_json->>'visible_ms')::bigint) AS visible_ms, MAX(COALESCE((e.payload_json->>'focus_ms')::bigint, 0)) AS focus_ms
       FROM product_trace_events e JOIN product_trace_visits v ON v.id = e.visit_id
       WHERE e.event_type = 'content_view' AND e.payload_json ? 'block'
         AND e.occurred_at >= $1::timestamptz AND e.occurred_at < $2::timestamptz
       GROUP BY 1, 2, 3, 4, 5
     )
     SELECT screen, block, COUNT(DISTINCT who)::int AS people,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY visible_ms) / 1000.0 AS median,
            AVG(focus_ms) / 1000.0 AS focus
     FROM per_view GROUP BY 1, 2 ORDER BY people DESC, median DESC LIMIT 40`, params,
  )).rows.map((row) => ({
    screen: TRACE_SCREEN_LABELS[String(row.screen)] || String(row.screen), block: readableLabel(row.block, 'Блок без названия'),
    people: n(row.people), medianSeconds: Math.round(Number(row.median || 0)), focusSeconds: Math.round(Number(row.focus || 0)),
  }));
  const screens = (await db.query(
    `SELECT e.screen, COUNT(DISTINCT COALESCE(v.user_id::text, v.id::text))::int AS people,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY (e.payload_json->>'visible_ms')::bigint) / 1000.0 AS median
     FROM product_trace_events e JOIN product_trace_visits v ON v.id = e.visit_id
     WHERE e.event_type = 'screen_exit' AND e.payload_json ? 'visible_ms'
       AND e.occurred_at >= $1::timestamptz AND e.occurred_at < $2::timestamptz
     GROUP BY 1 ORDER BY people DESC LIMIT 20`, params,
  )).rows.map((row) => ({
    screen: TRACE_SCREEN_LABELS[String(row.screen)] || String(row.screen), people: n(row.people), medianSeconds: Math.round(Number(row.median || 0)),
  }));
  return { blocks, screens };
}

/** People who did not get a chart within two hours of the first launch (for the bot and the admin). */
export async function collectAbandonedOnboarding(sinceHours: number, db: Queryable = getPool()): Promise<Array<{ id: string; name: string | null; createdAt: string; lastStep: string | null }>> {
  const result = await db.query(
    `SELECT u.id, u.name, u.created_at,
            (SELECT e.payload_json->>'step' FROM user_app_events e WHERE e.user_id = u.id
               AND e.event_type = 'onboarding_step_view' ORDER BY e.occurred_at DESC LIMIT 1) AS last_step
     FROM users u
     WHERE u.created_at >= NOW() - $1 * INTERVAL '1 hour' AND u.created_at <= NOW() - INTERVAL '2 hours'
       AND NOT EXISTS (SELECT 1 FROM natal_charts c WHERE c.user_id = u.id)
     ORDER BY u.created_at DESC LIMIT 50`,
    [Math.max(3, Math.min(24 * 7, sinceHours))],
  );
  return result.rows.map((row) => ({
    id: String(row.id), name: row.name || null, createdAt: new Date(row.created_at).toISOString(),
    lastStep: row.last_step ? STEP_LABELS[String(row.last_step)] || String(row.last_step) : null,
  }));
}

