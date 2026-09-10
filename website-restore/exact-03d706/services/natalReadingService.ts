import type {
  ContentAccessTier,
  InterpretationSection,
  NatalStoryCardId,
  NatalStoryShareFormat,
  ProfileCard,
} from '../types';
import type { HumanPaidSectionKey } from '../lib/natalHumanShared';
import type {
  NatalPermanentFreeReport,
  NatalPermanentPremiumReport,
} from '../lib/natalReading/permanentReport';
import {
  buildNatalReportScopeKey,
  isNatalPermanentPremiumReport,
} from '../lib/natalReading/permanentReport';
import type { NatalReadingLanguage } from '../lib/natalReading/permanentReport';
import type { NatalQuestionSnapshot } from '../lib/natalReading/natalQuestion';
import { getTelegramInitDataHeaders } from './sessionService';
import { apiFetch } from './apiClient';

const HUMAN_GENERATION_TIMEOUT_MS = 90_000;
const LOCAL_PREMIUM_CACHE_PREFIX = 'lumia:natal-human-premium:v1';
const LOCAL_PREMIUM_CACHE_LIMIT = 12;
type HumanEndpoint = 'human-base' | 'human-premium' | 'human-section';

export type HumanReadingResult<T> = {
  content: T;
  accessTier?: ContentAccessTier;
};

export type HumanReadingError = Error & {
  status?: number;
  code?: string;
  premiumAvailable?: boolean;
  retryAfterMs?: number;
};

export type NatalProfileCardsResponse = {
  profileCards: ProfileCard[];
  meta?: {
    version?: string;
    mapperVersion?: string;
    chartId?: number | null;
    generatedAt?: string;
    isPremium?: boolean;
  };
};

const baseReportCache = new Map<string, NatalPermanentFreeReport>();
const baseReportInFlight = new Map<string, Promise<NatalPermanentFreeReport>>();
const premiumReportCache = new Map<string, HumanReadingResult<NatalPermanentPremiumReport>>();
const premiumReportInFlight = new Map<string, Promise<HumanReadingResult<NatalPermanentPremiumReport>>>();
const paidSectionCache = new Map<string, HumanReadingResult<InterpretationSection>>();
const paidSectionInFlight = new Map<string, Promise<HumanReadingResult<InterpretationSection>>>();
const profileCardsCache = new Map<string, NatalProfileCardsResponse>();
const profileCardsInFlight = new Map<string, Promise<NatalProfileCardsResponse>>();

type LocalPremiumReportEntry = {
  schemaVersion: 1;
  scopeKey: string;
  report: NatalPermanentPremiumReport;
  updatedAt: string;
};

export type NatalReportCacheIdentity = {
  chartFingerprint: string;
  reportVersion: string;
};

function chartKey(chartId?: number): string {
  return chartId != null ? String(chartId) : 'primary';
}

function baseKey(
  userId: string,
  chartId?: number,
  language?: NatalReadingLanguage,
  cacheIdentity?: NatalReportCacheIdentity,
): string {
  return buildNatalReportScopeKey(userId, chartId, language, cacheIdentity);
}

function localPremiumStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function localPremiumKey(scopeKey: string): string {
  return `${LOCAL_PREMIUM_CACHE_PREFIX}:${encodeURIComponent(scopeKey)}`;
}

function readLocalPremiumReport(scopeKey: string): NatalPermanentPremiumReport | null {
  const storage = localPremiumStorage();
  if (!storage) return null;
  const key = localPremiumKey(scopeKey);
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Partial<LocalPremiumReportEntry>;
    if (
      entry.schemaVersion !== 1
      || entry.scopeKey !== scopeKey
      || !isNatalPermanentPremiumReport(entry.report)
    ) {
      storage.removeItem(key);
      return null;
    }
    return entry.report;
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // Ignore cleanup failures; the invalid cache is never returned.
    }
    return null;
  }
}

function writeLocalPremiumReport(
  scopeKey: string,
  report: NatalPermanentPremiumReport,
): void {
  const storage = localPremiumStorage();
  if (!storage || !isNatalPermanentPremiumReport(report)) return;
  try {
    const entry: LocalPremiumReportEntry = {
      schemaVersion: 1,
      scopeKey,
      report,
      updatedAt: new Date().toISOString(),
    };
    storage.setItem(localPremiumKey(scopeKey), JSON.stringify(entry));

    const entries: Array<{ key: string; updatedAt: string }> = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key?.startsWith(`${LOCAL_PREMIUM_CACHE_PREFIX}:`)) continue;
      const cached = JSON.parse(storage.getItem(key) || '{}') as Partial<LocalPremiumReportEntry>;
      entries.push({ key, updatedAt: String(cached.updatedAt || '') });
    }
    entries
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(LOCAL_PREMIUM_CACHE_LIMIT)
      .forEach(({ key }) => storage.removeItem(key));
  } catch {
    // Local persistence is a speed/offline layer. The server remains authoritative.
  }
}

function requireValidPremiumReport(
  result: HumanReadingResult<NatalPermanentPremiumReport>,
): HumanReadingResult<NatalPermanentPremiumReport> {
  if (isNatalPermanentPremiumReport(result.content)) return result;
  const error = new Error('Premium natal report is incomplete') as HumanReadingError;
  error.code = 'NATAL_PREMIUM_REPORT_INCOMPLETE';
  error.status = 502;
  throw error;
}

function paidKey(
  userId: string,
  sectionKey: HumanPaidSectionKey,
  chartId?: number,
): string {
  return `${userId}:${chartKey(chartId)}:${sectionKey}`;
}

function profileCardsKey(
  userId: string,
  chartId?: number,
  localHour?: number,
  todayText?: string | null,
): string {
  const hour = typeof localHour === 'number' && Number.isFinite(localHour)
    ? localHour
    : new Date().getHours();
  const dayPart = hour >= 18 ? 'evening' : 'day';
  return `${userId}:${chartKey(chartId)}:${new Date().toISOString().slice(0, 10)}:${dayPart}:${todayText || ''}`;
}

function clearMapByPrefix<T>(map: Map<string, T>, prefix: string): void {
  for (const key of map.keys()) {
    if (key.startsWith(prefix)) map.delete(key);
  }
}

export function clearHumanReadingSessionCache(
  userId?: string,
  chartId?: number,
): void {
  if (!userId) {
    baseReportCache.clear();
    baseReportInFlight.clear();
    premiumReportCache.clear();
    premiumReportInFlight.clear();
    paidSectionCache.clear();
    paidSectionInFlight.clear();
    profileCardsCache.clear();
    profileCardsInFlight.clear();
    return;
  }
  if (chartId != null) {
    const reportPrefix = `${userId}:${chartKey(chartId)}:`;
    clearMapByPrefix(baseReportCache, reportPrefix);
    clearMapByPrefix(baseReportInFlight, reportPrefix);
    clearMapByPrefix(premiumReportCache, reportPrefix);
    clearMapByPrefix(premiumReportInFlight, reportPrefix);
  } else {
    clearMapByPrefix(baseReportCache, `${userId}:`);
    clearMapByPrefix(baseReportInFlight, `${userId}:`);
    clearMapByPrefix(premiumReportCache, `${userId}:`);
    clearMapByPrefix(premiumReportInFlight, `${userId}:`);
  }
  const prefix = `${userId}:${chartId != null ? `${chartKey(chartId)}:` : ''}`;
  clearMapByPrefix(paidSectionCache, prefix);
  clearMapByPrefix(paidSectionInFlight, prefix);
  clearMapByPrefix(profileCardsCache, prefix);
  clearMapByPrefix(profileCardsInFlight, prefix);
}

export function getNatalProfileCardsCached(
  userId: string,
  chartId?: number,
  options?: { localHour?: number; todayText?: string | null },
): NatalProfileCardsResponse | null {
  return profileCardsCache.get(
    profileCardsKey(userId, chartId, options?.localHour, options?.todayText),
  ) || null;
}

export function getHumanBaseReportCached(
  userId: string,
  chartId?: number,
  language?: 'ru' | 'en',
  cacheIdentity?: NatalReportCacheIdentity,
): NatalPermanentFreeReport | null {
  return baseReportCache.get(baseKey(userId, chartId, language, cacheIdentity)) || null;
}

export function getHumanPremiumReportCached(
  userId: string,
  chartId?: number,
  language?: 'ru' | 'en',
  cacheIdentity?: NatalReportCacheIdentity,
): HumanReadingResult<NatalPermanentPremiumReport> | null {
  const key = baseKey(userId, chartId, language, cacheIdentity);
  const memory = premiumReportCache.get(key);
  if (memory) return memory;
  const local = readLocalPremiumReport(key);
  if (!local) return null;
  const result: HumanReadingResult<NatalPermanentPremiumReport> = {
    content: local,
    accessTier: 'premium',
  };
  premiumReportCache.set(key, result);
  return result;
}

export function getHumanPaidSectionCached(
  userId: string,
  sectionKey: HumanPaidSectionKey,
  chartId?: number,
): HumanReadingResult<InterpretationSection> | null {
  return paidSectionCache.get(paidKey(userId, sectionKey, chartId)) || null;
}

function buildHumanUrl(
  endpoint: HumanEndpoint,
  userId: string,
  options?: { chartId?: number; sectionKey?: HumanPaidSectionKey },
): string {
  const params = new URLSearchParams({ userId });
  if (options?.chartId != null) params.set('chartId', String(options.chartId));
  if (options?.sectionKey) params.set('sectionKey', options.sectionKey);
  return `/api/content/natal/${endpoint}?${params.toString()}`;
}

function buildProfileCardsUrl(
  userId: string,
  options?: { chartId?: number; localHour?: number; todayText?: string | null },
): string {
  const params = new URLSearchParams({ userId });
  if (options?.chartId != null) params.set('chartId', String(options.chartId));
  if (typeof options?.localHour === 'number' && Number.isFinite(options.localHour)) {
    params.set('localHour', String(options.localHour));
  }
  if (options?.todayText) params.set('todayText', options.todayText);
  return `/api/content/natal/profile-cards?${params.toString()}`;
}

function buildProfileCardShareUrl(
  userId: string,
  cardId: NatalStoryCardId,
  options?: { chartId?: number; format?: NatalStoryShareFormat },
): string {
  const params = new URLSearchParams({ userId, cardId });
  if (options?.chartId != null) params.set('chartId', String(options.chartId));
  params.set('format', options?.format || 'story');
  return `/api/content/natal/profile-card-share?${params.toString()}`;
}

async function readHumanError(
  response: Response,
  fallback: string,
): Promise<HumanReadingError> {
  const payload = await response.json().catch(() => ({}));
  const error = new Error(payload.message || payload.error || fallback) as HumanReadingError;
  error.status = response.status;
  error.code = payload.code || payload.error;
  error.premiumAvailable = payload.premiumRequired === true
    || payload.premiumAvailable === true;
  error.retryAfterMs = Number(payload.retryAfterMs) || undefined;
  return error;
}

function ensureContent<T>(payload: any): HumanReadingResult<T> {
  const content = payload?.interpretation?.content as T;
  if (content == null) {
    const error = new Error('Interpretation content is empty') as HumanReadingError;
    error.code = 'EMPTY_INTERPRETATION';
    error.status = 502;
    throw error;
  }
  return { content, accessTier: payload.accessTier };
}

async function getHuman<T>(
  endpoint: HumanEndpoint,
  userId: string,
  options?: { chartId?: number; sectionKey?: HumanPaidSectionKey },
): Promise<HumanReadingResult<T> | null> {
  const response = await apiFetch(buildHumanUrl(endpoint, userId, options), {
    method: 'GET',
    headers: getTelegramInitDataHeaders(),
    cache: 'no-store',
  });
  if (response.status === 404) return null;
  if (!response.ok) throw await readHumanError(response, `Failed (${response.status})`);
  return ensureContent<T>(await response.json());
}

async function postHuman<T>(
  endpoint: HumanEndpoint,
  userId: string,
  options?: {
    chartId?: number;
    sectionKey?: HumanPaidSectionKey;
    accessTier?: 'premium';
  },
): Promise<HumanReadingResult<T>> {
  const startedAt = Date.now();
  const response = await apiFetch(buildHumanUrl(endpoint, userId, options), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getTelegramInitDataHeaders(),
    },
    body: JSON.stringify({
      userId,
      chartId: options?.chartId,
      sectionKey: options?.sectionKey,
      accessTier: options?.accessTier,
    }),
  }, HUMAN_GENERATION_TIMEOUT_MS);
  if (response.status === 202) {
    const pending = await response.json().catch(() => ({}));
    let retryAfterMs = Math.max(250, Math.min(Number(pending.retryAfterMs) || 1000, 5000));
    while (Date.now() - startedAt < HUMAN_GENERATION_TIMEOUT_MS) {
      await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
      const cached = await getHuman<T>(endpoint, userId, options);
      if (cached) return cached;
      retryAfterMs = Math.min(Math.round(retryAfterMs * 1.35), 5000);
    }
    const error = new Error('Content generation is still in progress') as HumanReadingError;
    error.code = 'CONTENT_GENERATION_TIMEOUT';
    error.status = 504;
    error.retryAfterMs = retryAfterMs;
    throw error;
  }
  if (!response.ok) throw await readHumanError(response, `Failed (${response.status})`);
  return ensureContent<T>(await response.json());
}

export async function getCachedHumanBaseReport(
  userId: string,
  chartId?: number,
  language?: 'ru' | 'en',
  cacheIdentity?: NatalReportCacheIdentity,
): Promise<NatalPermanentFreeReport | null> {
  const key = baseKey(userId, chartId, language, cacheIdentity);
  const memory = baseReportCache.get(key);
  if (memory) return memory;
  const cached = await getHuman<NatalPermanentFreeReport>('human-base', userId, { chartId });
  if (!cached) return null;
  baseReportCache.set(key, cached.content);
  return cached.content;
}

export async function ensureHumanBaseReport(
  userId: string,
  chartId?: number,
  language?: 'ru' | 'en',
  cacheIdentity?: NatalReportCacheIdentity,
): Promise<NatalPermanentFreeReport> {
  const key = baseKey(userId, chartId, language, cacheIdentity);
  const cached = await getCachedHumanBaseReport(userId, chartId, language, cacheIdentity);
  if (cached) return cached;
  const existing = baseReportInFlight.get(key);
  if (existing) return existing;
  const request = postHuman<NatalPermanentFreeReport>('human-base', userId, { chartId })
    .then((result) => {
      baseReportCache.set(key, result.content);
      return result.content;
    })
    .finally(() => {
      if (baseReportInFlight.get(key) === request) baseReportInFlight.delete(key);
    });
  baseReportInFlight.set(key, request);
  return request;
}

function buildNatalQuestionsUrl(userId: string, chartId?: number): string {
  const params = new URLSearchParams({ userId });
  if (chartId != null) params.set('chartId', String(chartId));
  return `/api/content/natal/questions?${params.toString()}`;
}

export const loadHumanBaseReport = ensureHumanBaseReport;
export const prefetchHumanBaseReport = ensureHumanBaseReport;

export async function getCachedHumanPremiumReport(
  userId: string,
  chartId?: number,
  language?: 'ru' | 'en',
  cacheIdentity?: NatalReportCacheIdentity,
): Promise<HumanReadingResult<NatalPermanentPremiumReport> | null> {
  const key = baseKey(userId, chartId, language, cacheIdentity);
  const memory = premiumReportCache.get(key);
  if (memory) return memory;
  const local = readLocalPremiumReport(key);
  if (local) {
    const localResult: HumanReadingResult<NatalPermanentPremiumReport> = {
      content: local,
      accessTier: 'premium',
    };
    premiumReportCache.set(key, localResult);
    return localResult;
  }
  try {
    const cached = await getHuman<NatalPermanentPremiumReport>(
      'human-premium',
      userId,
      { chartId },
    );
    if (cached) {
      const valid = requireValidPremiumReport(cached);
      premiumReportCache.set(key, valid);
      writeLocalPremiumReport(key, valid.content);
      return valid;
    }
    return null;
  } catch (error) {
    const status = (error as HumanReadingError).status;
    const code = (error as HumanReadingError).code;
    if (code === 'NATAL_PREMIUM_REPORT_INCOMPLETE') return null;
    if (status === 403 || status === 404 || status === 409) return null;
    throw error;
  }
}

export async function ensureHumanPremiumReport(
  userId: string,
  chartId?: number,
  language?: 'ru' | 'en',
  cacheIdentity?: NatalReportCacheIdentity,
): Promise<HumanReadingResult<NatalPermanentPremiumReport>> {
  const key = baseKey(userId, chartId, language, cacheIdentity);
  const cached = await getCachedHumanPremiumReport(userId, chartId, language, cacheIdentity);
  if (cached) return cached;
  const existing = premiumReportInFlight.get(key);
  if (existing) return existing;
  const request = postHuman<NatalPermanentPremiumReport>('human-premium', userId, {
    chartId,
    accessTier: 'premium',
  }).then((result) => {
    const valid = requireValidPremiumReport(result);
    premiumReportCache.set(key, valid);
    writeLocalPremiumReport(key, valid.content);
    return valid;
  }).finally(() => {
    if (premiumReportInFlight.get(key) === request) premiumReportInFlight.delete(key);
  });
  premiumReportInFlight.set(key, request);
  return request;
}

export async function loadNatalQuestionSnapshot(
  userId: string,
  chartId?: number,
): Promise<NatalQuestionSnapshot> {
  const response = await apiFetch(buildNatalQuestionsUrl(userId, chartId), {
    method: 'GET',
    headers: getTelegramInitDataHeaders(),
    cache: 'no-store',
  });
  if (!response.ok) throw await readHumanError(response, `Failed (${response.status})`);
  return response.json() as Promise<NatalQuestionSnapshot>;
}

export async function askNatalQuestion(
  userId: string,
  question: string,
  chartId?: number,
): Promise<NatalQuestionSnapshot> {
  const startedAt = Date.now();
  const response = await apiFetch(buildNatalQuestionsUrl(userId, chartId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getTelegramInitDataHeaders(),
    },
    body: JSON.stringify({ userId, chartId, question }),
  }, HUMAN_GENERATION_TIMEOUT_MS);
  if (response.status === 202) {
    const pending = await response.json().catch(() => ({}));
    let retryAfterMs = Math.max(250, Math.min(Number(pending.retryAfterMs) || 1000, 5000));
    while (Date.now() - startedAt < HUMAN_GENERATION_TIMEOUT_MS) {
      await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
      const current = await loadNatalQuestionSnapshot(userId, chartId);
      const target = [...current.messages].reverse().find((message) => (
        message.role === 'user'
        && message.text.trim().toLocaleLowerCase() === question.trim().toLocaleLowerCase()
      ));
      const answered = target && current.messages.some((message) => (
        message.role === 'assistant'
        && String(message.payload?.questionMessageId || '') === String(target.id)
      ));
      if (answered) return current;
      retryAfterMs = Math.min(Math.round(retryAfterMs * 1.35), 5000);
    }
    const error = new Error('Question generation is still in progress') as HumanReadingError;
    error.code = 'CONTENT_GENERATION_TIMEOUT';
    error.status = 504;
    error.retryAfterMs = retryAfterMs;
    throw error;
  }
  if (!response.ok) throw await readHumanError(response, `Failed (${response.status})`);
  return response.json() as Promise<NatalQuestionSnapshot>;
}

export async function getCachedHumanPaidSection(
  userId: string,
  sectionKey: HumanPaidSectionKey,
  chartId?: number,
): Promise<HumanReadingResult<InterpretationSection> | null> {
  const key = paidKey(userId, sectionKey, chartId);
  const memory = paidSectionCache.get(key);
  if (memory) return memory;
  try {
    const cached = await getHuman<InterpretationSection>(
      'human-section',
      userId,
      { chartId, sectionKey },
    );
    if (cached) paidSectionCache.set(key, cached);
    return cached;
  } catch (error) {
    const status = (error as HumanReadingError).status;
    if (status === 403 || status === 404 || status === 409) return null;
    throw error;
  }
}

export async function loadHumanPaidSection(
  userId: string,
  sectionKey: HumanPaidSectionKey,
  chartId?: number,
  options?: { accessTier?: 'premium' },
): Promise<HumanReadingResult<InterpretationSection>> {
  const key = paidKey(userId, sectionKey, chartId);
  const cached = await getCachedHumanPaidSection(userId, sectionKey, chartId);
  if (cached) return cached;
  const existing = paidSectionInFlight.get(key);
  if (existing) return existing;
  const request = postHuman<InterpretationSection>('human-section', userId, {
    chartId,
    sectionKey,
    accessTier: options?.accessTier || 'premium',
  }).then((result) => {
    paidSectionCache.set(key, result);
    return result;
  }).finally(() => {
    if (paidSectionInFlight.get(key) === request) paidSectionInFlight.delete(key);
  });
  paidSectionInFlight.set(key, request);
  return request;
}

export async function loadNatalProfileCards(
  userId: string,
  chartId?: number,
  options?: { localHour?: number; todayText?: string | null },
): Promise<NatalProfileCardsResponse> {
  const key = profileCardsKey(userId, chartId, options?.localHour, options?.todayText);
  const cached = profileCardsCache.get(key);
  if (cached) return cached;
  const existing = profileCardsInFlight.get(key);
  if (existing) return existing;
  const request = apiFetch(buildProfileCardsUrl(userId, { chartId, ...options }), {
    method: 'GET',
    headers: getTelegramInitDataHeaders(),
    cache: 'no-store',
  }).then(async (response) => {
    if (!response.ok) throw await readHumanError(response, `Failed (${response.status})`);
    const payload = await response.json() as NatalProfileCardsResponse;
    profileCardsCache.set(key, payload);
    return payload;
  }).finally(() => {
    if (profileCardsInFlight.get(key) === request) profileCardsInFlight.delete(key);
  });
  profileCardsInFlight.set(key, request);
  return request;
}

export async function loadNatalStoryShareImage(
  userId: string,
  cardId: NatalStoryCardId,
  chartId?: number,
  format: NatalStoryShareFormat = 'story',
): Promise<Blob> {
  const response = await apiFetch(
    buildProfileCardShareUrl(userId, cardId, { chartId, format }),
    {
      method: 'GET',
      headers: getTelegramInitDataHeaders(),
      cache: 'no-store',
    },
  );
  if (!response.ok) throw await readHumanError(response, `Failed (${response.status})`);
  return response.blob();
}
