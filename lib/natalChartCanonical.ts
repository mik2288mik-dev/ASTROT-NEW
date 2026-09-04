import crypto from 'crypto';
import { birthTimeFingerprint, normalizeBirthTimeInput as normalizeBirthTimeContract } from './birthTime';

export const CANONICAL_NATAL_CALCULATION_VERSION = 'swisseph-canonical-v2';
export const NATAL_CHART_SCHEMA_VERSION = 'natal-chart-data-v2';

export function normalizeBirthDateInput(value?: string | Date | null): string {
  if (!value) return '';
  if (value instanceof Date) {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
  }

  const trimmed = String(value).trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}-${String(parsed.getUTCDate()).padStart(2, '0')}`;
  }
  return trimmed;
}

/** Keeps an unknown time empty. It never inserts 12:00. */
export function normalizeBirthTimeInput(value?: string | null): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  const match = trimmed.match(/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?$/);
  return match ? `${match[1]}:${match[2]}` : trimmed;
}

export function normalizeBirthPlaceInput(value?: string | null): string {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export function normalizeCoordinateForStorage(value: number): number {
  return Number(value.toFixed(6));
}

export function buildCanonicalNatalInputHash(input: {
  birthDate: string;
  birthPlace?: string;
  birthTime?: string | null;
  birthTimeMode?: string | null;
  birthTimeUncertaintyMinutes?: number | null;
  birthTimeRangeStart?: string | null;
  birthTimeRangeEnd?: string | null;
  birthTimeQuality?: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
}): string {
  const normalizedBirthDate = normalizeBirthDateInput(input.birthDate);
  const time = normalizeBirthTimeContract({
    mode: input.birthTimeMode || input.birthTimeQuality,
    localTime: input.birthTime,
    uncertaintyMinutes: input.birthTimeUncertaintyMinutes,
    rangeStart: input.birthTimeRangeStart,
    rangeEnd: input.birthTimeRangeEnd,
    legacyBirthTime: input.birthTime,
  });
  const timezone = String(input.timezone || '').trim();
  const latitude = normalizeCoordinateForStorage(input.latitude).toFixed(6);
  const longitude = normalizeCoordinateForStorage(input.longitude).toFixed(6);
  const raw = [
    'natal-birth-input-v1',
    normalizedBirthDate,
    birthTimeFingerprint(time),
    normalizeBirthPlaceInput(input.birthPlace).toLocaleLowerCase('ru'),
    latitude,
    longitude,
    timezone,
  ].join('|');
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function parseJson(value: any): any {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return null; }
}

export function isCanonicalNatalChartDataComplete(chartData: any): boolean {
  const data = parseJson(chartData);
  if (!data || typeof data !== 'object') return false;
  if (data.schemaVersion !== NATAL_CHART_SCHEMA_VERSION) return false;
  // A calculator release never invalidates a saved astronomical calculation.
  if (typeof data.calculationVersion !== 'string' || !data.calculationVersion) return false;
  if (!data.birth || !data.positions || !data.chartQuality || !data.calculationMetadata) return false;
  const bodies = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'chiron', 'northNode', 'southNode'];
  if (bodies.some((key) => !Number.isFinite(data.positions[key]?.longitude)
    || !Number.isFinite(data.positions[key]?.degree) || !data.positions[key]?.sign)) return false;
  if (!data.birth.localDate || !data.birth.place || !data.birth.timezone
    || !Number.isFinite(data.birth.latitude) || !Number.isFinite(data.birth.longitude)) return false;
  if (!data.calculationMetadata.ephemerisEngine || !data.calculationMetadata.calculatedAt) return false;
  if (!Array.isArray(data.houses) || !Array.isArray(data.aspects)) return false;
  const timeMode = data.birth.time?.mode;
  if (!['exact', 'approximate', 'range', 'unknown'].includes(timeMode)) return false;
  const expectedQuality = timeMode === 'exact'
    ? 'exact'
    : timeMode === 'unknown'
      ? 'unknown'
      : 'approximate';
  if (
    data.chartQuality.birthTimeMode !== timeMode
    || data.chartQuality.birthTimeQuality !== expectedQuality
    || data.birthTimeQuality !== expectedQuality
  ) return false;

  if (timeMode === 'exact') {
    if (!data.angles?.ascendant || !data.angles?.mc || data.houses.length !== 12) return false;
  } else if (timeMode === 'unknown') {
    if (Object.values(data.angles || {}).some(Boolean) || data.houses.length !== 0) return false;
  } else if (!data.angles || typeof data.angles !== 'object' || data.houses.length !== 12) {
    return false;
  }
  return true;
}

export function hasCanonicalNatalRowFields(row: any): boolean {
  if (!row || typeof row !== 'object') return false;
  if (!row.input_hash) return false;
  if (!row.calculation_version) return false;
  return isCanonicalNatalChartDataComplete(row.chart_data);
}
