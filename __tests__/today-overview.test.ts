import type { ForecastDailyReading, NatalChartData } from '../types';
import {
  buildTodayMetrics,
  buildTodayOverview,
  hydrateReactionSummaryLabels,
} from '../lib/todayOverview';

jest.mock('../lib/transits-calculator', () => ({
  getCurrentTransits: jest.fn(async (date: Date) => {
    const day = date.getUTCDate();
    return {
      date: date.toISOString().slice(0, 10),
      sun: { planet: 'Sun', sign: 'Taurus', degree: (day * 3) % 30 },
      moon: { planet: 'Moon', sign: 'Cancer', degree: (day * 7) % 30 },
      mercury: { planet: 'Mercury', sign: 'Gemini', degree: (day * 5) % 30 },
      venus: { planet: 'Venus', sign: 'Taurus', degree: (day * 4) % 30 },
      mars: { planet: 'Mars', sign: 'Leo', degree: (day * 6) % 30 },
      moonPhase: 'Растущая',
    };
  }),
}));

const chart = {
  sun: { planet: 'Sun', sign: 'Pisces', degree: 15, longitude: 345, description: '' },
  moon: { planet: 'Moon', sign: 'Cancer', degree: 10, longitude: 100, description: '' },
  rising: { planet: 'Ascendant', sign: 'Libra', degree: 7, longitude: 187, description: '' },
  mercury: { planet: 'Mercury', sign: 'Aquarius', degree: 20, longitude: 320, description: '' },
  venus: { planet: 'Venus', sign: 'Aries', degree: 8, longitude: 8, description: '' },
  mars: { planet: 'Mars', sign: 'Capricorn', degree: 11, longitude: 281, description: '' },
  jupiter: null,
  saturn: null,
  element: 'Water',
  rulingPlanet: 'Neptune',
  summary: '',
} satisfies NatalChartData;

const forecast: ForecastDailyReading = {
  date: '2026-05-07',
  headline: 'Сегодня важен один ясный ритм',
  summary: 'День лучше раскрывается без спешки.',
  chance: 'Можно спокойно сдвинуть важное.',
  risk: 'Не отвечай слишком быстро.',
  focus: 'Выбери один приоритет.',
  reading: 'Личный слой дня.',
  context: 'Контекст карты.',
  advice: ['Дыши спокойнее', 'Не спеши', 'Сделай главное'],
};

describe('today overview', () => {
  it('builds stable 0-100 metrics with 7-day history', async () => {
    const first = await buildTodayMetrics(chart, '2026-05-07', 'ru');
    const second = await buildTodayMetrics(chart, '2026-05-07', 'ru');

    expect(first).toHaveLength(4);
    expect(first).toEqual(second);
    for (const metric of first) {
      expect(metric.history).toHaveLength(7);
      expect(metric.value).toBeGreaterThanOrEqual(0);
      expect(metric.value).toBeLessThanOrEqual(100);
      for (const point of metric.history) {
        expect(point.value).toBeGreaterThanOrEqual(0);
        expect(point.value).toBeLessThanOrEqual(100);
      }
    }
  });

  it('hydrates reaction labels and keeps aggregate counts', () => {
    const summary = hydrateReactionSummaryLabels(
      {
        userReaction: 'funny',
        counts: [
          { key: 'funny', label: 'funny', count: 2 },
          { key: 'spot_on', label: 'spot_on', count: 1 },
        ],
        total: 3,
      },
      'ru'
    );

    expect(summary.userReaction).toBe('funny');
    expect(summary.total).toBe(3);
    expect(summary.counts.find((item) => item.key === 'funny')?.label).toBe('Улыбнуло');
  });

  it('builds a kind sign comparison without toxic wording', async () => {
    const overview = await buildTodayOverview({
      profileLanguage: 'ru',
      chartData: chart,
      dateKey: '2026-05-07',
      personalForecast: forecast,
      signHoroscope: forecast,
    });

    expect(overview.sign).toBe('Pisces');
    expect(overview.comparison).not.toContain('хуже');
    expect(overview.metrics).toHaveLength(4);
  });
});
