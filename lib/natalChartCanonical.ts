import crypto from 'crypto';

export const CANONICAL_NATAL_CALCULATION_VERSION = 'swisseph-canonical-v1';

export function normalizeBirthDateInput(value?: string | Date | null): string {
  if (!value) return '';

  if (value instanceof Date) {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
  }

  const trimmed = String(value).trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}-${String(parsed.getUTCDate()).padStart(2, '0')}`;
  }

  return trimmed;
}

export function normalizeBirthTimeInput(value?: string | null): string {
  if (!value) return '12:00';
  const trimmed = String(value).trim();
  const match = trimmed.match(/^(\d{2}):(\d{2})/);
  if (match) {
    return `${match[1]}:${match[2]}`;
  }
  return trimmed;
}

export function normalizeBirthPlaceInput(value?: string | null): string {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeCoordinateForStorage(value: number): number {
  return Number(value.toFixed(5));
}

export function buildCanonicalNatalInputHash(input: {
  birthDate: string;
  birthTime?: string | null;
  birthTimeQuality?: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
}): string {
  const normalizedBirthDate = normalizeBirthDateInput(input.birthDate);
  const normalizedBirthTime = normalizeBirthTimeInput(input.birthTime);
  const timezone = String(input.timezone || '').trim() || 'UTC';
  const birthTimeQuality = input.birthTimeQuality ? String(input.birthTimeQuality).trim() : '';
  const latitude = normalizeCoordinateForStorage(input.latitude).toFixed(5);
  const longitude = normalizeCoordinateForStorage(input.longitude).toFixed(5);
  const qualityPart = birthTimeQuality ? `|${birthTimeQuality}` : '';
  const raw = `${normalizedBirthDate}|${normalizedBirthTime}${qualityPart}|${latitude}|${longitude}|${timezone}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function isCanonicalNatalChartDataComplete(chartData: any): boolean {
  if (!chartData || typeof chartData !== 'object') return false;
  if (!chartData.sun || !chartData.moon || !chartData.rising) return false;
  if (typeof chartData.latitude !== 'number' || Number.isNaN(chartData.latitude)) return false;
  if (typeof chartData.longitude !== 'number' || Number.isNaN(chartData.longitude)) return false;
  if (!chartData.timezone || typeof chartData.timezone !== 'string') return false;
  if (!Array.isArray(chartData.houses) || chartData.houses.length < 12) return false;
  if (!Array.isArray(chartData.aspects)) return false;
  if (!chartData.calculationVersion || chartData.calculationVersion !== CANONICAL_NATAL_CALCULATION_VERSION) return false;
  return true;
}

export function hasCanonicalNatalRowFields(row: any): boolean {
  if (!row || typeof row !== 'object') return false;
  if (typeof row.latitude !== 'number' || Number.isNaN(row.latitude)) return false;
  if (typeof row.longitude !== 'number' || Number.isNaN(row.longitude)) return false;
  if (!row.timezone || typeof row.timezone !== 'string') return false;
  if (!row.sun_sign || !row.moon_sign || !row.ascendant_sign) return false;
  if (!row.calculation_version || row.calculation_version !== CANONICAL_NATAL_CALCULATION_VERSION) return false;
  if (!row.sun || !row.moon || !row.ascendant) return false;
  if (!row.houses || !row.aspects) return false;
  return true;
}
