jest.mock('../lib/swisseph-calculator', () => ({
  // Smooth fake sky: the brief only needs longitudes that move at believable speeds.
  calculatePlanetaryTransitsAt: (date: Date) => {
    const days = date.getTime() / 86_400_000;
    const speeds = { sun: 0.986, moon: 13.18, mercury: 1.2, venus: 1.1, mars: 0.52, jupiter: 0.08, saturn: 0.03, uranus: 0.012, neptune: 0.006, pluto: 0.004 };
    return Object.fromEntries(Object.entries(speeds).map(([key, speed], index) => [key, { longitude: (index * 37 + days * speed) % 360, retrograde: false }]));
  },
}));
import { buildPersonalDayBrief } from '../lib/personalDayBrief';
import { resolvePersonalForecastWindow } from '../lib/personalForecastContract';
import samples from './fixtures/readingSamples.json';
import type { NatalChartDataV2 } from '../lib/natalChartV2Types';

const natal = samples.people[0].chart as unknown as NatalChartDataV2;
const window = resolvePersonalForecastWindow('day', '2026-07-26', 'Europe/Moscow');

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
});
