import { JOURNEY_VERSION, ONBOARDING_STEPS, STEP_LABELS, ACTION_LABELS } from '../journeyTelemetry';
import { getPool } from '../db';
import type { AdminActivityRange } from './activityTypes';
import { eventLabel } from './eventTaxonomy';

export type JourneyEvent = { id: string; userId: string; name: string | null; at: string; type: string;
  section: string | null; payload: Record<string, unknown> };
export type JourneyAttempt = { id: string; userId: string; name: string | null; version: string;
  startedAt: string; lastAt: string; lastStep: string; status: 'created' | 'without_chart' | 'sign_in' | 'pending' | 'no_continuation';
  lastField: string | null; ready: boolean; events: JourneyEvent[] };
export type JourneyReport = {
  generatedAt: string; range: AdminActivityRange; truncated: boolean; versions: string[];
  summary: { attempts: number; users: number; created: number; withoutChart: number; signIn: number; pending: number;
    noContinuation: number; errors: number; medianWaitMs: number | null; p90WaitMs: number | null; eligibleD1: number; returnedD1: number };
  funnel: Array<{ label: string; count: number; percent: number | null }>;
  steps: Array<{ key: string; label: string; views: number; medianVisibleMs: number | null;
    unresolved: number; actions: Array<{ label: string; count: number }> }>;
  waits: Array<{ phase: string; label: string; samples: number; failed: number; unfinished:number; lastMeasuredMs:number | null; medianMs: number | null; p90Ms: number | null }>;
  attempts: Array<Omit<JourneyAttempt, 'events'> & { reached: number }>;
  insights: Array<{ title: string; evidence: string; recommendation: string; level: 'info' | 'attention' }>;
};
export const percentile = (values: number[], p: number): number | null => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)] : null;
};
const at = (e: JourneyEvent) => Date.parse(e.at);
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : 0;
const MILESTONES = ['onboarding_started', 'birth_data_started', 'birth_data_completed', 'onboarding_result_ready', 'onboarding_completed'];
export function reachedJourneyMilestones(events: JourneyEvent[]): number {
  let cursor = -1;
  for (let i = 0; i < MILESTONES.length; i++) {
    const next = events.findIndex((event, index) => index > cursor && event.type === MILESTONES[i]
      && (i !== 4 || event.payload.outcome === 'created'));
    if (next < 0) return i;
    cursor = next;
  }
  return MILESTONES.length;
}

export function assembleAttempts(events: JourneyEvent[], now: number): JourneyAttempt[] {
  const grouped = new Map<string, JourneyEvent[]>();
  for (const e of events) {
    if (e.payload.journey_version !== JOURNEY_VERSION || typeof e.payload.attempt_id !== 'string') continue;
    const key = `${e.userId}:${e.payload.attempt_id}`;
    grouped.set(key, [...(grouped.get(key) || []), e]);
  }
  return [...grouped.values()].flatMap(rows => {
    rows.sort((a, b) => number(a.payload.sequence) - number(b.payload.sequence) || at(a) - at(b));
    const start = rows.find(e => e.type === 'onboarding_started');
    if (!start) return []; // Do not invent a funnel denominator from legacy/partial data.
    const end = rows.findLast(e => e.type === 'onboarding_completed');
    const last = rows[rows.length - 1];
    const outcome = end?.payload.outcome;
    const status: JourneyAttempt['status'] = outcome === 'created' || outcome === 'without_chart' || outcome === 'sign_in' ? outcome
      : now - at(last) < 30 * 60_000 ? 'pending' : 'no_continuation';
    const field = rows.findLast(e => e.type === 'birth_field_interaction');
    return [{ id: String(start.payload.attempt_id), userId: start.userId, name: start.name,
      version: String(start.payload.app_version || 'unknown'), startedAt: start.at, lastAt: last.at,
      lastStep: String(last.payload.step || 'hello'), status, lastField: typeof field?.payload.field === 'string' ? field.payload.field : null,
      ready: rows.some(e => e.type === 'onboarding_result_ready'), events: rows }];
  }).sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}

export function buildJourneyReport(events: JourneyEvent[], range: AdminActivityRange, now = Date.now(), truncated = false): JourneyReport {
  const attempts = assembleAttempts(events, now);
  const has = (a: JourneyAttempt, type: string) => a.events.some(e => e.type === type);
  const labels = ['Начали знакомство', 'Открыли ввод данных', 'Отправили данные без ошибок', 'Получили готовый разбор', 'Открыли результат'];
  const progress = new Map(attempts.map(a => [a, reachedJourneyMilestones(a.events)]));
  const funnel = MILESTONES.map((_, index) => {
    const count = attempts.filter(a => progress.get(a)! > index).length;
    return { label: labels[index], count, percent: attempts.length ? Math.round(count / attempts.length * 100) : null };
  });
  const steps = ONBOARDING_STEPS.map(key => {
    const rows = attempts.flatMap(a => a.events.filter(e => e.payload.step === key));
    const durations = new Map<string, number>();
    for (const e of rows) if (['onboarding_step_exit', 'onboarding_step_progress'].includes(e.type)) {
      const id = `${e.userId}:${e.payload.view_id}`;
      durations.set(id, Math.max(durations.get(id) || 0, number(e.payload.visible_ms)));
    }
    return { key, label: STEP_LABELS[key], views: rows.filter(e => e.type === 'onboarding_step_view').length,
      medianVisibleMs: percentile([...durations.values()], .5),
      unresolved: attempts.filter(a => a.status === 'no_continuation' && a.lastStep === key).length,
      actions: Object.keys(ACTION_LABELS).flatMap(action => {
        const count = rows.filter(e => e.type === 'onboarding_action' && e.payload.action === action).length;
        return count ? [{ label: ACTION_LABELS[action], count }] : [];
      }) };
  });
  const waits = ['chart', 'reading'].map(phase => {
    const rows = attempts.flatMap(a => a.events.filter(e => e.type === 'onboarding_wait_finished' && e.payload.phase === phase));
    const completed = rows.filter(e => e.payload.outcome === 'ready').map(e => number(e.payload.elapsed_ms));
    const unfinished=attempts.flatMap(a=>a.events.filter(e=>e.type==='onboarding_wait_started' && e.payload.phase===phase
      && !a.events.some(end=>end.type==='onboarding_wait_finished' && end.payload.wait_id===e.payload.wait_id)).map(start=>
      Math.max(0,...a.events.filter(e=>e.type==='onboarding_wait_progress' && e.payload.wait_id===start.payload.wait_id).map(e=>number(e.payload.elapsed_ms)))));
    return { phase, label: phase === 'chart' ? 'Сохранение данных и расчёт карты' : 'Подготовка разбора', samples: completed.length,
      failed: rows.filter(e => e.payload.outcome === 'failed').length,unfinished:unfinished.length,lastMeasuredMs:percentile(unfinished,.5), medianMs: percentile(completed, .5), p90Ms: percentile(completed, .9) };
  });
  const totalWaits = attempts.filter(a => a.ready).flatMap(a => {
    const ready = a.events.findLast(e => e.type === 'onboarding_result_ready')!;
    const started = a.events.find(e => e.type === 'birth_data_completed' && number(e.payload.sequence) < number(ready.payload.sequence));
    if (!started) return [];
    return [Math.max(0,at(ready)-at(started))];
  });
  const errors = attempts.filter(a => has(a, 'onboarding_failed') || has(a, 'birth_validation_error')).length;
  const eligible = [...new Set(attempts.filter(a => now - Date.parse(a.startedAt) >= 2 * 86_400_000).map(a => a.userId))];
  const returned = eligible.filter(id => {
    const first = Math.min(...attempts.filter(a => a.userId === id).map(a => Date.parse(a.startedAt)));
    return events.some(e => e.userId === id && ['screen_view', 'activity_heartbeat'].includes(e.type)
      && at(e) >= first + 86_400_000 && at(e) < first + 2 * 86_400_000);
  });
  const insights: JourneyReport['insights'] = [];
  if (attempts.length < 30) insights.push({ title: 'Пока мало наблюдений', evidence: `${attempts.length} попыток с новым сбором.`,
    recommendation: 'Собери данные за неделю. Пока просмотри истории отдельных людей: где не смогли заполнить форму или дождаться результата. Общие проценты сейчас могут сильно меняться.', level: 'info' });
  const worst = [...steps].sort((a, b) => b.unresolved - a.unresolved)[0];
  if (worst?.unresolved) insights.push({ title: `Проверить: ${worst.label}`, evidence: `${worst.unresolved} попыток не продолжились после этого окна более 30 минут.`,
    recommendation: 'Открой истории людей ниже. Посмотри, что было перед остановкой: ошибка, пропуск или сворачивание приложения. Человек мог вернуться позже, поэтому остановка ещё не означает, что он отказался.', level: 'attention' });
  if (errors) insights.push({ title: 'Есть ошибки в первом входе', evidence: `${errors} попыток с ошибками ввода или подготовки.`,
    recommendation: 'Посмотри, где именно возникла ошибка: при вводе данных или при подготовке разбора. В истории человека проверь, удалось ли ему повторить действие и продолжить.', level: 'attention' });
  if (totalWaits.length) insights.push({ title: 'Сколько проходит до готового разбора', evidence: `После отправки данных разбор обычно готов через ${Math.round((percentile(totalWaits, .5) || 0) / 1000)} с. В медленных случаях — через ${Math.round((percentile(totalWaits, .9) || 0) / 1000)} с. Измерено готовых разборов: ${totalWaits.length}.`,
    recommendation: 'Посмотри, какой этап занимает больше времени: расчёт карты или подготовка текста. Общее время включает повторные попытки и сворачивание приложения. Тех, кто пока не получил результат, смотри отдельно.', level: 'info' });
  return { generatedAt: new Date(now).toISOString(), range, truncated,
    versions: [...new Set(attempts.map(a => a.version))].sort(),
    summary: { attempts: attempts.length, users: new Set(attempts.map(a => a.userId)).size,
      created: attempts.filter(a => a.status === 'created').length, withoutChart: attempts.filter(a => a.status === 'without_chart').length,
      signIn: attempts.filter(a => a.status === 'sign_in').length,
      pending: attempts.filter(a => a.status === 'pending').length, noContinuation: attempts.filter(a => a.status === 'no_continuation').length,
      errors, medianWaitMs: percentile(totalWaits, .5), p90WaitMs: percentile(totalWaits, .9), eligibleD1: eligible.length, returnedD1: returned.length },
    funnel, steps, waits, insights, attempts: attempts.map(a => { const { events: _, ...summary } = a; return { ...summary, reached: progress.get(a)! }; }) };
}

export async function loadJourneyEvents(range: AdminActivityRange, userId?: string, version?: string): Promise<{ events: JourneyEvent[]; truncated: boolean }> {
  const result = await getPool().query(`WITH bounds AS (SELECT
    ($1::date::timestamp AT TIME ZONE $3 AT TIME ZONE 'UTC') start_at,
    (($2::date+1)::timestamp AT TIME ZONE $3 AT TIME ZONE 'UTC') end_at), cohort AS (
    SELECT DISTINCT user_id, payload_json->>'attempt_id' attempt_id FROM user_app_events, bounds
    WHERE event_type='onboarding_started' AND occurred_at>=start_at AND occurred_at<end_at
      AND payload_json->>'journey_version'=$4 AND ($5::text IS NULL OR user_id::text=$5)
      AND ($6::text IS NULL OR COALESCE(payload_json->>'app_version','unknown')=$6))
    SELECT e.id::text,e.user_id::text,u.name,e.event_type,e.section,e.payload_json,
      e.occurred_at AT TIME ZONE 'UTC' received_at FROM user_app_events e
    JOIN users u ON u.id=e.user_id CROSS JOIN bounds b
    WHERE ($5::text IS NULL OR e.user_id::text=$5)
      AND e.occurred_at>=b.start_at AND e.occurred_at<LEAST(b.end_at+INTERVAL '2 days',NOW() AT TIME ZONE 'UTC')
      AND (EXISTS(SELECT 1 FROM cohort c WHERE c.user_id=e.user_id AND c.attempt_id=e.payload_json->>'attempt_id')
        OR (e.event_type IN ('screen_view','screen_exit','ui_action','activity_heartbeat') AND ($5::text IS NOT NULL OR EXISTS(SELECT 1 FROM cohort c WHERE c.user_id=e.user_id))))
    ORDER BY e.occurred_at,e.id LIMIT 50001`, [range.from, range.to, range.timezone, JOURNEY_VERSION, userId || null, version || null]);
  return { truncated: result.rows.length > 50000, events: result.rows.slice(0, 50000).map(row => {
    const payload = row.payload_json || {};
    const received = new Date(row.received_at).getTime();
    const client = number(payload.client_at_ms);
    const time = client && client <= received + 120_000 && client >= received - 7 * 86_400_000 ? Math.min(client, received) : received;
    return { id: row.id, userId: row.user_id, name: row.name, at: new Date(time).toISOString(), type: row.event_type, section: row.section, payload };
  }) };
}

export function journeyEventLabel(e: JourneyEvent): string {
  const labels: Record<string, string> = { onboarding_step_view: 'Открыл окно', onboarding_step_progress: 'Последнее измерение',
    onboarding_step_exit: 'Закончил просмотр окна', onboarding_action: ACTION_LABELS[String(e.payload.action)] || 'Действие',
    birth_field_interaction: 'Заполнение поля', birth_validation_error: 'Ошибка в поле', onboarding_wait_started: 'Началось ожидание',
    onboarding_wait_finished: 'Ожидание завершилось', onboarding_wait_progress: 'Ожидание продолжается',
    onboarding_result_ready: 'Разбор готов', onboarding_failed: 'Ошибка подготовки', onboarding_video: 'Состояние видео', screen_exit: 'Вышел из раздела',
    onboarding_started: 'Начал первое знакомство', onboarding_completed: 'Закончил первое знакомство' };
  return labels[e.type] || eventLabel(e.type);
}
