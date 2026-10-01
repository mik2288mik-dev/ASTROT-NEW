import type { NatalChartDataV2 } from '../natalChartV2Types';
import { calculateNatalChart, getCoordinates } from '../swisseph-calculator';

// Most people enter Russian birth places; without a place the day is read in Moscow time.
const FALLBACK_COORDINATES = { lat: 55.7558, lon: 37.6173, timezone: 'Europe/Moscow' };

/**
 * Chart for a person entered by hand for one comparison. Birth time is treated
 * as unknown on purpose: fast planets come back as whole-day ranges, houses and
 * angles are left out, so nothing pretends to be more exact than a birth date.
 * The chart is not saved anywhere.
 */
export async function buildManualCompatibilityChart(input: {
  name: string;
  date: string;
  place?: string | null;
}): Promise<NatalChartDataV2 | null> {
  const place = String(input.place || '').trim();
  let coordinates = FALLBACK_COORDINATES;
  if (place) {
    try {
      coordinates = await getCoordinates(place);
    } catch {
      coordinates = FALLBACK_COORDINATES;
    }
  }
  try {
    return await calculateNatalChart(
      input.name.trim() || 'Person',
      input.date,
      '',
      place || 'Москва',
      { coordinates, birthTimeMode: 'unknown' },
    );
  } catch {
    return null;
  }
}
