import { formatInTimeZone } from 'date-fns-tz';
import { getPool } from './db';
import { neboServerLabel, sendNeboOpsPhoto, sendNeboOpsText } from './neboOps';
import { neboChartUrl } from './neboOpsChart';
import { getNeboOpsPreferences } from './neboOpsSettings';
import {
  collectNeboCoreStats,
  collectNeboStats,
  neboReportPeriod,
  previousPeriod,
  renderNeboReport,
  type NeboReportKind,
} from './neboOpsStats';

export type { NeboReportKind } from './neboOpsStats';

const CHART_DAYS: Partial<Record<NeboReportKind, number>> = { week: 14, month: 30 };

export async function buildNeboOpsBusinessReport(kind: NeboReportKind, now = new Date()): Promise<string> {
  const period = neboReportPeriod(kind, now);
  const before = previousPeriod(period);
  const [stats, previous] = await Promise.all([
    collectNeboStats(period.start, period.end),
    collectNeboCoreStats(getPool(), before.start, before.end),
  ]);
  return renderNeboReport(period, stats, previous, neboServerLabel());
}

/** Text first, then (for longer periods) a chart; the chart never blocks the numbers. */
export async function sendNeboOpsBusinessReport(kind: NeboReportKind, now = new Date()): Promise<boolean> {
  const message = await buildNeboOpsBusinessReport(kind, now);
  const sent = await sendNeboOpsText(message);
  const days = CHART_DAYS[kind];
  const chart = days ? neboChartUrl(days, now) : null;
  if (sent.ok && chart) {
    await sendNeboOpsPhoto(chart, `📈 Последние ${days} дней: заходили, новые и покупки по дням`).catch(() => undefined);
  }
  return sent.ok;
}

function scheduleKey(kind: 'daily' | 'weekly', now: Date): string {
  return kind === 'daily'
    ? formatInTimeZone(now, 'Europe/Moscow', 'yyyy-MM-dd')
    : formatInTimeZone(now, 'Europe/Moscow', "RRRR-'W'II");
}

/** One scheduled daily and one weekly report; the claim survives restarts and parallel workers. */
export async function maybeSendScheduledNeboOpsReports(now = new Date()): Promise<void> {
  const prefs = await getNeboOpsPreferences();
  const hour = Number(formatInTimeZone(now, 'Europe/Moscow', 'H'));
  const weekday = Number(formatInTimeZone(now, 'Europe/Moscow', 'i')) % 7;
  const pool = getPool();
  for (const kind of ['daily', 'weekly'] as const) {
    const scheduled = kind === 'daily'
      ? prefs.daily_report_hour === hour
      : prefs.weekly_report_hour === hour && prefs.weekly_report_weekday === weekday;
    const field = kind === 'daily' ? 'last_daily_report_key' : 'last_weekly_report_key';
    const key = scheduleKey(kind, now);
    if (!scheduled || prefs[field] === key) continue;
    const claim = await pool.query(`UPDATE nebo_ops_preferences SET ${field}=$1, updated_at=NOW()
      WHERE id=1 AND ${field} IS DISTINCT FROM $1 RETURNING id`, [key]);
    if (!claim.rowCount) continue;
    if (!(await sendNeboOpsBusinessReport(kind === 'daily' ? 'today' : 'week', now))) {
      await pool.query(`UPDATE nebo_ops_preferences SET ${field}=NULL WHERE id=1 AND ${field}=$1`, [key]);
    }
  }
}
