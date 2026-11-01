import { birthTimeFingerprint, normalizeBirthTimeInput } from './birthTime';
import { isCanonicalNatalChartDataComplete, normalizeBirthDateInput, normalizeBirthPlaceInput } from './natalChartCanonical';

/**
 * An existing canonical self chart is enough to finish a previously stuck
 * onboarding. Only recover when it matches the currently saved birth details;
 * never treat a stale or incomplete chart as a completed setup.
 */
export function savedPrimaryNatalMatchesProfile(
  profile: {
    birth_date?: string | Date | null;
    birth_place?: string | null;
    birth_time?: string | null;
    birth_time_mode?: string | null;
    birth_time_uncertainty_minutes?: number | null;
    birth_time_range_start?: string | null;
    birth_time_range_end?: string | null;
  },
  record: { input_hash?: string | null; chart_data?: any } | null,
): boolean {
  const chart = record?.chart_data;
  if (!record?.input_hash || !isCanonicalNatalChartDataComplete(chart) || !profile.birth_date || !profile.birth_place) return false;
  if (normalizeBirthDateInput(profile.birth_date) !== chart.birth.localDate
      || normalizeBirthPlaceInput(profile.birth_place).toLowerCase()
         !== normalizeBirthPlaceInput(chart.birth.place).toLowerCase()) return false;
  try {
    const savedTime = normalizeBirthTimeInput({
      mode: profile.birth_time_mode,
      localTime: profile.birth_time,
      legacyBirthTime: profile.birth_time,
      uncertaintyMinutes: profile.birth_time_uncertainty_minutes,
      rangeStart: profile.birth_time_range_start,
      rangeEnd: profile.birth_time_range_end,
    });
    return birthTimeFingerprint(savedTime) === birthTimeFingerprint(chart.birth.time);
  } catch {
    return false;
  }
}
