jest.mock('../lib/swisseph-calculator', () => ({
  // Smooth fake sky: the brief only needs longitudes that move at believable speeds.
  calculatePlanetaryTransitsAt: jest.fn((date: Date) => {
    const days = date.getTime() / 86_400_000;
    const speeds = { sun: 0.986, moon: 13.18, mercury: 1.2, venus: 1.1, mars: 0.52, jupiter: 0.08, saturn: 0.03, uranus: 0.012, neptune: 0.006, pluto: 0.004 };
    return Object.fromEntries(Object.entries(speeds).map(([key, speed], index) => [key, { longitude: (index * 37 + days * speed) % 360, retrograde: false }]));
  }),
}));
import { buildPersonalDayBrief } from '../lib/personalDayBrief';
import { resolvePersonalForecastWindow } from '../lib/personalForecastContract';
import { calculatePlanetaryTransitsAt } from '../lib/swisseph-calculator';
import samples from './fixtures/readingSamples.json';
import type { NatalChartDataV2 } from '../lib/natalChartV2Types';

const natal = samples.people[0].chart as unknown as NatalChartDataV2;
const window = resolvePersonalForecastWindow('day', '2026-07-26', 'Europe/Moscow');
const calculator = calculatePlanetaryTransitsAt as jest.Mock;
const defaultCalculator = calculator.getMockImplementation()!;

afterEach(() => calculator.mockImplementation(defaultCalculator));

describe('personal day brief', () => {
  it('names real events in plain words and differs from day to day', () => {
    const brief = buildPersonalDayBrief(natal, window);
    expect(brief.main_events.length).toBeGreaterThan(0);
    expect(brief.main_events.length).toBeLessThanOrEqual(4);
    expect(brief.moon.phase).toBeTruthy();
    for (const event of brief.main_events) {
      expect(event.what).toBeTruthy();
      expect(event.effect).toBeTruthy();
    }
    const next = buildPersonalDayBrief(natal, { ...window, periodStart: '2026-07-29', periodEnd: '2026-07-29' });
    expect(JSON.stringify(next)).not.toBe(JSON.stringify(brief));
  });

  it('does not use houses or the natal Moon when the birth time is unknown', () => {
    const unknown = { ...natal, chartQuality: { ...natal.chartQuality, birthTimeMode: 'unknown', housesAvailable: false, anglesAvailable: false, ascendantReliable: false } } as NatalChartDataV2;
    const brief = buildPersonalDayBrief(unknown, window);
    expect(brief.birth_time_known).toBe(false);
    expect(brief.moon).not.toHaveProperty('area_of_life_today');
    expect(JSON.stringify(brief.main_events)).not.toContain('твоя Луна');
    expect(JSON.stringify(brief.main_events)).not.toContain('Асцендент');
  });

  it('keeps real ranked square aspects without asserting trouble or harmony', () => {
    const planets = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
    calculator.mockImplementation(() => Object.fromEntries(planets.map((key) => [key, { longitude: 0, retrograde: true }])));
    const chart = {
      ...natal,
      positions: { sun: { ...natal.positions.sun, longitude: 90 } },
      houses: [],
      chartQuality: { ...natal.chartQuality, housesAvailable: false, anglesAvailable: false, ascendantReliable: false },
    } as unknown as NatalChartDataV2;

    const brief = buildPersonalDayBrief(chart, window);

    expect(brief.main_events.map((event) => event.what)).toEqual([
      'Луна: квадрат, твоё Солнце',
      'Марс: квадрат, твоё Солнце',
      'Венера: квадрат, твоё Солнце',
      'Юпитер: квадрат, твоё Солнце',
    ]);
    for (const event of brief.main_events) {
      expect(event.exactness_degrees).toBe(0);
      expect(event.effect).toBe('аспект квадрата');
      expect(event.tone).toBe('напряжённый аспект');
      expect(event.tone).not.toContain('гармонич');
    }
    expect(brief.moon.phase).toBe('новолуние');
    expect(brief.retrograde).toEqual(['Меркурий ретроградный', 'Венера ретроградная', 'Марс ретроградный']);
    expect(JSON.stringify(brief)).not.toMatch(/раздраж|ссор|спор|переписк|ошибиться|не спешить|мешает|буксует/u);
  });
});
