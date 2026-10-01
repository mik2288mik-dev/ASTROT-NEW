import * as Astronomy from 'astronomy-engine';
import { buildSkyMonitor, houseOfLongitude } from '../lib/skyMonitor';

// Placidus cusps of the 22.12.2010 Dmitrov chart.
const CUSPS = [99.1125, 112.49, 127.59, 147.8387, 180.03, 232.36, 279.1125, 292.49, 307.59, 327.8387, 0.03, 52.36];

describe('sky monitor', () => {
  it('places longitudes into houses, including the one crossing 0° Aries', () => {
    expect(houseOfLongitude(80, CUSPS)).toBe(12);
    expect(houseOfLongitude(215, CUSPS)).toBe(5);
    expect(houseOfLongitude(350, CUSPS)).toBe(10);
    expect(houseOfLongitude(10, CUSPS)).toBe(11);
  });

  it('describes 2 October 2026: waning Moon in Gemini, Mercury retrograde ahead', () => {
    const sky = buildSkyMonitor(Astronomy, new Date('2026-10-02T03:00:00Z'), CUSPS);
    expect(sky.moon.sign).toBe('Gemini');
    expect(sky.moon.waxing).toBe(false);
    expect(sky.moon.personal?.house).toBe(12);
    expect(sky.calendar.map((item) => item.label)).toEqual([
      'последняя четверть', 'новолуние', 'первая четверть', 'полнолуние',
    ]);
    expect(sky.calendar[1].date.toISOString().slice(0, 10)).toBe('2026-10-10');
    expect(sky.mercury.retrograde).toBe(false);
    expect(sky.mercury.window?.start.toISOString().slice(0, 13)).toBe('2026-10-24T07');
    expect(sky.mercury.window?.end.toISOString().slice(0, 10)).toBe('2026-11-13');
    expect(sky.mercury.windowSignIn).toBe('Скорпионе');
    expect(sky.mercury.personal?.house).toBe(5);
  });

  it('reports a retrograde in progress with its own window', () => {
    const sky = buildSkyMonitor(Astronomy, new Date('2026-11-01T12:00:00Z'));
    expect(sky.mercury.retrograde).toBe(true);
    expect(sky.mercury.window?.start.toISOString().slice(0, 10)).toBe('2026-10-24');
    expect(sky.mercury.window?.end.toISOString().slice(0, 10)).toBe('2026-11-13');
    expect(sky.mercury.daysUntilStart).toBeNull();
    expect(sky.moon.personal).toBeNull();
  });
});
