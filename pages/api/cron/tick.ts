import type { NextApiRequest, NextApiResponse } from 'next';
import {
  dispatchScheduledNotifications,
  planRetentionNotifications,
  generateDailyCards,
} from '../../../services/notificationRetentionService';
import {
  prewarmPersonalForecastsForActiveUsers,
} from '../../../lib/personalForecastPrewarm';
import { processPendingRuStoreEvents } from '../../../lib/rustorePayments';
import { prewarmUpcomingSignHoroscopes } from '../../../lib/horoscope/signPrewarm';

export const config = { maxDuration: 120 };

/**
 * Single entry point for an EXTERNAL cron (e.g. cron-job.org): hit this every few
 * minutes with `Authorization: Bearer <CRON_SECRET>` and it does everything —
 * flushes the send queue on every call and runs each planner once per day when its
 * Moscow-time slot arrives. So you configure ONE cron job, not nine.
 *
 * Safe to run alongside the in-process scheduler: dispatch is delivery-idempotent
 * and planners dedup per user (cooldown/maxPerDay). Set DISABLE_INPROCESS_CRON=1 on
 * the server if you want this external cron to be the only driver.
 */

const MSK_TZ = 'Europe/Moscow';
const PLANNER_LIMIT = 500;
const PERSONAL_FORECAST_LIMIT = 250;

function verifyCron(req: NextApiRequest): boolean {
  const secret = process.env.CRON_SECRET || '';
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return !!secret && token === secret;
}

function mskNow(date = new Date()) {
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

// In-memory once-per-slot guard (single instance). Re-runs are also safe because
// generation locks and cache keys deduplicate work across instances.
const lastRun = new Map<string, string>();
async function once(job: string, slotKey: string, fn: () => Promise<unknown>, ran: string[]) {
  if (lastRun.get(job) === slotKey) return;
  lastRun.set(job, slotKey);
  try {
    await fn();
    ran.push(job);
  } catch (error) {
    if (lastRun.get(job) === slotKey) lastRun.delete(job);
    console.warn(`[cron/tick] ${job} failed:`, error instanceof Error ? error.message : error);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  if (!verifyCron(req)) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  const now = new Date();
  const { hour, minute, dateKey } = mskNow(now);
  const ran: string[] = [];

  // 1) Always flush the send queue.
  let dispatched = false;
  try {
    await dispatchScheduledNotifications(now, 100);
    dispatched = true;
  } catch (error) {
    console.warn('[cron/tick] dispatch failed:', error instanceof Error ? error.message : error);
  }
  let rustorePayments = null;
  try {
    rustorePayments = await processPendingRuStoreEvents(20);
  } catch (error) {
    console.warn('[cron/tick] RuStore payment queue failed:', error instanceof Error ? error.message : error);
  }

  // 2) Prewarm the current personal periods. The resolver adds upcoming periods only
  // near their boundaries; cache keys and generation locks make repeated instances safe.
  await once(
    'personal-forecast-periods',
    dateKey,
    () => prewarmPersonalForecastsForActiveUsers(now, {
      limit: PERSONAL_FORECAST_LIMIT,
      activeDays: 7,
      concurrency: 2,
    }),
    ran
  );

  // Shared sign readings are generated once for all 12 signs and both current
  // languages. Evening Moscow runs prewarm tomorrow and, at boundaries, the
  // next week/month. A missed cron is covered by the same batch lock in APIs.
  if (hour >= 18) {
    await once(
      'sign-horoscope-periods',
      dateKey,
      () => prewarmUpcomingSignHoroscopes(now),
      ran,
    );
  }

  // 3) Daily card content — once per day (morning MSK). Fallback exists for the push itself.
  if (hour === 6 && minute >= 30) await once('daily-card-generator', dateKey, () => generateDailyCards(now, { limit: 250 }), ran);

  // 4) Single rolling planner — offers the whole daily set; per-user LOCAL windows
  //    (candidateAllowed) + quiet hours + 2/day + 7h gap decide what/when. Timezone-correct.
  //    Runs at most once per 30-minute slot regardless of external cron frequency.
  const slot = `${dateKey}-${hour}-${Math.floor(minute / 30)}`;
  await once('rolling-daily', slot, () => planRetentionNotifications('rolling-daily', now, { limit: PLANNER_LIMIT }), ran);

  return res.status(200).json({
    ok: true,
    msk: `${dateKey} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    dispatched,
    rustorePayments,
    planners: ran,
  });
}
