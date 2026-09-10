import type { NatalChartData, UserProfile } from '../types';
import type { ChartSubjectType } from './chartAccessPolicy';
import {
  NATAL_PERMANENT_FREE_PROMPT_VERSION,
  buildPermanentNatalChartFingerprint,
  isNatalPermanentFreeReport,
  type NatalPermanentFreeReport,
} from './natalReading/permanentReport';

const SCHEMA_VERSION = 3;
const CACHE_PREFIX = `lumia:natal-human-base:v${SCHEMA_VERSION}`;

export type HumanBaseReportSubjectIdentity = {
  name?: string | null;
  birthDate: string;
  birthTime?: string | null;
  birthPlace: string;
};

export type HumanBaseReportCacheContext = {
  subjectType?: ChartSubjectType;
  subjectIdentity?: HumanBaseReportSubjectIdentity | null;
  chartData?: NatalChartData | null;
  inputHash?: string | null;
  calculationVersion?: string | null;
};

type LocalHumanBaseReportEntry = {
  schemaVersion: typeof SCHEMA_VERSION;
  ownerUserId: string;
  language: 'ru' | 'en';
  subjectScope: 'self' | `saved:${number}`;
  chartAlias: number | 'primary';
  subjectName: string;
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  chartFingerprint: string;
  inputHash: string;
  calculationVersion: string;
  promptVersion: string;
  report: NatalPermanentFreeReport;
  updatedAt: string;
};

function getStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function normalizeText(value: unknown): string {
  return String(value || '').trim();
}

function resolveCacheIdentity(
  profile: UserProfile,
  chartId: number | undefined,
  context: HumanBaseReportCacheContext,
) {
  const subjectType = context.subjectType === 'saved_person' ? 'saved_person' : 'self';
  const savedChartId = subjectType === 'saved_person' && Number.isFinite(chartId) ? Number(chartId) : null;
  const subject = context.subjectIdentity || {
    name: profile.name,
    birthDate: profile.birthDate,
    birthTime: profile.birthTime,
    birthPlace: profile.birthPlace,
  };
  const chartFingerprint = context.chartData
    ? buildPermanentNatalChartFingerprint(profile, context.chartData)
    : 'chart-unavailable';
  const calculationVersion = normalizeText(
    context.calculationVersion || context.chartData?.calculationVersion || 'unknown',
  ) || 'unknown';

  return {
    ownerUserId: normalizeText(profile.id),
    language: (profile.language === 'en' ? 'en' : 'ru') as 'ru' | 'en',
    subjectScope: (savedChartId != null ? `saved:${savedChartId}` : 'self') as 'self' | `saved:${number}`,
    chartAlias: chartId ?? 'primary' as number | 'primary',
    subjectName: normalizeText(subject.name),
    birthDate: normalizeText(subject.birthDate),
    birthTime: normalizeText(subject.birthTime),
    birthPlace: normalizeText(subject.birthPlace),
    chartFingerprint,
    inputHash: normalizeText(context.inputHash || 'unknown') || 'unknown',
    calculationVersion,
  };
}

function keyPart(value: string | number): string {
  return encodeURIComponent(String(value));
}

export function buildLocalHumanBaseReportCacheKey(
  profile: UserProfile,
  chartId?: number,
  context: HumanBaseReportCacheContext = {},
): string {
  const identity = resolveCacheIdentity(profile, chartId, context);
  return [
    CACHE_PREFIX,
    keyPart(identity.ownerUserId),
    keyPart(identity.language),
    keyPart(identity.subjectScope),
    keyPart(identity.chartAlias),
    keyPart(identity.subjectName),
    keyPart(identity.birthDate),
    keyPart(identity.birthTime),
    keyPart(identity.birthPlace),
    keyPart(identity.chartFingerprint),
    keyPart(identity.inputHash),
    keyPart(identity.calculationVersion),
    keyPart(NATAL_PERMANENT_FREE_PROMPT_VERSION),
  ].join(':');
}

function isValidEntry(
  entry: unknown,
  profile: UserProfile,
  chartId: number | undefined,
  context: HumanBaseReportCacheContext,
): entry is LocalHumanBaseReportEntry {
  if (!entry || typeof entry !== 'object') return false;
  const value = entry as Partial<LocalHumanBaseReportEntry>;
  const identity = resolveCacheIdentity(profile, chartId, context);
  return value.schemaVersion === SCHEMA_VERSION
    && value.ownerUserId === identity.ownerUserId
    && value.language === identity.language
    && value.subjectScope === identity.subjectScope
    && value.chartAlias === identity.chartAlias
    && value.subjectName === identity.subjectName
    && value.birthDate === identity.birthDate
    && value.birthTime === identity.birthTime
    && value.birthPlace === identity.birthPlace
    && value.chartFingerprint === identity.chartFingerprint
    && value.inputHash === identity.inputHash
    && value.calculationVersion === identity.calculationVersion
    && value.promptVersion === NATAL_PERMANENT_FREE_PROMPT_VERSION
    && isNatalPermanentFreeReport(value.report);
}

export function readLocalHumanBaseReport(
  profile: UserProfile,
  chartId?: number,
  context: HumanBaseReportCacheContext = {},
): NatalPermanentFreeReport | null {
  const storage = getStorage();
  if (!storage || !profile.id) return null;
  try {
    const raw = storage.getItem(buildLocalHumanBaseReportCacheKey(profile, chartId, context));
    if (!raw) return null;
    const entry: unknown = JSON.parse(raw);
    if (!isValidEntry(entry, profile, chartId, context)) return null;
    return entry.report;
  } catch {
    return null;
  }
}

export function readLocalHumanBaseReportWithFallback(
  profile: UserProfile,
  chartId?: number,
  context: HumanBaseReportCacheContext = {},
): NatalPermanentFreeReport | null {
  const exact = readLocalHumanBaseReport(profile, chartId, context);
  if (exact || chartId == null || context.subjectType === 'saved_person') return exact;

  // Only the authenticated person's chart can transition from the unresolved
  // "primary" alias to its numeric ID during startup. A saved person's chart
  // must never inherit that primary report.
  return readLocalHumanBaseReport(profile, undefined, { ...context, subjectType: 'self' });
}

export function writeLocalHumanBaseReport(
  profile: UserProfile,
  report: NatalPermanentFreeReport,
  chartId?: number,
  context: HumanBaseReportCacheContext = {},
): void {
  const storage = getStorage();
  if (!storage || !profile.id || !report) return;
  const identity = resolveCacheIdentity(profile, chartId, context);
  if (context.subjectType === 'saved_person' && identity.subjectScope === 'self') return;
  const entry: LocalHumanBaseReportEntry = {
    schemaVersion: SCHEMA_VERSION,
    ...identity,
    promptVersion: NATAL_PERMANENT_FREE_PROMPT_VERSION,
    report,
    updatedAt: new Date().toISOString(),
  };
  try {
    storage.setItem(buildLocalHumanBaseReportCacheKey(profile, chartId, context), JSON.stringify(entry));
  } catch {
    // Local cache is an optional performance optimization; server persistence remains authoritative.
  }
}

export function clearLocalHumanBaseReport(
  profile: UserProfile,
  chartId?: number,
  context: HumanBaseReportCacheContext = {},
): void {
  const storage = getStorage();
  if (!storage || !profile.id) return;
  const identity = resolveCacheIdentity(profile, chartId, context);
  const prefix = [
    CACHE_PREFIX,
    keyPart(identity.ownerUserId),
    keyPart(identity.language),
    keyPart(identity.subjectScope),
    keyPart(identity.chartAlias),
    '',
  ].join(':');
  try {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (key?.startsWith(prefix)) storage.removeItem(key);
    }
  } catch {
    // Ignore unavailable/corrupted browser storage.
  }
}
