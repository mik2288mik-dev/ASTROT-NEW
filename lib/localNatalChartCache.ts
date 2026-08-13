import type { NatalChartData, UserProfile } from "../types";

const NATAL_CHART_CACHE_SCHEMA_VERSION = 1;
const NATAL_CHART_CACHE_PREFIX = `your-horoscope:natal-chart:v${NATAL_CHART_CACHE_SCHEMA_VERSION}`;

type NatalChartCacheEntry = {
  schemaVersion: number;
  userId: string;
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  chartData: NatalChartData;
  chartId?: number;
  updatedAt: string;
};

function profileIdentity(profile: UserProfile) {
  return {
    userId: String(profile.id || ""),
    birthDate: String(profile.birthDate || ""),
    birthTime: String(profile.birthTime || ""),
    birthPlace: String(profile.birthPlace || ""),
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
    identity.birthPlace,
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
    entry.birthPlace === identity.birthPlace &&
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
