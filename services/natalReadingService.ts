import type {
  ContentAccessTier,
  InterpretationSection,
  NatalInterpretationReport,
  NatalStoryCardId,
  NatalStoryShareFormat,
  ProfileCard,
} from '../types';
import type { HumanPaidSectionKey } from '../lib/natalHumanShared';
import { getTelegramInitDataHeaders } from './sessionService';
import { apiFetch } from './apiClient';

const HUMAN_GENERATION_TIMEOUT_MS = 90_000;
type HumanEndpoint = 'human-base' | 'human-section';

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

const baseReportCache = new Map<string, NatalInterpretationReport>();
const baseReportInFlight = new Map<string, Promise<NatalInterpretationReport>>();
const paidSectionCache = new Map<string, HumanReadingResult<InterpretationSection>>();
const paidSectionInFlight = new Map<string, Promise<HumanReadingResult<InterpretationSection>>>();
const profileCardsCache = new Map<string, NatalProfileCardsResponse>();
const profileCardsInFlight = new Map<string, Promise<NatalProfileCardsResponse>>();

function chartKey(chartId?: number): string {
  return chartId != null ? String(chartId) : 'primary';
}

function baseKey(userId: string, chartId?: number): string {
  return `${userId}:${chartKey(chartId)}`;
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
    paidSectionCache.clear();
    paidSectionInFlight.clear();
    profileCardsCache.clear();
    profileCardsInFlight.clear();
    return;
  }
  if (chartId != null) {
    baseReportCache.delete(baseKey(userId, chartId));
    baseReportInFlight.delete(baseKey(userId, chartId));
  } else {
    clearMapByPrefix(baseReportCache, `${userId}:`);
    clearMapByPrefix(baseReportInFlight, `${userId}:`);
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
): NatalInterpretationReport | null {
  return baseReportCache.get(baseKey(userId, chartId)) || null;
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
  if (!response.ok) throw await readHumanError(response, `Failed (${response.status})`);
  return ensureContent<T>(await response.json());
}

export async function getCachedHumanBaseReport(
  userId: string,
  chartId?: number,
): Promise<NatalInterpretationReport | null> {
  const key = baseKey(userId, chartId);
  const memory = baseReportCache.get(key);
  if (memory) return memory;
  const cached = await getHuman<NatalInterpretationReport>('human-base', userId, { chartId });
  if (!cached) return null;
  baseReportCache.set(key, cached.content);
  return cached.content;
}

export async function ensureHumanBaseReport(
  userId: string,
  chartId?: number,
): Promise<NatalInterpretationReport> {
  const key = baseKey(userId, chartId);
  const cached = await getCachedHumanBaseReport(userId, chartId);
  if (cached) return cached;
  const existing = baseReportInFlight.get(key);
  if (existing) return existing;
  const request = postHuman<NatalInterpretationReport>('human-base', userId, { chartId })
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

export const loadHumanBaseReport = ensureHumanBaseReport;
export const prefetchHumanBaseReport = ensureHumanBaseReport;

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
