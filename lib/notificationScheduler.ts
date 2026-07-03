/**
 * In-process notification scheduler.
 *
 * Railway runs a single always-on Next server (`node server.js`), but nothing was triggering
 * the secured `/api/cron/*` endpoints — so notifications were generated/queued but never sent.
 * This starts an in-process scheduler (from instrumentation.ts) that calls the same service
 * functions the cron endpoints use: dispatch frequently, planners at fixed Moscow times.
 *
 * Single-instance assumption: dedup is in-memory (once-per-day per job) + the notification
 * engine's own delivery idempotency. If you scale to >1 replica, either keep replicas at 1 or
 * move to an external cron hitting the endpoints with CRON_SECRET.
 */
import {
  dispatchScheduledNotifications,
  planRetentionNotifications,
  generateDailyCards,
} from '../services/notificationRetentionService';

const MSK_TZ = 'Europe/Moscow';
const DISPATCH_INTERVAL_MS = 3 * 60 * 1000; // отправка очереди каждые 3 минуты
const PLANNER_LIMIT = 500;

type MskNow = { hour: number; minute: number; weekday: number; dateKey: string };

function mskNow(date = new Date()): MskNow {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: MSK_TZ,
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
    weekday: weekdayMap[get('weekday')] ?? 0,
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
  };
}

const lastRun = new Map<string, string>(); // jobKey -> dateKey (или slotKey)

// Живой статус планировщика — отдаётся в админку (diagnostics), чтобы видеть, что
// in-process крон реально работает и когда последний раз флашил очередь.
type SchedulerStatus = {
  started: boolean;
  startedAt: string | null;
  lastDispatchAt: string | null;
  lastDispatchOk: boolean | null;
  lastDispatchSent: number;
  lastDispatchFailed: number;
  lastPlannerJob: string | null;
  lastPlannerAt: string | null;
  dispatchIntervalMs: number;
};

const status: SchedulerStatus = {
  started: false,
  startedAt: null,
  lastDispatchAt: null,
  lastDispatchOk: null,
  lastDispatchSent: 0,
  lastDispatchFailed: 0,
  lastPlannerJob: null,
  lastPlannerAt: null,
  dispatchIntervalMs: DISPATCH_INTERVAL_MS,
};

export function getSchedulerStatus(): SchedulerStatus {
  return { ...status };
}

async function runOnce(job: string, slotKey: string, fn: () => Promise<unknown>) {
  if (lastRun.get(job) === slotKey) return;
  lastRun.set(job, slotKey);
  try {
    await fn();
    status.lastPlannerJob = job;
    status.lastPlannerAt = new Date().toISOString();
    console.log(`[cron] ${job} done`);
  } catch (error) {
    console.warn(`[cron] ${job} failed:`, error instanceof Error ? error.message : error);
  }
}

let dispatching = false;
async function dispatchTick() {
  if (dispatching) return;
  dispatching = true;
  try {
    const result = await dispatchScheduledNotifications(new Date(), 100);
    status.lastDispatchAt = new Date().toISOString();
    status.lastDispatchOk = !!result?.ok;
    status.lastDispatchSent = Number(result?.successCount || 0);
    status.lastDispatchFailed = Number(result?.failureCount || 0);
  } catch (error) {
    status.lastDispatchAt = new Date().toISOString();
    status.lastDispatchOk = false;
    console.warn('[cron] dispatch failed:', error instanceof Error ? error.message : error);
  } finally {
    dispatching = false;
  }
}

function plannerTick() {
  const { hour, minute, dateKey } = mskNow();
  const due = (h: number, m: number) => hour > h || (hour === h && minute >= m);

  // «Карта дня» — контент на день, генерим раз в сутки утром по Москве (для пуша есть фолбэк).
  if (due(6, 30)) void runOnce('daily-card-generator', dateKey, () => generateDailyCards(new Date(), { limit: 250 }));

  // ЕДИНЫЙ «катящийся» планировщик — каждые 30 минут, КРУГЛОСУТОЧНО. Предлагает весь дневной набор,
  // а КОГДА и ЧТО придёт конкретному юзеру решают ЛОКАЛЬНЫЕ окна (candidateAllowed): утро 8–12 —
  // личный дневной гороскоп; день/вечер 12–21 — интересы/совместимость/премиум. Плюс тихие часы
  // (22–08 локально), лимит 2/день и разрыв 7ч. Так пуши приходят в правильное ЛОКАЛЬНОЕ время в
  // любой таймзоне, а не всем разом по Москве. Раньше были разрозненные планировщики по фикс-времени
  // МСК → восточные таймзоны не попадали в свои утренние окна и не получали утренний гороскоп.
  if (minute % 30 === 0) {
    const slot = `${dateKey}-${hour}-${Math.floor(minute / 30)}`;
    void runOnce('rolling-daily', slot, () => planRetentionNotifications('rolling-daily', new Date(), { limit: PLANNER_LIMIT }));
  }
}

let started = false;

export function startNotificationScheduler() {
  if (started) return;
  started = true;
  status.started = true;
  status.startedAt = new Date().toISOString();

  // Немедленный catch-up после старта: наполняем очередь (планировщики) и флашим её, чтобы
  // деплой/перезапуск сразу приводил к отправке, не дожидаясь точного часа по Москве.
  setTimeout(() => void dispatchTick(), 15 * 1000);      // флашим то, что уже в очереди
  setTimeout(() => { plannerTick(); }, 25 * 1000);       // наполняем очередь за сегодня (catch-up)
  setTimeout(() => void dispatchTick(), 50 * 1000);      // отправляем только что наполненное

  setInterval(() => void dispatchTick(), DISPATCH_INTERVAL_MS);
  setInterval(() => plannerTick(), 60 * 1000);

  console.log('[cron] in-process notification scheduler started (rolling planner every 30m, timezone-aware; dispatch every 3m)');
}

/**
 * Разрешён ли планировщик в текущем окружении. НЕ привязываемся к NODE_ENV==='production':
 * хостинг (Railway) может переопределить NODE_ENV на staging/пусто → раньше планировщик молча не
 * стартовал и ВСЕ регулярные пуши пропадали (ручной self-test шлёт напрямую, поэтому баг был почти
 * невидим). Теперь запускаем ВЕЗДЕ в Node-рантайме, КРОМЕ: локального `next dev` (development),
 * тестов (jest) и явного аварийного выключателя DISABLE_INPROCESS_CRON=1.
 */
export function isSchedulerAllowedByEnv(): boolean {
  if (process.env.NEXT_RUNTIME === 'edge') return false;
  if (process.env.DISABLE_INPROCESS_CRON === '1') return false;
  if (process.env.NODE_ENV === 'development') return false;
  if (process.env.NODE_ENV === 'test') return false;
  return true;
}

/**
 * Идемпотентный «гарантированный старт» из ЛЮБОЙ горячей точки: instrumentation.register() на буте
 * И первый заход на /api/health (Railway дёргает healthcheck каждые ~30с). Так планировщик поднимется
 * даже если instrumentation по какой-то причине не выполнится в standalone-рантайме. Безопасно
 * вызывать многократно — реальный старт произойдёт один раз (флаг started).
 */
export function ensureNotificationScheduler(source = 'unknown'): void {
  if (started) return;
  if (!isSchedulerAllowedByEnv()) return;
  startNotificationScheduler();
  console.log(`[cron] scheduler ensured (source=${source}, NODE_ENV=${process.env.NODE_ENV || 'unset'})`);
  // Самоисцеление каталога сценариев/очереди — в фоне, не блокируя запуск таймеров.
  void (async () => {
    try {
      const { bootstrapNotificationDelivery } = await import('./migrations');
      await bootstrapNotificationDelivery();
    } catch (error) {
      console.warn('[cron] notification bootstrap failed:', error instanceof Error ? error.message : error);
    }
  })();
}
