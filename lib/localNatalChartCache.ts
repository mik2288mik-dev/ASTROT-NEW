import type { NatalChartData, UserProfile } from "../types";

const NATAL_CHART_CACHE_SCHEMA_VERSION = 2;
const NATAL_CHART_CACHE_PREFIX = `your-horoscope:natal-chart:v${NATAL_CHART_CACHE_SCHEMA_VERSION}`;

type NatalChartCacheEntry = {
  schemaVersion: number;
  userId: string;
  birthDate: string;
  birthTime: string;
  birthTimeMode: string;
  birthTimeUncertaintyMinutes: string;
  birthTimeRangeStart: string;
  birthTimeRangeEnd: string;
  birthPlace: string;
  birthTimezone: string;
  birthLatitude: string;
  birthLongitude: string;
  chartData: NatalChartData;
  chartId?: number;
  updatedAt: string;
};

function coordinate(value: unknown): string {
  const number = Number(value);
  return value !== null && value !== undefined && String(value).trim() !== '' && Number.isFinite(number)
    ? number.toFixed(6)
    : '';
}

function profileIdentity(profile: UserProfile) {
  const rawMode = String(profile.birthTimeMode || '').trim();
  const birthTimeMode = ['exact', 'approximate', 'range', 'unknown'].includes(rawMode)
    ? rawMode
    : (String(profile.birthTime || '').trim() ? 'exact' : 'unknown');
  return {
    userId: String(profile.id || ""),
    birthDate: String(profile.birthDate || ""),
    birthTime: birthTimeMode === 'unknown' || birthTimeMode === 'range'
      ? ''
      : String(profile.birthTime || '').trim(),
    birthTimeMode,
    birthTimeUncertaintyMinutes: birthTimeMode === 'approximate'
      ? String(profile.birthTimeUncertaintyMinutes ?? '')
      : '',
    birthTimeRangeStart: birthTimeMode === 'range' ? String(profile.birthTimeRangeStart || '').trim() : '',
    birthTimeRangeEnd: birthTimeMode === 'range' ? String(profile.birthTimeRangeEnd || '').trim() : '',
    birthPlace: String(profile.birthPlace || "").trim(),
    birthTimezone: String(profile.birthTimezone || '').trim(),
    birthLatitude: coordinate(profile.birthLatitude),
    birthLongitude: coordinate(profile.birthLongitude),
  };
}

function isChartData(value: unknown): value is NatalChartData {
  const chart = value as NatalChartData | null;
  const quality = chart?.birthTimeQuality || chart?.chartQuality?.birthTimeQuality;
  return !!chart?.sun && !!chart?.moon && (quality === 'unknown' || !!chart?.rising);
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function buildNatalChartCacheKey(profile: UserProfile): string {
  const identity = profileIdentity(profile);
  return [
    NATAL_CHART_CACHE_PREFIX,
    identity.userId,
    identity.birthDate,
    identity.birthTime,
    identity.birthTimeMode,
    identity.birthTimeUncertaintyMinutes,
    identity.birthTimeRangeStart,
    identity.birthTimeRangeEnd,
    identity.birthPlace,
    identity.birthTimezone,
    identity.birthLatitude,
    identity.birthLongitude,
  ].join(":");
}

export function isLocalNatalChartValid(
  profile: UserProfile,
  cached: unknown,
): cached is NatalChartCacheEntry {
  const entry = cached as NatalChartCacheEntry | null;
  const identity = profileIdentity(profile);
  return (
    !!entry &&
    entry.schemaVersion === NATAL_CHART_CACHE_SCHEMA_VERSION &&
    !!identity.userId &&
    entry.userId === identity.userId &&
    entry.birthDate === identity.birthDate &&
    entry.birthTime === identity.birthTime &&
    entry.birthTimeMode === identity.birthTimeMode &&
    entry.birthTimeUncertaintyMinutes === identity.birthTimeUncertaintyMinutes &&
    entry.birthTimeRangeStart === identity.birthTimeRangeStart &&
    entry.birthTimeRangeEnd === identity.birthTimeRangeEnd &&
    entry.birthPlace === identity.birthPlace &&
    entry.birthTimezone === identity.birthTimezone &&
    entry.birthLatitude === identity.birthLatitude &&
    entry.birthLongitude === identity.birthLongitude &&
    isChartData(entry.chartData)
  );
}

export function readLocalNatalChartCache(
  profile: UserProfile,
): NatalChartCacheEntry | null {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(buildNatalChartCacheKey(profile));
    if (!raw) return null;
    const cached: unknown = JSON.parse(raw);
    if (!isLocalNatalChartValid(profile, cached)) return null;
    return cached;
  } catch {
    return null;
  }
}

export function readLocalNatalChart(
  profile: UserProfile,
): NatalChartData | null {
  return readLocalNatalChartCache(profile)?.chartData || null;
}

export function writeLocalNatalChart(
  profile: UserProfile,
  chartData: NatalChartData,
  chartId?: number,
): void {
  const storage = getStorage();
  const identity = profileIdentity(profile);
  if (!storage || !identity.userId || !isChartData(chartData)) return;

  const existing = readLocalNatalChartCache(profile);
  const resolvedChartId =
    typeof chartId === "number" && Number.isFinite(chartId)
      ? chartId
      : existing?.chartId;
  const entry: NatalChartCacheEntry = {
    schemaVersion: NATAL_CHART_CACHE_SCHEMA_VERSION,
    ...identity,
    chartData,
    ...(resolvedChartId != null ? { chartId: resolvedChartId } : {}),
    updatedAt: new Date().toISOString(),
  };

  try {
    storage.setItem(buildNatalChartCacheKey(profile), JSON.stringify(entry));
  } catch {
    // Local cache is an optional performance optimization; DB persistence remains authoritative.
  }
}

export function clearLocalNatalChart(profile: UserProfile): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(buildNatalChartCacheKey(profile));
  } catch {
    // Ignore unavailable/corrupted browser storage.
  }
}
