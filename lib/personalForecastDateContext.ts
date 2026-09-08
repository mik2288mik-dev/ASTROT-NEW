import { fromZonedTime } from 'date-fns-tz';
import type { NatalChartData } from '../types';
import type { NatalChartDataV2 } from './natalChartV2Types';
import type { PersonalForecastWindow } from './personalForecastContract';
import type { CurrentTransits } from './transits-calculator';
import { calculatePlanetaryTransitsAt } from './swisseph-calculator';
import { detectTransitAspects } from './transitAspects';

/** Date calculations only. The supplied saved natal chart is never repaired or recalculated. */
export function buildPersonalForecastDateContext(natal: NatalChartDataV2, window: PersonalForecastWindow) {
  const start = Date.parse(`${window.periodStart}T12:00:00Z`);
  const days = Math.round((Date.parse(`${window.periodEnd}T12:00:00Z`) - start) / 86_400_000) + 1;
  const step = days <= 7 ? 1 : 7;
  const offsets = Array.from({ length: Math.ceil(days / step) }, (_, index) => index * step);
  if (offsets.at(-1) !== days - 1) offsets.push(days - 1);
  const reliableNatal = { ...natal } as NatalChartData;
  if (natal.chartQuality.birthTimeMode === 'unknown') delete (reliableNatal as Partial<NatalChartData>).moon;
  const planets = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'] as const;
  const samples = offsets.map(offset => {
    const date = new Date(start + offset * 86_400_000).toISOString().slice(0, 10);
    const instant = fromZonedTime(`${date}T12:00:00`, window.timezone);
    const positions = calculatePlanetaryTransitsAt(instant);
    const transits = { date, source: 'swisseph', ...Object.fromEntries(planets.map(key => [key, positions[key]])) } as CurrentTransits;
    return { date, timestamp: instant.toISOString(),
      positions: Object.fromEntries(planets.map(key => [key, { longitude: positions[key].longitude, sign: positions[key].sign, retrograde: positions[key].retrograde }])),
      aspectsToSavedChart: detectTransitAspects(reliableNatal, transits, { limit: 12 }),
    };
  });
  return { source: 'Swiss Ephemeris', timezone: window.timezone,
    sampling: days > 7 ? 'weekly samples and last day; not exact event timings' : 'local noon each day; not exact event timings',
    samples };
}
