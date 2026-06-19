import type { NextApiRequest, NextApiResponse } from 'next';
import {
  dispatchScheduledNotifications,
  planRetentionNotifications,
  generateDailyCards,
} from '../../../services/notificationRetentionService';

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
// planners dedup per user, so this just trims redundant scans within the slot.
const lastRun = new Map<string, string>();
async function once(job: string, slotKey: string, fn: () => Promise<unknown>, ran: string[]) {
  if (lastRun.get(job) === slotKey) return;
  lastRun.set(job, slotKey);
  try {
    await fn();
    ran.push(job);
  } catch (error) {
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
  const { hour, minute, weekday, dateKey } = mskNow(now);
  const ran: string[] = [];

  // 1) Always flush the send queue.
  let dispatched = false;
  try {
    await dispatchScheduledNotifications(now, 100);
    dispatched = true;
  } catch (error) {
    console.warn('[cron/tick] dispatch failed:', error instanceof Error ? error.message : error);
  }

  // 2) Planners on the Moscow schedule. Gated by HOUR + a once-per-day guard, so the
  //    first tick inside the target hour runs it once — robust to cron interval/drift.
  if (hour === 6 && minute >= 30) await once('daily-card-generator', dateKey, () => generateDailyCards(now, { limit: 250 }), ran);
  if (hour === 9) await once('morning-retention-planner', dateKey, () => planRetentionNotifications('morning-retention-planner', now, { limit: PLANNER_LIMIT }), ran);
  if (hour === 13) await once('midday-retention-planner', dateKey, () => planRetentionNotifications('midday-retention-planner', now, { limit: PLANNER_LIMIT }), ran);
  if (hour === 20) await once('evening-retention-planner', dateKey, () => planRetentionNotifications('evening-retention-planner', now, { limit: PLANNER_LIMIT }), ran);
  if (hour === 11) await once('inactive-user-reactivation', dateKey, () => planRetentionNotifications('inactive-user-reactivation', now, { limit: PLANNER_LIMIT }), ran);
  if (hour === 18) await once('premium-conversion-planner', dateKey, () => planRetentionNotifications('premium-conversion-planner', now, { limit: PLANNER_LIMIT }), ran);
  if (hour === 21) await once('unfinished-action-reminder', dateKey, () => planRetentionNotifications('unfinished-action-reminder', now, { limit: PLANNER_LIMIT }), ran);
  if (weekday === 1 && hour === 10) await once('weekly-summary-generator', dateKey, () => planRetentionNotifications('weekly-summary-generator', now, { limit: PLANNER_LIMIT }), ran);

  // Admin campaigns — every 15-minute slot.
  const slot = `${dateKey}-${hour}-${Math.floor(minute / 15)}`;
  await once('admin-campaign-runner', slot, () => planRetentionNotifications('admin-campaign-runner', now, { limit: PLANNER_LIMIT }), ran);

  return res.status(200).json({
    ok: true,
    msk: `${dateKey} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    dispatched,
    planners: ran,
  });
}
