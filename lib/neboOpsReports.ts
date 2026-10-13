import { formatInTimeZone } from 'date-fns-tz';
import { neboServerLabel, sendNeboOpsPhoto, sendNeboOpsText } from './neboOps';
import { neboChartUrl } from './neboOpsChart';
import { getNeboBotSettings, updateNeboBotSettings, type NeboBotSettings } from './neboOpsSettings';
import {
  collectAudience,
  collectMetrics,
  collectRetention,
  collectVersions,
  moscowDayStart,
  moscowDaysBack,
  moscowMonthStart,
  type Audience,
  type Count,
  type Metrics,
  type Period,
  type RetentionPoint,
  type VersionStats,
} from './productMetrics';
import { getRuStoreReviewsStatus } from './rustoreReviews';

/** Owner reports. Every number comes from lib/productMetrics, the same as in the admin. */

export type NeboReportKind = 'now' | 'today' | 'yesterday' | 'week' | 'month';
const TZ = 'Europe/Moscow';
const CHART_DAYS: Partial<Record<NeboReportKind, number>> = { week: 14, month: 30, now: 14, today: 14 };

const hm = (date: Date) => formatInTimeZone(date, TZ, 'HH:mm');
const dm = (date: Date) => formatInTimeZone(date, TZ, 'dd.MM');
const fmt = (value: number) => new Intl.NumberFormat('ru-RU').format(Math.round(value));
const rub = (value: number) => `${fmt(value)} ₽`;
const pct = (part: number, total: number) => (total > 0 ? `${Math.round((part * 100) / total)}%` : 'нет данных');

export function reportPeriod(kind: NeboReportKind, settings: Pick<NeboBotSettings, 'period' | 'lastReportAt'>, now = new Date()): Period & { label: string; previous: Period } {
  const today = moscowDayStart(now);
  const span = (start: Date, end: Date, label: string) => ({
    start, end, label, previous: { start: new Date(start.getTime() - (end.getTime() - start.getTime())), end: start },
  });
  if (kind === 'yesterday') {
    const start = moscowDaysBack(now, 1);
    return span(start, today, `вчера, ${dm(start)}, весь день`);
  }
  if (kind === 'week' || kind === 'month') {
    const days = kind === 'week' ? 7 : 30;
    const start = moscowDaysBack(now, days - 1);
    return span(start, now, `${days} дней, ${dm(start)}–${dm(now)}`);
  }
  const last = settings.lastReportAt ? new Date(settings.lastReportAt) : null;
  if (kind === 'now' && settings.period === 'since_last' && last && last < now && now.getTime() - last.getTime() <= 7 * 86_400_000) {
    const sameDay = dm(last) === dm(now);
    return span(last, now, `с прошлого отчёта: ${sameDay ? hm(last) : `${dm(last)} ${hm(last)}`}–${hm(now)}`);
  }
  // Today compares with yesterday up to the same minute.
  const yesterday = moscowDaysBack(now, 1);
  return { start: today, end: now, label: `сегодня, ${dm(today)}, 00:00–${hm(now)}`,
    previous: { start: yesterday, end: new Date(yesterday.getTime() + (now.getTime() - today.getTime())) } };
}

function delta(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? '' : ' (было 0)';
  const change = Math.round(((current - previous) * 100) / previous);
  return change === 0 ? ' (как раньше)' : ` (${change > 0 ? '+' : ''}${change}%)`;
}
const inline = (items: Count[], limit = 4) => items.slice(0, limit).map((i) => `${i.label} ${i.count}`).join(' · ');

export type ReportData = {
  period: { label: string };
  metrics: Metrics;
  previous: Metrics;
  audience?: Audience;
  retention?: RetentionPoint[];
  versions?: VersionStats;
  monthRevenueRub?: number;
  rating?: { average: number; total: number | null } | null;
};

/** Plain text, no empty sections: a line appears only when it is switched on and has something to say. */
export function renderNeboReport(data: ReportData, items: NeboBotSettings['report'], server: string): string {
  const m = data.metrics;
  const p = data.previous;
  const lines = [`📊 NEBO · ${data.period.label}`, `🖥 ${server}`, ''];
  lines.push(`👥 Заходили: ${m.active}${delta(m.active, p.active)} · новых ${m.firstLaunches}, вернулись ${m.returning}`);
  if (items.first_launches) lines.push(`📲 Первые запуски: ${m.firstLaunches}${delta(m.firstLaunches, p.firstLaunches)}${m.firstLaunches ? ` · из приложения ${m.firstLaunchesApp}` : ''}`);
  if (items.registrations) lines.push(`📝 Регистрации: ${m.registrations}${m.registrationsByProvider.length ? ` · ${inline(m.registrationsByProvider)}` : ''}`);
  if (items.payments) {
    lines.push(`💳 Покупки: ${m.payments}${delta(m.payments, p.payments)}${m.payments ? ` · первых ${m.firstPayments}, продлений ${m.renewals}` : ''}`);
    if (m.paymentsByPlan.length) lines.push(`   тарифы: ${inline(m.paymentsByPlan)}`);
    const extra = [m.trials ? `пробных ${m.trials}` : '', m.cancellations ? `отключили автопродление ${m.cancellations}` : '', m.refunds ? `возвратов ${m.refunds}` : ''].filter(Boolean);
    if (extra.length) lines.push(`   ${extra.join(', ')}`);
    if (m.stars.payments) lines.push(`   звёздами Telegram: ${m.stars.payments} на ${m.stars.amount} звёзд`);
  }
  if (items.revenue) lines.push(`💰 Выручка: ${rub(m.revenueRub)}${delta(m.revenueRub, p.revenueRub)}${data.monthRevenueRub !== undefined ? ` · за месяц ${rub(data.monthRevenueRub)}` : ''}`);
  if (items.audience && data.audience) lines.push(`📈 Аудитория: за день ${data.audience.dau} · за 7 дней ${data.audience.wau} · за 30 дней ${data.audience.mau}`);
  if (items.retention && data.retention?.some((r) => r.cohort > 0)) {
    lines.push(`🔁 Удержание: ${data.retention.filter((r) => r.cohort > 0).map((r) => `день ${r.day}: ${pct(r.returned, r.cohort)} (${r.returned} из ${r.cohort})`).join(' · ')}`);
  }
  if (items.activation && m.activation.cohort) lines.push(`⚡ Активация за 24 ч: ${pct(m.activation.activated, m.activation.cohort)} (${m.activation.activated} из ${m.activation.cohort} получили карту)`);
  if (items.premium) {
    lines.push(`🛒 Экран оплаты: открыли ${m.paywallViewers} → начали ${m.checkoutStarted} → оплатили ${m.buyers}${m.paywallViewers ? ` (${pct(m.buyers, m.paywallViewers)})` : ''}`);
    lines.push(`💎 Premium сейчас у ${m.premiumActive} из ${m.totalUsers}`);
  }
  if (items.sources && m.sources.length) lines.push(`📥 Откуда новые: ${inline(m.sources)}`);
  if (items.versions && data.versions?.latest) {
    lines.push(`📦 Версии: ${data.versions.latest} у ${data.versions.people - data.versions.outdated}${data.versions.outdated ? `, старые у ${data.versions.outdated}` : ', старых нет'}`);
  }
  if (data.rating) lines.push(`⭐ RuStore: ${data.rating.average.toFixed(1).replace('.', ',')} из 5${data.rating.total ? `, оценок ${data.rating.total}` : ''}`);
  lines.push('', `⚠️ Ошибок: ${m.errors} · ✉️ Обращений: ${m.supportTickets}`);
  lines.push('Цифры те же, что в админке. Время московское.');
  return lines.join('\n').slice(0, 3_800);
}

export async function buildNeboOpsBusinessReport(kind: NeboReportKind, now = new Date(), settingsInput?: NeboBotSettings): Promise<{ text: string; chartDays: number | null }> {
  const settings = settingsInput || await getNeboBotSettings();
  const period = reportPeriod(kind, settings, now);
  const items = settings.report;
  const monthStart = moscowMonthStart(now);
  const [metrics, previous, audience, retention, versions, month] = await Promise.all([
    collectMetrics(period),
    collectMetrics(period.previous),
    items.audience ? collectAudience(now) : Promise.resolve(undefined),
    items.retention && settings.retentionDays.length ? collectRetention(settings.retentionDays, now) : Promise.resolve(undefined),
    items.versions ? collectVersions(now) : Promise.resolve(undefined),
    items.revenue && kind !== 'month' ? collectMetrics({ start: monthStart, end: now }) : Promise.resolve(undefined),
  ]);
  const reviews = getRuStoreReviewsStatus();
  const text = renderNeboReport({
    period, metrics, previous, audience, retention, versions,
    monthRevenueRub: month?.revenueRub,
    rating: reviews.rating != null ? { average: reviews.rating, total: reviews.reviews } : null,
  }, items, neboServerLabel());
  const chartDays = items.chart ? CHART_DAYS[kind] ?? null : (kind === 'week' || kind === 'month' ? CHART_DAYS[kind]! : null);
  return { text, chartDays };
}

/** Text first, then the chart; the chart never blocks the numbers. */
export async function sendNeboOpsBusinessReport(kind: NeboReportKind, now = new Date(), settings?: NeboBotSettings): Promise<boolean> {
  const report = await buildNeboOpsBusinessReport(kind, now, settings);
  const sent = await sendNeboOpsText(report.text);
  const chart = report.chartDays ? neboChartUrl(report.chartDays, now) : null;
  if (sent.ok && chart) {
    await sendNeboOpsPhoto(chart, `📈 Последние ${report.chartDays} дней: сколько заходило, сколько новых и оплаты по дням`).catch(() => undefined);
  }
  return sent.ok;
}

/** Scheduled reports at the chosen hours plus the Sunday week; each slot is claimed once in the database. */
export async function maybeSendScheduledNeboOpsReports(now = new Date()): Promise<void> {
  const current = await getNeboBotSettings();
  if (current.paused) return;
  const hour = Number(formatInTimeZone(now, TZ, 'H'));
  const day = formatInTimeZone(now, TZ, 'yyyy-MM-dd');
  const weekday = Number(formatInTimeZone(now, TZ, 'i')) % 7;
  const slots: Array<{ key: string; kind: NeboReportKind }> = [];
  if (current.reportHours.includes(hour)) slots.push({ key: `${day}:${hour}`, kind: 'now' });
  if (current.weekly && weekday === 0 && hour === 20) slots.push({ key: `week:${formatInTimeZone(now, TZ, "RRRR-'W'II")}`, kind: 'week' });
  for (const slot of slots) {
    if (current.sentReports.includes(slot.key)) continue;
    let before: NeboBotSettings | null = null;
    const claim = await updateNeboBotSettings((settings) => {
      if (settings.sentReports.includes(slot.key)) return false;
      before = { ...settings, sentReports: [...settings.sentReports] };
      settings.sentReports = [...settings.sentReports, slot.key].slice(-30);
      return true;
    });
    if (!claim.changed || !before) continue;
    const ok = await sendNeboOpsBusinessReport(slot.kind, now, before).catch(() => false);
    await updateNeboBotSettings((settings) => {
      if (!ok) { settings.sentReports = settings.sentReports.filter((key) => key !== slot.key); return true; }
      if (slot.kind === 'now') { settings.lastReportAt = now.toISOString(); return true; }
      return false;
    });
  }
}
