import type { NatalChartData } from '../types';

function hash(value: string): number { let result = 2166136261; for (let i = 0; i < value.length; i += 1) { result ^= value.charCodeAt(i); result = Math.imul(result, 16777619); } return result >>> 0; }

/** Natal-only cache identity. It intentionally does not belong to personal forecasts. */
export function buildNatalChartFingerprint(chart: NatalChartData): string {
  return hash(JSON.stringify({
    positions: ['sun','moon','rising','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto','chiron','mc'].map((key) => {
      const value = chart[key as keyof NatalChartData] as any;
      return [key, value?.sign || null, value?.longitude || null, value?.degree || null, value?.house || null, value?.retrograde || null];
    }), houses: (chart.houses || []).map((house) => [house.house, house.longitude]), aspects: chart.aspects || [], calculationVersion: chart.calculationVersion || null,
  })).toString(36);
}
