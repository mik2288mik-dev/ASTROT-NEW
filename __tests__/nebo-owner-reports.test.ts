jest.mock('../lib/db', () => ({ getPool: jest.fn(), getPrimaryPool: jest.fn() }));
import { reportPeriod, renderNeboReport, type ReportData } from '../lib/neboOpsReports';
import { planPriceRub, type Metrics } from '../lib/productMetrics';
import { buildNeboChartSvg, neboChartUrl, verifyNeboChart } from '../lib/neboOpsChart';
import {
  applyNeboSettingsTap,
  defaultNeboBotSettings,
  isQuietHour,
  normalizeNeboBotSettings,
  quietEndsAt,
  renderNeboOpsMenu,
} from '../lib/neboOpsSettings';

const metrics = (patch: Partial<Metrics> = {}): Metrics => ({
  firstLaunches: 2, firstLaunchesApp: 2, registrations: 1, registrationsByProvider: [{ label: 'VK ID', count: 1 }],
  active: 8, returning: 6, payments: 1, firstPayments: 1, renewals: 0, revenueRub: 399,
  paymentsByPlan: [{ label: 'Месяц', count: 1 }], trials: 0, cancellations: 0, refunds: 0, expired: 0,
  stars: { payments: 0, amount: 0 }, paywallViewers: 2, checkoutStarted: 1, buyers: 1,
  activation: { cohort: 2, activated: 1 }, supportTickets: 0, errors: 0,
  sources: [{ label: 'RuStore, сам нашёл', count: 2 }], totalUsers: 49, premiumActive: 3, ...patch,
});

describe('owner report periods (Moscow days)', () => {
  const now = new Date('2026-10-01T16:51:00Z'); // 19:51 MSK
  const settings = { period: 'day' as const, lastReportAt: null };

  it('counts «now» from Moscow midnight and compares with yesterday up to the same minute', () => {
    const period = reportPeriod('now', settings, now);
    expect(period.start.toISOString()).toBe('2026-09-30T21:00:00.000Z');
    expect(period.previous.start.toISOString()).toBe('2026-09-29T21:00:00.000Z');
    expect(period.previous.end.toISOString()).toBe('2026-09-30T16:51:00.000Z');
    expect(period.label).toBe('сегодня, 01.10, 00:00–19:51');
  });

  it('starts at the previous report when the owner chose «since the last report»', () => {
    const period = reportPeriod('now', { period: 'since_last', lastReportAt: '2026-10-01T06:00:00Z' }, now);
    expect(period.start.toISOString()).toBe('2026-10-01T06:00:00.000Z');
    expect(period.label).toBe('с прошлого отчёта: 09:00–19:51');
  });

  it('uses whole Moscow days for yesterday and seven days', () => {
    expect(reportPeriod('yesterday', settings, now).start.toISOString()).toBe('2026-09-29T21:00:00.000Z');
    expect(reportPeriod('week', settings, now).start.toISOString()).toBe('2026-09-24T21:00:00.000Z');
  });

  it('values payments at the plan list price', () => {
    expect(planPriceRub('premium_month')).toBeGreaterThan(0);
    expect(planPriceRub('unknown_plan')).toBe(0);
  });
});

describe('owner report text', () => {
  const items = defaultNeboBotSettings().report;
  const data: ReportData = {
    period: { label: 'сегодня, 01.10, 00:00–19:51' }, metrics: metrics(), previous: metrics({ active: 4, revenueRub: 0 }),
    audience: { dau: 8, wau: 20, mau: 41 }, retention: [{ day: 1, cohort: 10, returned: 3 }, { day: 7, cohort: 0, returned: 0 }],
    versions: { latest: '1.0.10', versions: [], outdated: 2, people: 9 }, monthRevenueRub: 1197, rating: null,
  };

  it('shows people, money and quality in plain words with the server name and no long dashes', () => {
    // Russian number formatting uses a non-breaking space between thousands.
    const text = renderNeboReport(data, items, 'Timeweb · RuStore').replace(/[  ]/g, ' ');
    expect(text).toContain('👥 Заходили: 8 (+100%) · новых 2, вернулись 6');
    expect(text).toContain('💰 Выручка: 399 ₽ (было 0) · за месяц 1 197 ₽');
    expect(text).toContain('📈 Аудитория: за день 8 · за 7 дней 20 · за 30 дней 41');
    expect(text).toContain('🔁 Удержание: день 1: 30% (3 из 10)');
    expect(text).not.toContain('день 7');
    expect(text).toContain('📦 Версии: 1.0.10 у 7, старые у 2');
    expect(text).toContain('🖥 Timeweb · RuStore');
    expect(text).not.toContain('—');
  });

  it('leaves out lines the owner switched off', () => {
    const text = renderNeboReport(data, { ...items, revenue: false, retention: false, versions: false }, 'Timeweb');
    expect(text).not.toContain('Выручка');
    expect(text).not.toContain('Удержание');
    expect(text).not.toContain('Версии');
    expect(text).toContain('Заходили');
  });
});

describe('owner bot settings', () => {
  it('toggles switches in place and keeps unknown data out', () => {
    const settings = defaultNeboBotSettings();
    expect(applyNeboSettingsTap(settings, 'ops:ev:review')).toBe('events');
    expect(settings.events.review).toBe(false);
    expect(applyNeboSettingsTap(settings, 'ops:hr:9')).toBe('times');
    expect(settings.reportHours).toEqual([9, 23]);
    expect(applyNeboSettingsTap(settings, 'ops:rd:30')).toBe('items');
    expect(settings.retentionDays).toEqual([1, 7, 30]);
    expect(applyNeboSettingsTap(settings, 'ops:pd:since_last')).toBe('times');
    expect(applyNeboSettingsTap(settings, 'ops:ev:not_a_switch')).toBeNull();
    expect(normalizeNeboBotSettings({ ...settings, reportHours: [9, 4], quiet: { from: 1, to: 2 } }))
      .toMatchObject({ reportHours: [9], quiet: null });
  });

  it('knows quiet hours across midnight and when they end', () => {
    const quiet = { quiet: { from: 23, to: 8 } };
    expect(isQuietHour(quiet, new Date('2026-10-01T21:30:00Z'))).toBe(true); // 00:30 MSK
    expect(isQuietHour(quiet, new Date('2026-10-01T09:30:00Z'))).toBe(false); // 12:30 MSK
    expect(quietEndsAt(quiet, new Date('2026-10-01T21:30:00Z')).toISOString()).toBe('2026-10-02T05:00:00.000Z');
  });

  it('shows the main menu with buttons and without long dashes', () => {
    const menu = renderNeboOpsMenu(defaultNeboBotSettings(), 'Timeweb · RuStore');
    const buttons = (menu.replyMarkup as { inline_keyboard: Array<Array<{ callback_data: string }>> })
      .inline_keyboard.flat().map((button) => button.callback_data);
    expect(buttons).toEqual(expect.arrayContaining(['ops:report:now', 'ops:find', 'ops:events', 'ops:items', 'ops:times', 'ops:pause', 'ops:quiet', 'ops:admin']));
    expect(menu.text).not.toContain('—');
  });
});

describe('owner charts', () => {
  const env = { NODE_ENV: 'test', NEBO_OPS_PUBLIC_URL: 'https://api.example.test', NEBO_OPS_WEBHOOK_SECRET: 'x'.repeat(40) } as NodeJS.ProcessEnv;

  it('signs chart links so only our bots can request them', () => {
    const url = new URL(neboChartUrl(14, new Date('2026-10-01T16:51:00Z'), env)!);
    expect(url.origin + url.pathname).toBe('https://api.example.test/api/telegram/ops-chart');
    const [days, stamp, sig] = ['days', 't', 'sig'].map((key) => url.searchParams.get(key)!);
    expect(verifyNeboChart(Number(days), stamp, sig, env)).toBe(true);
    expect(verifyNeboChart(30, stamp, sig, env)).toBe(false);
    expect(neboChartUrl(14, new Date(), { ...env, NEBO_OPS_WEBHOOK_SECRET: 'short' })).toBeNull();
  });

  it('draws one bar per day with the payments marked', () => {
    const svg = buildNeboChartSvg([
      { day: '2026-09-30', active: 5, firstLaunches: 1, registrations: 0, payments: 0, revenueRub: 0 },
      { day: '2026-10-01', active: 8, firstLaunches: 2, registrations: 1, payments: 1, revenueRub: 399 },
    ], 'NEBO · последние 2 дня');
    expect(svg).toContain('30.09');
    expect(svg).toContain('01.10');
    expect(svg.match(/<circle/g)).toHaveLength(1);
  });
});
