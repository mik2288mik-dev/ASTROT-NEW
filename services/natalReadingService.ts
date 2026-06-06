import type {
  NatalReadingAspects,
  NatalReadingDeepDive,
  NatalReadingDeepDiveKey,
  NatalReadingPortrait,
  NatalReadingToday,
  NatalReadingWeek,
} from '../lib/natalReading/types';
import type {
  ContentAccessTier,
  InterpretationSection,
  NatalChartData,
  NatalInterpretationReport,
  NatalStoryCardId,
  NatalStoryShareFormat,
  ProfileCard,
  UserProfile,
} from '../types';
import type {
  HumanDailySectionKey,
  HumanPaidSectionKey,
} from '../lib/natalHumanShared';
import {
  getRetryAfterMs,
  isGenerationInProgressError,
  waitMs,
} from '../lib/contentInterpretation';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import { getTelegramInitDataHeaders } from './sessionService';

const HUMAN_GENERATION_TIMEOUT_MS = 90_000;

type Endpoint = 'portrait' | 'aspects' | 'week' | 'today' | 'dive';

function buildUrl(endpoint: Endpoint, userId: string, chartId?: number, topic?: string): string {
  const params = new URLSearchParams({ userId });
  if (chartId) params.set('chartId', String(chartId));
  if (topic) params.set('topic', topic);
  return `/api/content/natal/${endpoint}?${params.toString()}`;
}

async function fetchOrGenerate<T>(
  endpoint: Endpoint,
  userId: string,
  chartId?: number,
  topic?: string
): Promise<T> {
  const url = buildUrl(endpoint, userId, chartId, topic);
  const tryGet = await fetch(url, { method: 'GET', headers: getTelegramInitDataHeaders() });
  if (tryGet.ok) {
    const j = await tryGet.json();
    return j.interpretation.content as T;
  }
  if (tryGet.status === 403) {
    const err = await tryGet.json().catch(() => ({}));
    throw new Error(err?.error || 'PREMIUM_REQUIRED');
  }
  // Trigger generation via POST
  const post = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() },
    body: JSON.stringify({ userId, chartId, topic }),
  });
  if (!post.ok) {
    const err = await post.json().catch(() => ({}));
    throw new Error(err?.error || `Failed (${post.status})`);
  }
  const j = await post.json();
  return j.interpretation.content as T;
}

export function loadPortrait(userId: string, chartId?: number) {
  return fetchOrGenerate<NatalReadingPortrait>('portrait', userId, chartId);
}

export function loadAspects(userId: string, chartId?: number) {
  return fetchOrGenerate<NatalReadingAspects>('aspects', userId, chartId);
}

export function loadWeek(userId: string, chartId?: number) {
  return fetchOrGenerate<NatalReadingWeek>('week', userId, chartId);
}

export function loadToday(userId: string, chartId?: number) {
  return fetchOrGenerate<NatalReadingToday>('today', userId, chartId);
}

export function loadDeepDive(
  userId: string,
  topic: NatalReadingDeepDiveKey,
  chartId?: number
) {
  return fetchOrGenerate<NatalReadingDeepDive>('dive', userId, chartId, topic);
}

type HumanEndpoint = 'human-base' | 'human-section' | 'human-daily';

export type HumanReadingResult<T> = {
  content: T;
  accessTier?: ContentAccessTier;
};

export type HumanReadingError = Error & {
  status?: number;
  code?: string;
  premiumAvailable?: boolean;
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

const baseReportCache = new Map<string, NatalInterpretationReport>();
const baseReportInFlight = new Map<string, Promise<NatalInterpretationReport>>();
const paidSectionCache = new Map<string, HumanReadingResult<InterpretationSection>>();
const paidSectionInFlight = new Map<string, Promise<HumanReadingResult<InterpretationSection>>>();
const dailySectionCache = new Map<string, HumanReadingResult<InterpretationSection>>();
const dailySectionInFlight = new Map<string, Promise<HumanReadingResult<InterpretationSection>>>();
const profileCardsCache = new Map<string, NatalProfileCardsResponse>();
const profileCardsInFlight = new Map<string, Promise<NatalProfileCardsResponse>>();

function chartKey(chartId?: number): string {
  return chartId != null ? String(chartId) : 'primary';
}

function baseKey(userId: string, chartId?: number): string {
  return `${userId}:${chartKey(chartId)}`;
}

function paidKey(userId: string, sectionKey: HumanPaidSectionKey, chartId?: number): string {
  return `${userId}:${chartKey(chartId)}:${sectionKey}`;
}

function dailyKey(userId: string, sectionKey: HumanDailySectionKey, chartId?: number, date?: string): string {
  return `${userId}:${chartKey(chartId)}:${date || 'today'}:${sectionKey}`;
}

function profileCardsKey(userId: string, chartId?: number, localHour?: number, todayText?: string | null): string {
  const hour = typeof localHour === 'number' && Number.isFinite(localHour) ? localHour : new Date().getHours();
  const dayPart = hour >= 18 ? 'evening' : 'day';
  const date = new Date().toISOString().slice(0, 10);
  return `${userId}:${chartKey(chartId)}:${date}:${dayPart}:${todayText || ''}`;
}

function clearMapByPrefix<T>(map: Map<string, T>, prefix: string): void {
  Array.from(map.keys()).forEach((key) => {
    if (key.startsWith(prefix)) map.delete(key);
  });
}

export function clearHumanReadingSessionCache(userId?: string, chartId?: number): void {
  if (!userId) {
    baseReportCache.clear();
    baseReportInFlight.clear();
    paidSectionCache.clear();
    paidSectionInFlight.clear();
    dailySectionCache.clear();
    dailySectionInFlight.clear();
    profileCardsCache.clear();
    profileCardsInFlight.clear();
    return;
  }

  if (chartId != null) {
    const exactBaseKey = baseKey(userId, chartId);
    baseReportCache.delete(exactBaseKey);
    baseReportInFlight.delete(exactBaseKey);
  } else {
    clearMapByPrefix(baseReportCache, `${userId}:`);
    clearMapByPrefix(baseReportInFlight, `${userId}:`);
  }

  const prefix = `${userId}:${chartId != null ? `${chartKey(chartId)}:` : ''}`;
  clearMapByPrefix(paidSectionCache, prefix);
  clearMapByPrefix(paidSectionInFlight, prefix);
  clearMapByPrefix(dailySectionCache, prefix);
  clearMapByPrefix(dailySectionInFlight, prefix);
  clearMapByPrefix(profileCardsCache, prefix);
  clearMapByPrefix(profileCardsInFlight, prefix);
}

export function getNatalProfileCardsCached(
  userId: string,
  chartId?: number,
  options?: { localHour?: number; todayText?: string | null }
): NatalProfileCardsResponse | null {
  return profileCardsCache.get(profileCardsKey(userId, chartId, options?.localHour, options?.todayText)) || null;
}

export function getHumanBaseReportCached(userId: string, chartId?: number): NatalInterpretationReport | null {
  return baseReportCache.get(baseKey(userId, chartId)) || null;
}

export function getHumanPaidSectionCached(
  userId: string,
  sectionKey: HumanPaidSectionKey,
  chartId?: number
): HumanReadingResult<InterpretationSection> | null {
  return paidSectionCache.get(paidKey(userId, sectionKey, chartId)) || null;
}

function buildHumanUrl(
  endpoint: HumanEndpoint,
  userId: string,
  options?: {
    chartId?: number;
    sectionKey?: HumanPaidSectionKey | HumanDailySectionKey;
    date?: string;
  }
) {
  const params = new URLSearchParams({ userId });
  if (options?.chartId) params.set('chartId', String(options.chartId));
  if (options?.sectionKey) params.set('sectionKey', options.sectionKey);
  if (options?.date) params.set('date', options.date);
  return `/api/content/natal/${endpoint}?${params.toString()}`;
}

function buildProfileCardsUrl(
  userId: string,
  options?: {
    chartId?: number;
    localHour?: number;
    todayText?: string | null;
  }
) {
  const params = new URLSearchParams({ userId });
  if (options?.chartId) params.set('chartId', String(options.chartId));
  if (typeof options?.localHour === 'number' && Number.isFinite(options.localHour)) {
    params.set('localHour', String(options.localHour));
  }
  if (options?.todayText) params.set('todayText', options.todayText);
  return `/api/content/natal/profile-cards?${params.toString()}`;
}

function buildProfileCardShareUrl(
  userId: string,
  cardId: NatalStoryCardId,
  options?: {
    chartId?: number;
    format?: NatalStoryShareFormat;
  }
) {
  const params = new URLSearchParams({ userId, cardId });
  if (options?.chartId) params.set('chartId', String(options.chartId));
  params.set('format', options?.format || 'story');
  return `/api/content/natal/profile-card-share?${params.toString()}`;
}

async function readHumanError(response: Response, fallback: string): Promise<HumanReadingError> {
  const payload = await response.json().catch(() => ({}));
  const err = new Error(payload.message || payload.error || fallback) as HumanReadingError;
  err.status = response.status;
  err.code = payload.code || payload.error;
  err.premiumAvailable = payload.premiumRequired === true || payload.premiumAvailable === true;
  return err;
}

function unwrapDailySectionPayload(payload: unknown): InterpretationSection | null {
  const interpretation = (payload as { interpretation?: unknown })?.interpretation;
  if (!interpretation || typeof interpretation !== 'object') return null;

  const record = interpretation as Record<string, unknown>;
  const wrapped = record.content;

  if (wrapped && typeof wrapped === 'object' && wrapped !== null) {
    const section = wrapped as InterpretationSection;
    if (typeof section.content === 'string' && section.content.trim()) {
      return section;
    }
  }

  if (typeof record.content === 'string' && record.content.trim() && typeof record.title === 'string') {
    return record as unknown as InterpretationSection;
  }

  return null;
}

async function postHuman<T>(
  endpoint: HumanEndpoint,
  userId: string,
  options?: {
    chartId?: number;
    sectionKey?: HumanPaidSectionKey | HumanDailySectionKey;
    date?: string;
    accessTier?: 'premium';
    profile?: UserProfile;
    chartData?: NatalChartData | null;
  }
): Promise<HumanReadingResult<T>> {
  const body: Record<string, unknown> = {
      userId,
      chartId: options?.chartId,
      sectionKey: options?.sectionKey,
      date: options?.date,
    };
  if (options?.accessTier) {
    body.accessTier = options.accessTier;
  }
  if (options?.profile) {
    body.profile = options.profile;
  }
  if (options?.chartData) {
    body.chartData = options.chartData;
  }
  const response = await fetchWithTimeout(
    buildHumanUrl(endpoint, userId, options),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() },
      body: JSON.stringify(body),
    },
    HUMAN_GENERATION_TIMEOUT_MS
  ).catch((error: unknown) => {
    if (error instanceof Error && error.name === 'AbortError') {
      const err = new Error('Request timed out') as HumanReadingError;
      err.code = 'TIMEOUT';
      err.status = 408;
      throw err;
    }
    throw error;
  });

  if (response.status === 202) {
    const payload = await response.json().catch(() => ({}));
    const err = await readHumanError(response, payload.message || 'Generation in progress');
    err.code = payload.code || 'GENERATION_IN_PROGRESS';
    err.status = 202;
    (err as HumanReadingError & { retryAfterMs?: number }).retryAfterMs = Number(payload.retryAfterMs || 1500);
    throw err;
  }

  if (!response.ok) {
    throw await readHumanError(response, `Failed (${response.status})`);
  }

  const payload = await response.json();
  if (endpoint === 'human-daily') {
    const section = unwrapDailySectionPayload(payload);
    if (!section) {
      const err = new Error('Interpretation content is empty') as HumanReadingError;
      err.code = 'EMPTY_INTERPRETATION';
      err.status = 502;
      throw err;
    }
    return {
      content: section as T,
      accessTier: payload.accessTier,
    };
  }

  const content = payload.interpretation?.content as T;
  const sectionText =
    content != null && typeof content === 'object' && content !== null && 'content' in content
      ? String((content as { content?: unknown }).content || '').trim()
      : typeof content === 'string'
        ? content.trim()
        : '';
  if (
    content == null ||
    (typeof content === 'string' && !sectionText) ||
    (typeof content === 'object' && content !== null && 'content' in content && !sectionText)
  ) {
    const err = new Error('Interpretation content is empty') as HumanReadingError;
    err.code = 'EMPTY_INTERPRETATION';
    err.status = 502;
    throw err;
  }

  return {
    content,
    accessTier: payload.accessTier,
  };
}

async function getHuman<T>(
  endpoint: HumanEndpoint,
  userId: string,
  options?: {
    chartId?: number;
    sectionKey?: HumanPaidSectionKey | HumanDailySectionKey;
    date?: string;
  }
): Promise<HumanReadingResult<T> | null> {
  const response = await fetch(buildHumanUrl(endpoint, userId, options), {
    method: 'GET',
    headers: getTelegramInitDataHeaders(),
    cache: 'no-store',
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw await readHumanError(response, `Failed (${response.status})`);
  }

  const payload = await response.json();
  if (endpoint === 'human-daily') {
    const section = unwrapDailySectionPayload(payload);
    if (!section) return null;
    return {
      content: section as T,
      accessTier: payload.accessTier,
    };
  }

  return {
    content: payload.interpretation?.content as T,
    accessTier: payload.accessTier,
  };
}

export async function getCachedHumanBaseReport(
  userId: string,
  chartId?: number
): Promise<NatalInterpretationReport | null> {
  const key = baseKey(userId, chartId);
  const memoryCached = baseReportCache.get(key);
  if (memoryCached) return memoryCached;

  const cached = await getHuman<NatalInterpretationReport>('human-base', userId, { chartId });
  if (!cached?.content) return null;
  baseReportCache.set(key, cached.content);
  return cached.content;
}

export async function ensureHumanBaseReport(
  userId: string,
  chartId?: number
): Promise<NatalInterpretationReport> {
  const key = baseKey(userId, chartId);
  const cached = await getCachedHumanBaseReport(userId, chartId);
  if (cached) return cached;

  const existing = baseReportInFlight.get(key);
  if (existing) return existing;

  const request = (async () => {
    const content = (await postHuman<NatalInterpretationReport>('human-base', userId, { chartId })).content;
    baseReportCache.set(key, content);
    return content;
  })().finally(() => {
    baseReportInFlight.delete(key);
  });

  baseReportInFlight.set(key, request);
  return request;
}

export async function loadHumanBaseReport(
  userId: string,
  chartId?: number
): Promise<NatalInterpretationReport> {
  return ensureHumanBaseReport(userId, chartId);
}

export function prefetchHumanBaseReport(userId: string, chartId?: number): Promise<NatalInterpretationReport> {
  return loadHumanBaseReport(userId, chartId);
}

export async function loadHumanPaidSection(
  userId: string,
  sectionKey: HumanPaidSectionKey,
  chartId?: number,
  options?: {
    accessTier?: 'premium';
  }
): Promise<HumanReadingResult<InterpretationSection>> {
  const key = paidKey(userId, sectionKey, chartId);
  const memoryCached = paidSectionCache.get(key);
  if (memoryCached?.content) return memoryCached;

  const existing = paidSectionInFlight.get(key);
  if (existing) return existing;

  const request = (async () => {
    const cached = await getHuman<InterpretationSection>('human-section', userId, { chartId, sectionKey });
    const result = cached?.content
      ? cached
      : await postHuman<InterpretationSection>('human-section', userId, {
          chartId,
          sectionKey,
          accessTier: options?.accessTier || 'premium',
        });
    paidSectionCache.set(key, result);
    return result;
  })().finally(() => {
    paidSectionInFlight.delete(key);
  });

  paidSectionInFlight.set(key, request);
  return request;
}

export async function getCachedHumanPaidSection(
  userId: string,
  sectionKey: HumanPaidSectionKey,
  chartId?: number
): Promise<HumanReadingResult<InterpretationSection> | null> {
  const key = paidKey(userId, sectionKey, chartId);
  const memoryCached = paidSectionCache.get(key);
  if (memoryCached?.content) return memoryCached;

  try {
    const cached = await getHuman<InterpretationSection>('human-section', userId, { chartId, sectionKey });
    if (cached?.content) {
      paidSectionCache.set(key, cached);
      return cached;
    }
    return null;
  } catch (error) {
    const err = error as HumanReadingError;
    if (err?.status === 404 || err?.status === 403 || err?.status === 409) {
      return null;
    }
    throw error;
  }
}

export async function ensureHumanDailySection(
  userId: string,
  sectionKey: HumanDailySectionKey,
  chartId?: number,
  date?: string,
  options?: {
    accessTier?: 'premium';
    maxInProgressRetries?: number;
    profile?: UserProfile;
    chartData?: NatalChartData | null;
  }
): Promise<HumanReadingResult<InterpretationSection>> {
  const retries = options?.maxInProgressRetries ?? 3;
  const cached = await getCachedHumanDailySection(userId, sectionKey, chartId, date);
  if (cached?.content?.content?.trim()) return cached;

  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const result = await postHuman<InterpretationSection>('human-daily', userId, {
        chartId,
        sectionKey,
        date,
        profile: options?.profile,
        chartData: options?.chartData,
        ...(sectionKey === 'daily_overview' ? {} : { accessTier: options?.accessTier || 'premium' }),
      });
      const key = dailyKey(userId, sectionKey, chartId, date);
      dailySectionCache.set(key, result);
      return result;
    } catch (error) {
      lastError = error;
      if (!isGenerationInProgressError(error) || attempt >= retries) {
        throw error;
      }
      await waitMs(getRetryAfterMs(error));
      const afterWait = await getCachedHumanDailySection(userId, sectionKey, chartId, date);
      if (afterWait?.content?.content?.trim()) {
        const key = dailyKey(userId, sectionKey, chartId, date);
        dailySectionCache.set(key, afterWait);
        return afterWait;
      }
    }
  }

  throw lastError;
}

export async function loadHumanDailySection(
  userId: string,
  sectionKey: HumanDailySectionKey,
  chartId?: number,
  date?: string,
  options?: {
    accessTier?: 'premium';
    maxInProgressRetries?: number;
    profile?: UserProfile;
    chartData?: NatalChartData | null;
  }
): Promise<HumanReadingResult<InterpretationSection>> {
  const key = dailyKey(userId, sectionKey, chartId, date);
  const memoryCached = dailySectionCache.get(key);
  if (memoryCached?.content?.content?.trim()) return memoryCached;

  const existing = dailySectionInFlight.get(key);
  if (existing) return existing;

  const request = ensureHumanDailySection(userId, sectionKey, chartId, date, options).finally(() => {
    dailySectionInFlight.delete(key);
  });

  dailySectionInFlight.set(key, request);
  return request;
}

export async function getCachedHumanDailySection(
  userId: string,
  sectionKey: HumanDailySectionKey,
  chartId?: number,
  date?: string
): Promise<HumanReadingResult<InterpretationSection> | null> {
  const key = dailyKey(userId, sectionKey, chartId, date);
  const memoryCached = dailySectionCache.get(key);
  if (memoryCached?.content) return memoryCached;

  try {
    const cached = await getHuman<InterpretationSection>('human-daily', userId, { chartId, sectionKey, date });
    if (cached?.content) {
      dailySectionCache.set(key, cached);
      return cached;
    }
    return null;
  } catch (error) {
    const err = error as HumanReadingError;
    if (err?.status === 404 || err?.status === 409 || err?.status === 403) {
      return null;
    }
    throw error;
  }
}

export async function loadNatalProfileCards(
  userId: string,
  chartId?: number,
  options?: {
    localHour?: number;
    todayText?: string | null;
  }
): Promise<NatalProfileCardsResponse> {
  const key = profileCardsKey(userId, chartId, options?.localHour, options?.todayText);
  const cached = profileCardsCache.get(key);
  if (cached) return cached;

  const existing = profileCardsInFlight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const response = await fetch(buildProfileCardsUrl(userId, { chartId, ...options }), {
      method: 'GET',
      headers: getTelegramInitDataHeaders(),
      cache: 'no-store',
    });
    if (!response.ok) {
      throw await readHumanError(response, `Failed (${response.status})`);
    }
    const payload = await response.json() as NatalProfileCardsResponse;
    profileCardsCache.set(key, payload);
    return payload;
  })();

  profileCardsInFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    profileCardsInFlight.delete(key);
  }
}

export async function loadNatalStoryShareImage(
  userId: string,
  cardId: NatalStoryCardId,
  chartId?: number,
  format: NatalStoryShareFormat = 'story'
): Promise<Blob> {
  const response = await fetch(buildProfileCardShareUrl(userId, cardId, { chartId, format }), {
    method: 'GET',
    headers: getTelegramInitDataHeaders(),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw await readHumanError(response, `Failed (${response.status})`);
  }
  return response.blob();
}
