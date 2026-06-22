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

async function runOnce(job: string, slotKey: string, fn: () => Promise<unknown>) {
  if (lastRun.get(job) === slotKey) return;
  lastRun.set(job, slotKey);
  try {
    await fn();
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
    await dispatchScheduledNotifications(new Date(), 100);
  } catch (error) {
    console.warn('[cron] dispatch failed:', error instanceof Error ? error.message : error);
  } finally {
    dispatching = false;
  }
}

function plannerTick() {
  const { hour, minute, dateKey } = mskNow();
  // окно 2 минуты, чтобы не пропустить из-за дрейфа таймера; once-per-day защищает от повтора
  const at = (h: number, m: number) => hour === h && minute >= m && minute < m + 2;

  if (at(6, 30)) void runOnce('daily-card-generator', dateKey, () => generateDailyCards(new Date(), { limit: 250 }));
  if (at(9, 0)) void runOnce('morning-retention-planner', dateKey, () => planRetentionNotifications('morning-retention-planner', new Date(), { limit: PLANNER_LIMIT }));
  if (at(13, 0)) void runOnce('midday-retention-planner', dateKey, () => planRetentionNotifications('midday-retention-planner', new Date(), { limit: PLANNER_LIMIT }));
  if (at(20, 0)) void runOnce('evening-retention-planner', dateKey, () => planRetentionNotifications('evening-retention-planner', new Date(), { limit: PLANNER_LIMIT }));
  if (at(11, 0)) void runOnce('inactive-user-reactivation', dateKey, () => planRetentionNotifications('inactive-user-reactivation', new Date(), { limit: PLANNER_LIMIT }));
  if (at(18, 0)) void runOnce('premium-conversion-planner', dateKey, () => planRetentionNotifications('premium-conversion-planner', new Date(), { limit: PLANNER_LIMIT }));
  if (at(21, 0)) void runOnce('unfinished-action-reminder', dateKey, () => planRetentionNotifications('unfinished-action-reminder', new Date(), { limit: PLANNER_LIMIT }));
  // Недельный гороскоп больше НЕ шлём отдельным пушем ("гороскоп на неделю готов" = пустой зазыватель).
  // Еженедельный контакт — воскресный итог (sunday_summary) через вечерний планировщик.

  // Кампании админа — каждые 15 минут (slotKey по 15-минутному слоту дня).
  if (minute % 15 === 0) {
    const slot = `${dateKey}-${hour}-${Math.floor(minute / 15)}`;
    void runOnce('admin-campaign-runner', slot, () => planRetentionNotifications('admin-campaign-runner', new Date(), { limit: PLANNER_LIMIT }));
  }
}

let started = false;

export function startNotificationScheduler() {
  if (started) return;
  started = true;

  // первичная отправка через 15с после старта — флашим очередь
  setTimeout(() => void dispatchTick(), 15 * 1000);
  setInterval(() => void dispatchTick(), DISPATCH_INTERVAL_MS);
  setInterval(() => plannerTick(), 60 * 1000);

  console.log('[cron] in-process notification scheduler started (dispatch every 3m, planners on Moscow schedule)');
}
