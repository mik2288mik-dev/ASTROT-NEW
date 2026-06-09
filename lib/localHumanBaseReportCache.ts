import type { NatalInterpretationReport, UserProfile } from '../types';
import { HUMAN_BASE_PROMPT_VERSION } from './natalHumanShared';

const SCHEMA_VERSION = 1;
const CACHE_PREFIX = `lumia:natal-human-base:v${SCHEMA_VERSION}`;

type LocalHumanBaseReportEntry = {
  schemaVersion: typeof SCHEMA_VERSION;
  userId: string;
  chartId: number | 'primary';
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  promptVersion: string;
  report: NatalInterpretationReport;
  updatedAt: string;
};

function getStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function normalizedProfile(profile: UserProfile) {
  return {
    userId: String(profile.id || '').trim(),
    birthDate: String(profile.birthDate || '').trim(),
    birthTime: String(profile.birthTime || '').trim(),
    birthPlace: String(profile.birthPlace || '').trim(),
  };
}

function keyPart(value: string | number): string {
  return encodeURIComponent(String(value));
}

export function buildLocalHumanBaseReportCacheKey(profile: UserProfile, chartId?: number): string {
  const identity = normalizedProfile(profile);
  return [
    CACHE_PREFIX,
    keyPart(identity.userId),
    keyPart(chartId ?? 'primary'),
    keyPart(identity.birthDate),
    keyPart(identity.birthTime),
    keyPart(identity.birthPlace),
    keyPart(HUMAN_BASE_PROMPT_VERSION),
  ].join(':');
}

function isValidEntry(entry: unknown, profile: UserProfile, chartId?: number): entry is LocalHumanBaseReportEntry {
  if (!entry || typeof entry !== 'object') return false;
  const value = entry as Partial<LocalHumanBaseReportEntry>;
  const identity = normalizedProfile(profile);
  const expectedChartId = chartId ?? 'primary';
  return value.schemaVersion === SCHEMA_VERSION
    && value.userId === identity.userId
    && value.chartId === expectedChartId
    && value.birthDate === identity.birthDate
    && value.birthTime === identity.birthTime
    && value.birthPlace === identity.birthPlace
    && value.promptVersion === HUMAN_BASE_PROMPT_VERSION
    && !!value.report
    && typeof value.report === 'object';
}

export function readLocalHumanBaseReport(profile: UserProfile, chartId?: number): NatalInterpretationReport | null {
  const storage = getStorage();
  if (!storage || !profile.id) return null;
  try {
    const raw = storage.getItem(buildLocalHumanBaseReportCacheKey(profile, chartId));
    if (!raw) return null;
    const entry: unknown = JSON.parse(raw);
    if (!isValidEntry(entry, profile, chartId)) return null;
    return entry.report;
  } catch {
    return null;
  }
}

export function readLocalHumanBaseReportWithFallback(profile: UserProfile, chartId?: number): NatalInterpretationReport | null {
  return readLocalHumanBaseReport(profile, chartId)
    || (chartId != null ? readLocalHumanBaseReport(profile) : null);
}

export function writeLocalHumanBaseReport(
  profile: UserProfile,
  report: NatalInterpretationReport,
  chartId?: number
): void {
  const storage = getStorage();
  if (!storage || !profile.id || !report) return;
  const identity = normalizedProfile(profile);
  const entry: LocalHumanBaseReportEntry = {
    schemaVersion: SCHEMA_VERSION,
    ...identity,
    chartId: chartId ?? 'primary',
    promptVersion: HUMAN_BASE_PROMPT_VERSION,
    report,
    updatedAt: new Date().toISOString(),
  };
  try {
    storage.setItem(buildLocalHumanBaseReportCacheKey(profile, chartId), JSON.stringify(entry));
  } catch {
    // Local cache is an optional performance optimization; server persistence remains authoritative.
  }
}

export function clearLocalHumanBaseReport(profile: UserProfile, chartId?: number): void {
  const storage = getStorage();
  if (!storage || !profile.id) return;
  const identity = normalizedProfile(profile);
  const prefix = `${CACHE_PREFIX}:${keyPart(identity.userId)}:${keyPart(chartId ?? 'primary')}:`;
  try {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (key?.startsWith(prefix)) storage.removeItem(key);
    }
  } catch {
    // Ignore unavailable/corrupted browser storage.
  }
}
