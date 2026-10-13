import type { PoolClient } from 'pg';
import { getPool } from '../db';
import { ACTIONS } from '../neboOps';
import { ACTION_LABELS, STEP_LABELS } from '../journeyTelemetry';
import { TRACE_LABELS, TRACE_SCREEN_LABELS } from '../appTelemetry';
import {
  CHANNEL_LABELS,
  PERSON_SOURCE_JOINS,
  PERSON_SOURCE_SQL,
  planLabel,
  planPriceRub,
  PROVIDER_LABELS,
  SCREEN_LABELS,
} from '../productMetrics';
import { operationLabel, traceNote } from './telemetryCopy';

/** «Люди»: one list and one story per person, from every place the app leaves traces. */

type Queryable = Pick<PoolClient, 'query'>;
export const PEOPLE_SEGMENTS = ['all', 'active', 'new', 'premium', 'paying', 'stuck', 'guests'] as const;
export type PeopleSegment = typeof PEOPLE_SEGMENTS[number];

export type PersonRow = {
  id: string;
  name: string | null;
  isGuest: boolean;
  signIn: string;
  source: string;
  createdAt: string;
  lastSeenAt: string | null;
  premiumUntil: string | null;
  payments: number;
  hasChart: boolean;
  appVersion: string | null;
  device: string | null;
};

const iso = (value: unknown) => {
  const date = value instanceof Date ? value : value ? new Date(String(value)) : null;
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

const PERSON_FIELDS = `u.id, u.name, u.is_guest, u.auth_provider, u.platform, u.created_at,
  ${PERSON_SOURCE_SQL} AS source,
  NULLIF(GREATEST(COALESCE(u.premium_until, '-infinity'::timestamptz),
    COALESCE((SELECT MAX(pe.ends_at) FROM premium_entitlements pe WHERE pe.user_id = u.id AND pe.status = 'active') AT TIME ZONE 'UTC', '-infinity'::timestamptz)),
    '-infinity'::timestamptz) AS premium_until,
  NULLIF(GREATEST(
    COALESCE((SELECT MAX(e.occurred_at) FROM user_app_events e WHERE e.user_id = u.id
      AND COALESCE(e.source, '') NOT IN ('rustore_callback', 'entitlement_expiry')) AT TIME ZONE 'UTC', '-infinity'::timestamptz),
    COALESCE((SELECT MAX(s.last_seen_at) FROM app_sessions s WHERE s.user_id = u.id) AT TIME ZONE 'UTC', '-infinity'::timestamptz),
    COALESCE((SELECT MAX(us.last_seen_at) FROM user_sessions us WHERE us.user_id = u.id) AT TIME ZONE 'UTC', '-infinity'::timestamptz)
  ), '-infinity'::timestamptz) AS last_seen,
  (SELECT COUNT(*) FROM nebo_ops_outbox o WHERE o.user_id = u.id AND o.event_type = 'payment_confirmed'
     AND COALESCE(o.payload_json->>'sandbox', 'false') <> 'true')::int AS payments,
  EXISTS (SELECT 1 FROM natal_charts c WHERE c.user_id = u.id) AS has_chart,
  (SELECT e.payload_json->>'app_version' FROM user_app_events e WHERE e.user_id = u.id AND e.payload_json ? 'app_version'
     ORDER BY e.occurred_at DESC LIMIT 1) AS app_version,
  (SELECT o.payload_json FROM nebo_ops_outbox o WHERE o.user_id = u.id AND o.payload_json ? 'deviceModel'
     ORDER BY o.occurred_at DESC LIMIT 1) AS runtime`;

function deviceText(runtime: Record<string, unknown> | null | undefined): string | null {
  if (!runtime) return null;
  const maker = String(runtime.deviceManufacturer || '');
  const model = String(runtime.deviceModel || '');
  const device = [maker && !model.toLowerCase().startsWith(maker.toLowerCase()) ? maker : '', model].filter(Boolean).join(' ');
  const os = runtime.osName ? `${runtime.osName}${runtime.osVersion ? ` ${runtime.osVersion}` : ''}` : '';
  return [device, os].filter(Boolean).join(' · ') || null;
}

function toRow(row: Record<string, any>): PersonRow {
  return {
    id: String(row.id),
    name: row.name ? String(row.name).trim().slice(0, 80) || null : null,
    isGuest: row.is_guest === true,
    signIn: PROVIDER_LABELS[String(row.auth_provider || '')] || 'Не известно',
    source: String(row.source || 'Не известно'),
    createdAt: iso(row.created_at) || '',
    lastSeenAt: iso(row.last_seen),
    premiumUntil: iso(row.premium_until),
    payments: Number(row.payments || 0),
    hasChart: row.has_chart === true,
    appVersion: row.app_version || row.runtime?.appVersion || null,
    device: deviceText(row.runtime),
  };
}

export async function listPeople(input: { q?: string; segment?: string; limit?: number; offset?: number }, db: Queryable = getPool()) {
  const segment = (PEOPLE_SEGMENTS as readonly string[]).includes(String(input.segment)) ? input.segment as PeopleSegment : 'all';
  const q = String(input.q || '').trim().slice(0, 80);
  const limit = Math.max(1, Math.min(100, Math.trunc(Number(input.limit) || 50)));
  const offset = Math.max(0, Math.trunc(Number(input.offset) || 0));
  const filters: Record<PeopleSegment, string> = {
    all: 'TRUE',
    active: "last_seen >= NOW() - INTERVAL '7 days'",
    new: "created_at >= NOW() - INTERVAL '7 days'",
    premium: 'premium_until > NOW()',
    paying: 'payments > 0',
    stuck: "NOT has_chart AND created_at <= NOW() - INTERVAL '2 hours'",
    guests: 'is_guest',
  };
  const result = await db.query(
    `WITH people AS (
       SELECT ${PERSON_FIELDS} FROM users u ${PERSON_SOURCE_JOINS}
       WHERE ($1 = '' OR u.id::text = $1 OR u.name ILIKE '%' || $1 || '%'
              OR EXISTS (SELECT 1 FROM account_identities ai WHERE ai.user_id = u.id
                         AND (ai.provider_subject = $1 OR ai.display_name ILIKE '%' || $1 || '%')))
     )
     SELECT *, COUNT(*) OVER()::int AS total FROM people WHERE ${filters[segment]}
     ORDER BY last_seen DESC NULLS LAST, created_at DESC LIMIT $2 OFFSET $3`,
    [q, limit, offset],
  );
  return { total: Number(result.rows[0]?.total || 0), rows: result.rows.map(toRow), segment, q, limit, offset };
}

export type StoryStep = { at: string; kind: 'screen' | 'action' | 'wait' | 'money' | 'error' | 'reading' | 'system' | 'onboarding'; text: string; note?: string; slow?: boolean };
export type StoryVisit = { start: string; end: string; seconds: number; device: string | null; steps: StoryStep[] };

function screenName(value: unknown): string {
  const key = String(value || '');
  return TRACE_SCREEN_LABELS[key] || SCREEN_LABELS[key] || key || 'неизвестный экран';
}
const seconds = (ms: number) => ms >= 60_000 ? `${Math.round(ms / 60_000)} мин` : `${Math.max(1, Math.round(ms / 1000))} с`;

function appEventStep(row: Record<string, any>): StoryStep | null {
  const at = iso(row.at)!;
  const p = (row.payload || {}) as Record<string, any>;
  const type = String(row.event_type);
  if (type === 'screen_view') return { at, kind: 'screen', text: `Открыл «${screenName(row.section)}»` };
  if (type === 'onboarding_step_view') return { at, kind: 'onboarding', text: `Знакомство: «${STEP_LABELS[String(p.step)] || p.step || 'шаг'}»` };
  if (type === 'onboarding_action') return { at, kind: 'onboarding', text: `Знакомство: нажал «${ACTION_LABELS[String(p.action)] || p.action || 'кнопку'}»` };
  if (type === 'birth_validation_error') return { at, kind: 'error', text: 'Ошибка в данных рождения', note: p.field ? `поле: ${p.field}` : undefined };
  if (type === 'onboarding_wait_finished') {
    const ms = Number(p.elapsed_ms || 0);
    return { at, kind: 'wait', text: `Ждал ${p.phase === 'reading' ? 'первый разбор' : 'расчёт карты'} ${seconds(ms)}`,
      note: p.outcome === 'failed' ? 'не получилось' : p.outcome === 'cancelled' ? 'ушёл, не дождавшись' : undefined, slow: ms >= 15_000 };
  }
  if (type === 'onboarding_failed') return { at, kind: 'error', text: 'Знакомство сорвалось', note: p.error_kind ? String(p.error_kind) : undefined };
  if (type === 'onboarding_completed') return { at, kind: 'onboarding', text: 'Закончил первое знакомство' };
  if (/^onboarding_|^birth_field|^onboarding_video/.test(type)) return null;
  const label = ACTIONS[type];
  if (!label) return null;
  const kind: StoryStep['kind'] = /paywall|checkout|plan|purchase|premium|restore|subscription/.test(type) ? 'money'
    : /failed/.test(type) ? 'error' : 'action';
  return { at, kind, text: label.charAt(0).toUpperCase() + label.slice(1),
    note: [row.section && type !== 'screen_view' ? screenName(row.section) : null, p.plan_id ? planLabel(String(p.plan_id)) : null].filter(Boolean).join(' · ') || undefined };
}

function traceStep(row: Record<string, any>, includePrivate: boolean): StoryStep | null {
  const at = iso(row.at)!;
  const p = (row.payload || {}) as Record<string, any>;
  const type = String(row.event_type);
  const where = screenName(row.screen);
  if (type === 'screen_view') return { at, kind: 'screen', text: `Открыл «${where}»` };
  if (type === 'screen_exit' && Number(p.visible_ms) >= 2000) return { at, kind: 'screen', text: `Провёл на «${where}» ${seconds(Number(p.visible_ms))}` };
  if (type === 'section_view') return { at, kind: 'screen', text: `Вкладка «${traceNote({ detail: p.detail }, seconds) || 'без названия'}»`, note: where };
  if (type === 'ui_click') return { at, kind: 'action', text: `Нажал «${String(p.label || 'кнопку').slice(0, 60)}»`, note: where };
  if (type === 'question_submit') return { at, kind: 'action', text: 'Задал вопрос в «Спросить»', note: includePrivate && p.text ? `«${String(p.text).slice(0, 140)}»` : undefined };
  if (type === 'request_finished') {
    const ms = Number(p.duration_ms || 0);
    const failed = p.outcome && p.outcome !== 'success';
    if (ms < 1500 && !failed) return null;
    return { at, kind: failed ? 'error' : 'wait', text: `${failed ? 'Не загрузилось' : 'Ждал загрузку'}: ${operationLabel(String(p.operation || ''))}`,
      note: `${seconds(ms)}${p.status ? ` · код ${p.status}` : ''}`, slow: ms >= 5000 };
  }
  if (type === 'client_error') return { at, kind: 'error', text: 'Ошибка в приложении', note: where };
  if (type === 'media_action' && ['play', 'ended'].includes(String(p.state))) {
    return { at, kind: 'action', text: p.state === 'play' ? 'Включил аудио или видео' : 'Дослушал или досмотрел', note: where };
  }
  if (type === 'visibility' && p.state === 'hidden') return { at, kind: 'system', text: 'Свернул приложение' };
  if (type === 'product_event' && p.event_name) return null;
  if (type === 'content_view' || type === 'control_view' || type === 'feed_position' || type === 'scroll_depth'
    || type === 'screen_progress' || type === 'section_exit' || type === 'request_started' || type === 'field_focus'
    || type === 'field_changed' || type === 'visit_started' || type === 'identity_ready' || type === 'question_draft'
    || type === 'question_result' || type === 'visibility' || type === 'media_action' || type === 'screen_exit' || type === 'product_event') return null;
  return { at, kind: 'action', text: TRACE_LABELS[type as keyof typeof TRACE_LABELS] || type, note: where };
}

async function tableExists(db: Queryable, name: string): Promise<boolean> {
  return (await db.query('SELECT to_regclass($1) IS NOT NULL AS ok', [name])).rows[0]?.ok === true;
}

/** Everything about one person, newest visits first. */
/** `includePrivate`: the birth city and the text of questions, only for roles allowed to see personal data. */
export async function getPersonStory(id: string, options: { days?: number; includePrivate?: boolean } = {}, db: Queryable = getPool()) {
  const days = Math.max(1, Math.min(180, Math.trunc(Number(options.days) || 30)));
  const includePrivate = options.includePrivate === true;
  if (!/^-?\d{1,20}$/.test(id)) return null;
  const person = (await db.query(`SELECT ${PERSON_FIELDS}, u.language, u.birth_place FROM users u ${PERSON_SOURCE_JOINS} WHERE u.id = $1`, [id])).rows[0];
  if (!person) return null;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const hasTrace = await tableExists(db, 'product_trace_events');
  const [identities, events, trace, outbox, charts, jobs, tickets] = await Promise.all([
    db.query(`SELECT provider, created_at FROM account_identities WHERE user_id = $1 ORDER BY created_at`, [id]),
    db.query(`SELECT event_type, section, payload_json AS payload, occurred_at AT TIME ZONE 'UTC' AS at FROM user_app_events
              WHERE user_id = $1 AND event_type <> 'activity_heartbeat' AND occurred_at >= $2::timestamptz AT TIME ZONE 'UTC'
              ORDER BY occurred_at DESC LIMIT 1500`, [id, since]),
    hasTrace
      ? db.query(`SELECT e.event_type, e.screen, e.payload_json AS payload, e.occurred_at AS at, v.metadata
                  FROM product_trace_events e JOIN product_trace_visits v ON v.id = e.visit_id
                  WHERE v.user_id = $1 AND e.occurred_at >= $2::timestamptz
                    AND e.event_type NOT IN ('content_view', 'control_view', 'screen_progress', 'scroll_depth', 'feed_position', 'request_started', 'section_exit')
                  ORDER BY e.occurred_at DESC, e.sequence DESC LIMIT 3000`, [id, since])
      : Promise.resolve({ rows: [] as any[] }),
    db.query(`SELECT event_type, payload_json AS payload, occurred_at AS at FROM nebo_ops_outbox
              WHERE user_id = $1 AND event_type IN ('login', 'payment_confirmed', 'trial_started', 'subscription_grace', 'subscription_cancelled',
                'subscription_expired', 'subscription_resumed', 'payment_refunded', 'support_ticket', 'ai_error', 'technical_error')
              ORDER BY occurred_at DESC LIMIT 300`, [id]),
    db.query(`SELECT created_at AT TIME ZONE 'UTC' AS at, is_primary, subject_type FROM natal_charts WHERE user_id = $1 ORDER BY created_at`, [id]),
    (await tableExists(db, 'natal_reading_jobs'))
      ? db.query(`SELECT status, created_at, updated_at FROM natal_reading_jobs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`, [id])
      : Promise.resolve({ rows: [] as any[] }),
    db.query(`SELECT id, subject, status, created_at AT TIME ZONE 'UTC' AS at FROM support_tickets WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`, [id]),
  ]);

  const steps: StoryStep[] = [];
  const traced = trace.rows.length > 0;
  for (const row of events.rows) {
    // The detailed trace already has every screen; the older log adds actions, money and onboarding.
    if (traced && row.event_type === 'screen_view') continue;
    const step = appEventStep(row);
    if (step) steps.push(step);
  }
  for (const row of trace.rows) {
    const step = traceStep(row, includePrivate);
    if (step) steps.push(step);
  }
  const money: Array<{ at: string; text: string }> = [];
  for (const row of outbox.rows) {
    const at = iso(row.at)!;
    const p = (row.payload || {}) as Record<string, any>;
    if (row.event_type === 'login') {
      steps.push({ at, kind: 'system', text: p.isFirstLogin ? 'Первый вход' : 'Вошёл в аккаунт',
        note: [PROVIDER_LABELS[String(p.provider || '')], deviceText(p), p.appVersion ? `NEBO ${p.appVersion}` : null,
          CHANNEL_LABELS[String(p.distributionChannel || '')]].filter(Boolean).join(' · ') || undefined });
      continue;
    }
    const titles: Record<string, string> = {
      payment_confirmed: 'Оплатил Premium', trial_started: 'Начал пробный период', subscription_grace: 'Продление ждёт оплаты',
      subscription_cancelled: 'Отключил автопродление', subscription_expired: 'Premium закончился', subscription_resumed: 'Подписка восстановлена',
      payment_refunded: 'Возврат денег', support_ticket: 'Написал в поддержку', ai_error: 'Не получился текст от ИИ', technical_error: 'Ошибка на сервере',
    };
    const product = String(p.productId || '');
    const note = [product ? planLabel(product) : null, row.event_type === 'payment_confirmed' && product ? `${planPriceRub(product)} ₽` : null,
      p.sandbox === true ? 'тестовая оплата' : null, p.errorCode ? String(p.errorCode) : null].filter(Boolean).join(' · ') || undefined;
    const kind: StoryStep['kind'] = row.event_type.endsWith('error') ? 'error' : row.event_type === 'support_ticket' ? 'action' : 'money';
    steps.push({ at, kind, text: titles[row.event_type] || row.event_type, note });
    if (kind === 'money') money.push({ at, text: `${titles[row.event_type]}${note ? ` · ${note}` : ''}` });
  }
  for (const row of charts.rows) steps.push({ at: iso(row.at)!, kind: 'reading', text: row.is_primary ? 'Посчитана своя натальная карта' : 'Добавил карту другого человека' });
  for (const row of jobs.rows) {
    const ms = new Date(row.updated_at).getTime() - new Date(row.created_at).getTime();
    if (row.status === 'ready') steps.push({ at: iso(row.updated_at)!, kind: 'wait', text: `Подробный разбор карты готов через ${seconds(ms)}`, slow: ms >= 120_000 });
    else if (row.status === 'failed') steps.push({ at: iso(row.updated_at)!, kind: 'error', text: 'Подробный разбор карты не получился' });
  }

  steps.sort((a, b) => a.at.localeCompare(b.at));
  const visits: StoryVisit[] = [];
  for (const step of steps.filter((item) => item.at >= since)) {
    const last = visits[visits.length - 1];
    if (!last || new Date(step.at).getTime() - new Date(last.end).getTime() > 30 * 60_000) {
      visits.push({ start: step.at, end: step.at, seconds: 0, device: null, steps: [step] });
    } else {
      last.end = step.at;
      if (last.steps.length < 400) last.steps.push(step);
    }
  }
  for (const visit of visits) visit.seconds = Math.round((new Date(visit.end).getTime() - new Date(visit.start).getTime()) / 1000);

  const row = toRow(person);
  return {
    person: { ...row, language: person.language || null, city: includePrivate ? person.birth_place || null : null,
      signInMethods: [...new Set(identities.rows.map((item) => PROVIDER_LABELS[String(item.provider)] || String(item.provider)))],
      charts: charts.rows.length, supportTickets: tickets.rows.map((t) => ({ id: String(t.id), subject: t.subject, status: t.status, at: iso(t.at) })) },
    money: money.reverse(),
    visits: visits.reverse().slice(0, 40),
    days,
  };
}
