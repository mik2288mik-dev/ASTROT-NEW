import {
  normalizeBirthDateInput,
  normalizeBirthPlaceInput,
  normalizeBirthTimeInput,
} from './natalChartCanonical';

export type BirthProfileIdentityInput = {
  birthDate?: string | Date | null;
  birthTime?: string | null;
  birthTimeMode?: string | null;
  birthTimeUncertaintyMinutes?: number | null;
  birthTimeRangeStart?: string | null;
  birthTimeRangeEnd?: string | null;
  birthPlace?: string | null;
};

function modeOf(input: BirthProfileIdentityInput): 'exact' | 'approximate' | 'range' | 'unknown' {
  const mode = input.birthTimeMode;
  if (mode === 'exact' || mode === 'approximate' || mode === 'range' || mode === 'unknown') return mode;
  return normalizeBirthTimeInput(input.birthTime) ? 'exact' : 'unknown';
}

export function birthProfileIdentityMatches(
  current: BirthProfileIdentityInput,
  candidate: BirthProfileIdentityInput,
): boolean {
  const mode = modeOf(current);
  if (modeOf(candidate) !== mode) return false;
  if (normalizeBirthDateInput(current.birthDate) !== normalizeBirthDateInput(candidate.birthDate)) return false;
  if (normalizeBirthPlaceInput(current.birthPlace) !== normalizeBirthPlaceInput(candidate.birthPlace)) return false;
  if (mode === 'exact' || mode === 'approximate') {
    if (normalizeBirthTimeInput(current.birthTime) !== normalizeBirthTimeInput(candidate.birthTime)) return false;
  }
  if (mode === 'approximate'
    && (current.birthTimeUncertaintyMinutes ?? null) !== (candidate.birthTimeUncertaintyMinutes ?? null)) return false;
  if (mode === 'range') {
    if (normalizeBirthTimeInput(current.birthTimeRangeStart) !== normalizeBirthTimeInput(candidate.birthTimeRangeStart)) return false;
    if (normalizeBirthTimeInput(current.birthTimeRangeEnd) !== normalizeBirthTimeInput(candidate.birthTimeRangeEnd)) return false;
  }
  return true;
}

export function trustedBirthContext<T extends BirthProfileIdentityInput>(
  current: BirthProfileIdentityInput,
  candidate: T | null | undefined,
): T | null {
  return candidate && birthProfileIdentityMatches(current, candidate) ? candidate : null;
}
