import {
  neboReportPeriod,
  planPriceRub,
  previousPeriod,
  renderNeboReport,
  type NeboStats,
} from '../lib/neboOpsStats';
import { buildNeboChartSvg, neboChartUrl, verifyNeboChart } from '../lib/neboOpsChart';

const stats: NeboStats = {
  visitors: 8, newUsers: 2, purchases: 1, revenueRub: 399, returning: 6, totalUsers: 49,
  premiumActive: 3, paywallUsers: 2, checkoutUsers: 1, trials: 0, starsPurchases: 0, starsAmount: 0,
  supportTickets: 0, errors: 0,
  newByProvider: [{ label: 'Гость', count: 1 }, { label: 'Яндекс ID', count: 1 }],
  newByChannel: [{ label: 'RuStore', count: 2 }],
  topScreens: [{ label: 'Сегодня', count: 17 }, { label: 'Натальная карта', count: 11 }],
  purchasesByPlan: [{ label: 'Месяц', count: 1 }],
  nextDayReturn: { cohort: 47, returned: 6 },
};

describe('owner report periods (Moscow days)', () => {
  const now = new Date('2026-10-01T16:51:00Z'); // 19:51 МСК

  it('counts today from Moscow midnight and compares with the same hours yesterday', () => {
    const period = neboReportPeriod('today', now);
    expect(period.start.toISOString()).toBe('2026-09-30T21:00:00.000Z');
    expect(period.end).toEqual(now);
    expect(period.label).toBe('Сегодня, 01.10 · 00:00–19:51 МСК');
    expect(previousPeriod(period)).toEqual({
      start: new Date('2026-09-29T21:00:00.000Z'), end: new Date('2026-09-30T16:51:00.000Z'),
    });
  });

  it('uses whole Moscow days for yesterday and seven days', () => {
    const yesterday = neboReportPeriod('yesterday', now);
    expect([yesterday.start.toISOString(), yesterday.end.toISOString()])
      .toEqual(['2026-09-29T21:00:00.000Z', '2026-09-30T21:00:00.000Z']);
    expect(neboReportPeriod('week', now).start.toISOString()).toBe('2026-09-24T21:00:00.000Z');
    expect(neboReportPeriod('month', now).start.toISOString()).toBe('2026-09-01T21:00:00.000Z');
  });

  it('values purchases at the plan list price', () => {
    expect(planPriceRub('premium_month')).toBe(399);
    expect(planPriceRub('premium_year')).toBe(2999);
    expect(planPriceRub('unknown')).toBe(0);
  });
});

describe('owner report text', () => {
  const now = new Date('2026-10-01T16:51:00Z');

  it('shows people, money and errors in plain words, with the server name', () => {
    const text = renderNeboReport(neboReportPeriod('today', now), stats,
      { visitors: 5, newUsers: 1, purchases: 0, revenueRub: 0 }, 'Timeweb');
    expect(text.split('\n')).toEqual([
      '📊 NEBO · Сегодня, 01.10 · 00:00–19:51 МСК',
      '🖥 Timeweb',
      '',
      '👥 Заходили: 8 (+60%)',
      '   новых 2 · вернулись 6',
      '📈 Всего аккаунтов: 49',
      '📥 Откуда новые: RuStore 2',
      '🔐 Как вошли: Гость 1 · Яндекс ID 1',
      '',
      '💳 Оплата: открыли 2 → начали 1 → купили 1',
      '💰 Выручка: 399 ₽ (раньше 0)',
      '🧾 Тарифы: Месяц 1',
      '💎 Premium сейчас у 3',
      '',
      '🧭 Смотрели: Сегодня 17 · Натальная карта 11',
      '',
      '⚠️ Ошибок: 0 · ✉️ Обращений: 0',
      'Сравнение — с периодом «вчера к этому времени». Время московское.',
    ]);
  });

  it('drops empty lines: no Stars, trials or channels when there is nothing to show', () => {
    const quiet = { ...stats, newUsers: 0, returning: 8, purchases: 0, revenueRub: 0, purchasesByPlan: [], topScreens: [] };
    const text = renderNeboReport(neboReportPeriod('yesterday', now), quiet,
      { visitors: 8, newUsers: 0, purchases: 0, revenueRub: 0 }, 'Timeweb');
    expect(text).not.toMatch(/Stars|Пробных|Откуда новые|Как вошли|Тарифы|Смотрели/);
    expect(text).toContain('👥 Заходили: 8 (как раньше)');
    expect(text).toContain('💰 Выручка: 0 ₽');
  });

  it('adds next-day return for weekly reports', () => {
    const text = renderNeboReport(neboReportPeriod('week', now), stats,
      { visitors: 8, newUsers: 2, purchases: 1, revenueRub: 399 }, 'Timeweb');
    expect(text).toContain('🔁 Вернулись на следующий день после регистрации: 6 из 47 (13%)');
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

  it('draws one bar per day with the purchases marked', () => {
    const svg = buildNeboChartSvg([
      { day: '30.09', visitors: 5, newUsers: 1, purchases: 0, revenueRub: 0 },
      { day: '01.10', visitors: 8, newUsers: 2, purchases: 1, revenueRub: 399 },
    ], 'NEBO · последние 2 дня');
    expect(svg).toContain('30.09');
    expect(svg).toContain('01.10');
    expect(svg.match(/<circle/g)).toHaveLength(1);
  });
});
