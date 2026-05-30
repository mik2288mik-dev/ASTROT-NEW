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
  NatalInterpretationReport,
  NatalStoryCardId,
  NatalStoryShareFormat,
  ProfileCard,
} from '../types';
import type {
  HumanDailySectionKey,
  HumanPaidSectionKey,
} from '../lib/natalHumanShared';

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
  const tryGet = await fetch(url, { method: 'GET' });
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
    headers: { 'Content-Type': 'application/json' },
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
  err.code = payload.code;
  err.premiumAvailable = payload.premiumRequired === true || payload.premiumAvailable === true;
  return err;
}

async function postHuman<T>(
  endpoint: HumanEndpoint,
  userId: string,
  options?: {
    chartId?: number;
    sectionKey?: HumanPaidSectionKey | HumanDailySectionKey;
    date?: string;
    accessTier?: 'premium';
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
  const response = await fetch(buildHumanUrl(endpoint, userId, options), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw await readHumanError(response, `Failed (${response.status})`);
  }

  const payload = await response.json();
  return {
    content: payload.interpretation?.content as T,
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
    cache: 'no-store',
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw await readHumanError(response, `Failed (${response.status})`);
  }

  const payload = await response.json();
  return {
    content: payload.interpretation?.content as T,
    accessTier: payload.accessTier,
  };
}

export async function loadHumanBaseReport(
  userId: string,
  chartId?: number
): Promise<NatalInterpretationReport> {
  const key = baseKey(userId, chartId);
  const memoryCached = baseReportCache.get(key);
  if (memoryCached) return memoryCached;

  const existing = baseReportInFlight.get(key);
  if (existing) return existing;

  const request = (async () => {
    const cached = await getHuman<NatalInterpretationReport>('human-base', userId, { chartId });
    const content = cached?.content || (await postHuman<NatalInterpretationReport>('human-base', userId, { chartId })).content;
    baseReportCache.set(key, content);
    return content;
  })().finally(() => {
    baseReportInFlight.delete(key);
  });

  baseReportInFlight.set(key, request);
  return request;
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

export async function loadHumanDailySection(
  userId: string,
  sectionKey: HumanDailySectionKey,
  chartId?: number,
  date?: string,
  options?: {
    accessTier?: 'premium';
  }
): Promise<HumanReadingResult<InterpretationSection>> {
  const key = dailyKey(userId, sectionKey, chartId, date);
  const memoryCached = dailySectionCache.get(key);
  if (memoryCached?.content) return memoryCached;

  const existing = dailySectionInFlight.get(key);
  if (existing) return existing;

  const request = (async () => {
    const cached = await getHuman<InterpretationSection>('human-daily', userId, { chartId, sectionKey, date });
    const result = cached?.content
      ? cached
        : await postHuman<InterpretationSection>('human-daily', userId, {
            chartId,
            sectionKey,
            date,
            ...(sectionKey === 'daily_overview' ? {} : { accessTier: options?.accessTier || 'premium' }),
          });
    dailySectionCache.set(key, result);
    return result;
  })().finally(() => {
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
  try {
    return await getHuman<InterpretationSection>('human-daily', userId, { chartId, sectionKey, date });
  } catch (error) {
    const err = error as HumanReadingError;
    if (err?.status === 403 || err?.status === 404 || err?.status === 409) {
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
    cache: 'no-store',
  });
  if (!response.ok) {
    throw await readHumanError(response, `Failed (${response.status})`);
  }
  return response.blob();
}
