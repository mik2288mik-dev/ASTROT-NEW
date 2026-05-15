import type { NatalChartData } from '../types';
import { buildTodayPulse } from '../lib/todayPulse';

jest.mock('../lib/transits-calculator', () => ({
  getCurrentTransits: jest.fn(async (date: Date) => {
    const hour = date.getUTCHours();
    return {
      date: date.toISOString().slice(0, 10),
      sun: { planet: 'Sun', sign: 'Taurus', degree: (20 + hour * 0.04) % 30 },
      moon: { planet: 'Moon', sign: hour < 12 ? 'Virgo' : 'Libra', degree: (hour * 0.55) % 30 },
      mercury: { planet: 'Mercury', sign: 'Gemini', degree: (8 + hour * 0.09) % 30 },
      venus: { planet: 'Venus', sign: 'Cancer', degree: (11 + hour * 0.05) % 30 },
      mars: { planet: 'Mars', sign: 'Leo', degree: (5 + hour * 0.03) % 30 },
      jupiter: { planet: 'Jupiter', sign: 'Taurus', degree: 15 },
      saturn: { planet: 'Saturn', sign: 'Pisces', degree: 19 },
      moonPhase: 'waxing',
      source: 'algorithmic',
    };
  }),
}));

const chart = {
  sun: { planet: 'Sun', sign: 'Pisces', degree: 15, longitude: 345, house: 6, description: '' },
  moon: { planet: 'Moon', sign: 'Cancer', degree: 10, longitude: 100, house: 4, description: '' },
  rising: { planet: 'Ascendant', sign: 'Libra', degree: 7, longitude: 187, house: 1, description: '' },
  mercury: { planet: 'Mercury', sign: 'Aquarius', degree: 20, longitude: 320, house: 10, description: '' },
  venus: { planet: 'Venus', sign: 'Aries', degree: 8, longitude: 8, house: 7, description: '' },
  mars: { planet: 'Mars', sign: 'Capricorn', degree: 11, longitude: 281, house: 1, description: '' },
  jupiter: { planet: 'Jupiter', sign: 'Taurus', degree: 4, longitude: 34, house: 2, description: '' },
  saturn: { planet: 'Saturn', sign: 'Scorpio', degree: 13, longitude: 223, house: 3, description: '' },
  element: 'Water',
  rulingPlanet: 'Neptune',
  latitude: 55.75,
  longitude: 37.62,
  timezone: 'Europe/Moscow',
  houses: Array.from({ length: 12 }, (_, index) => ({
    house: index + 1,
    sign: 'Aries',
    degree: 0,
    longitude: index * 30,
  })),
  aspects: [],
  calculationVersion: 'swisseph-canonical-v1',
  summary: '',
} satisfies NatalChartData;

function walk(value: unknown, path = 'root'): string[] {
  if (value == null) return [path];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => walk(item, `${path}[${index}]`));
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => walk(item, `${path}.${key}`));
  }
  return [];
}

describe('today pulse', () => {
  it('builds a complete 24-hour pulse without nulls', async () => {
    const pulse = await buildTodayPulse({
      chartData: chart,
      dateKey: '2026-05-15',
      timezone: 'Europe/Moscow',
      language: 'ru',
      now: new Date('2026-05-15T09:30:00.000Z'),
    });

    expect(pulse.points).toHaveLength(24);
    expect(pulse.windows).toHaveLength(6);
    expect(pulse.keyMoments.length).toBeGreaterThanOrEqual(4);
    expect(pulse.keyMoments.length).toBeLessThanOrEqual(5);
    expect(walk(pulse)).toEqual([]);

    for (const point of pulse.points) {
      expect(point.score).toBeGreaterThanOrEqual(0);
      expect(point.score).toBeLessThanOrEqual(100);
      expect(point.reasons.length).toBeGreaterThanOrEqual(2);
      for (const value of Object.values(point.layers)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    }
  });

  it('works when optional planets and houses are missing', async () => {
    const minimalChart = {
      ...chart,
      mercury: null,
      venus: null,
      mars: null,
      jupiter: null,
      saturn: null,
      houses: [],
      aspects: [],
      timezone: undefined,
    } satisfies NatalChartData;

    const pulse = await buildTodayPulse({
      chartData: minimalChart,
      dateKey: '2026-05-15',
      language: 'ru',
      now: new Date('2026-05-15T09:30:00.000Z'),
    });

    expect(pulse.timezone).toBe('Europe/Moscow');
    expect(pulse.points).toHaveLength(24);
    expect(walk(pulse)).toEqual([]);
  });
});
