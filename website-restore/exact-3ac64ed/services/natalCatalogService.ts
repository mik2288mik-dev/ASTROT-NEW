import {
  getNatalReportAnswer,
  isNatalReportAnswer,
  isNatalReportCategoryPack,
  NATAL_REPORT_CATALOG_CONTRACT_VERSION,
  type NatalReportAnswer,
  type NatalReportAnswerKey,
  type NatalReportCategoryKey,
  type NatalReportCategoryPack,
} from '../lib/natalReading/reportCatalog';
import { apiFetch } from './apiClient';
import { getTelegramInitDataHeaders } from './sessionService';

const CATALOG_GENERATION_TIMEOUT_MS = 90_000;
const LOCAL_CATALOG_CACHE_PREFIX = 'nebo:natal-report-catalog:v1';
const LOCAL_CATALOG_CACHE_LIMIT = 80;

export type NatalCatalogCacheIdentity = {
  chartFingerprint: string;
  reportVersion: string;
};

export type NatalCatalogError = Error & {
  status?: number;
  code?: string;
  premiumAvailable?: boolean;
  retryAfterMs?: number;
};

type LocalCatalogEntry = {
  schemaVersion: 1;
  scopeKey: string;
  kind: 'category' | 'answer';
  content: NatalReportCategoryPack | NatalReportAnswer;
  updatedAt: string;
};

const categoryCache = new Map<string, NatalReportCategoryPack>();
const categoryInFlight = new Map<string, Promise<NatalReportCategoryPack>>();
const answerCache = new Map<string, NatalReportAnswer>();
const answerInFlight = new Map<string, Promise<NatalReportAnswer>>();

function languageKey(language?: 'ru' | 'en'): 'ru' | 'en' {
  return language === 'en' ? 'en' : 'ru';
}

function scopeKey(input: {
  userId: string;
  chartId?: number;
  language?: 'ru' | 'en';
  cacheIdentity?: NatalCatalogCacheIdentity;
  kind: 'category' | 'answer';
  itemKey: NatalReportCategoryKey | NatalReportAnswerKey;
}): string {
  const chart = input.chartId != null ? String(input.chartId) : 'primary';
  const fingerprint = String(
    input.cacheIdentity?.chartFingerprint || 'chart-unresolved',
  ).trim() || 'chart-unresolved';
  const reportVersion = String(
    input.cacheIdentity?.reportVersion || NATAL_REPORT_CATALOG_CONTRACT_VERSION,
  ).trim() || NATAL_REPORT_CATALOG_CONTRACT_VERSION;
  return [
    String(input.userId || '').trim(),
    chart,
    languageKey(input.language),
    fingerprint,
    reportVersion,
    NATAL_REPORT_CATALOG_CONTRACT_VERSION,
    input.kind,
    input.itemKey,
  ].join(':');
}

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function storageKey(key: string): string {
  return `${LOCAL_CATALOG_CACHE_PREFIX}:${encodeURIComponent(key)}`;
}

function readLocal<T extends NatalReportCategoryPack | NatalReportAnswer>(
  key: string,
  kind: LocalCatalogEntry['kind'],
  validate: (value: unknown) => value is T,
): T | null {
  const localStorage = storage();
  if (!localStorage) return null;
  const keyInStorage = storageKey(key);
  try {
    const raw = localStorage.getItem(keyInStorage);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Partial<LocalCatalogEntry>;
    if (
      entry.schemaVersion !== 1
      || entry.scopeKey !== key
      || entry.kind !== kind
      || !validate(entry.content)
    ) {
      localStorage.removeItem(keyInStorage);
      return null;
    }
    return entry.content;
  } catch {
    try {
      localStorage.removeItem(keyInStorage);
    } catch {
      // Invalid local content is ignored; the server remains authoritative.
    }
    return null;
  }
}

function writeLocal(
  key: string,
  kind: LocalCatalogEntry['kind'],
  content: NatalReportCategoryPack | NatalReportAnswer,
): void {
  const localStorage = storage();
  if (!localStorage) return;
  try {
    const entry: LocalCatalogEntry = {
      schemaVersion: 1,
      scopeKey: key,
      kind,
      content,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(storageKey(key), JSON.stringify(entry));
    const entries: Array<{ key: string; updatedAt: string }> = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const candidate = localStorage.key(index);
      if (!candidate?.startsWith(`${LOCAL_CATALOG_CACHE_PREFIX}:`)) continue;
      try {
        const parsed = JSON.parse(localStorage.getItem(candidate) || '{}') as Partial<LocalCatalogEntry>;
        entries.push({ key: candidate, updatedAt: String(parsed.updatedAt || '') });
      } catch {
        entries.push({ key: candidate, updatedAt: '' });
      }
    }
    entries
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(LOCAL_CATALOG_CACHE_LIMIT)
      .forEach((entryToRemove) => localStorage.removeItem(entryToRemove.key));
  } catch {
    // Local persistence is only a fast/offline layer.
  }
}

function categoryScope(
  userId: string,
  categoryKey: NatalReportCategoryKey,
  chartId?: number,
  language?: 'ru' | 'en',
  cacheIdentity?: NatalCatalogCacheIdentity,
): string {
  return scopeKey({
    userId,
    chartId,
    language,
    cacheIdentity,
    kind: 'category',
    itemKey: categoryKey,
  });
}

function answerScope(
  userId: string,
  answerKey: NatalReportAnswerKey,
  chartId?: number,
  language?: 'ru' | 'en',
  cacheIdentity?: NatalCatalogCacheIdentity,
): string {
  return scopeKey({
    userId,
    chartId,
    language,
    cacheIdentity,
    kind: 'answer',
    itemKey: answerKey,
  });
}

function catalogUrl(
  kind: 'category' | 'answer',
  userId: string,
  itemKey: NatalReportCategoryKey | NatalReportAnswerKey,
  chartId?: number,
): string {
  const params = new URLSearchParams({ userId });
  if (chartId != null) params.set('chartId', String(chartId));
  if (kind === 'category') params.set('categoryKey', itemKey);
  else params.set('answerKey', itemKey);
  const endpoint = kind === 'category' ? 'catalog' : 'catalog-answer';
  return `/api/content/natal/${endpoint}?${params.toString()}`;
}

async function responseError(response: Response, fallback: string): Promise<NatalCatalogError> {
  const payload = await response.json().catch(() => ({}));
  const error = new Error(payload.message || payload.error || fallback) as NatalCatalogError;
  error.status = response.status;
  error.code = payload.code || payload.error;
  error.premiumAvailable = payload.premiumRequired === true;
  error.retryAfterMs = Number(payload.retryAfterMs) || undefined;
  return error;
}

function interpretationContent<T>(payload: any, validate: (value: unknown) => value is T): T {
  const content = payload?.interpretation?.content;
  if (validate(content)) return content;
  const error = new Error('Natal catalog response is incomplete') as NatalCatalogError;
  error.status = 502;
  error.code = 'NATAL_CATALOG_RESPONSE_INCOMPLETE';
  throw error;
}

async function getServerContent<T>(input: {
  kind: 'category' | 'answer';
  userId: string;
  itemKey: NatalReportCategoryKey | NatalReportAnswerKey;
  chartId?: number;
  validate: (value: unknown) => value is T;
}): Promise<T | null> {
  const response = await apiFetch(
    catalogUrl(input.kind, input.userId, input.itemKey, input.chartId),
    {
      method: 'GET',
      headers: getTelegramInitDataHeaders(),
      cache: 'no-store',
    },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw await responseError(response, `Failed (${response.status})`);
  return interpretationContent(await response.json(), input.validate);
}

async function postServerContent<T>(input: {
  kind: 'category' | 'answer';
  userId: string;
  itemKey: NatalReportCategoryKey | NatalReportAnswerKey;
  chartId?: number;
  validate: (value: unknown) => value is T;
}): Promise<T> {
  const startedAt = Date.now();
  const keyField = input.kind === 'category' ? 'categoryKey' : 'answerKey';
  const response = await apiFetch(
    catalogUrl(input.kind, input.userId, input.itemKey, input.chartId),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getTelegramInitDataHeaders(),
      },
      body: JSON.stringify({
        userId: input.userId,
        chartId: input.chartId,
        [keyField]: input.itemKey,
      }),
    },
    CATALOG_GENERATION_TIMEOUT_MS,
  );
  if (response.status === 202) {
    const pending = await response.json().catch(() => ({}));
    let retryAfterMs = Math.max(250, Math.min(Number(pending.retryAfterMs) || 1000, 5000));
    while (Date.now() - startedAt < CATALOG_GENERATION_TIMEOUT_MS) {
      await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
      const cached = await getServerContent(input);
      if (cached) return cached;
      retryAfterMs = Math.min(Math.round(retryAfterMs * 1.35), 5000);
    }
    const error = new Error('Natal catalog generation is still in progress') as NatalCatalogError;
    error.status = 504;
    error.code = 'CONTENT_GENERATION_TIMEOUT';
    error.retryAfterMs = retryAfterMs;
    throw error;
  }
  if (!response.ok) throw await responseError(response, `Failed (${response.status})`);
  return interpretationContent(await response.json(), input.validate);
}

export function getNatalCatalogCategoryCached(
  userId: string,
  categoryKey: NatalReportCategoryKey,
  chartId?: number,
  language?: 'ru' | 'en',
  cacheIdentity?: NatalCatalogCacheIdentity,
): NatalReportCategoryPack | null {
  const key = categoryScope(userId, categoryKey, chartId, language, cacheIdentity);
  const memory = categoryCache.get(key);
  if (memory) return memory;
  const local = readLocal(key, 'category', isNatalReportCategoryPack);
  if (!local) return null;
  categoryCache.set(key, local);
  return local;
}

export async function ensureNatalCatalogCategory(
  userId: string,
  categoryKey: NatalReportCategoryKey,
  chartId?: number,
  language?: 'ru' | 'en',
  cacheIdentity?: NatalCatalogCacheIdentity,
): Promise<NatalReportCategoryPack> {
  const key = categoryScope(userId, categoryKey, chartId, language, cacheIdentity);
  const local = getNatalCatalogCategoryCached(
    userId,
    categoryKey,
    chartId,
    language,
    cacheIdentity,
  );
  if (local) return local;
  const existing = categoryInFlight.get(key);
  if (existing) return existing;
  const request = (async () => {
    const serverCached = await getServerContent({
      kind: 'category',
      userId,
      itemKey: categoryKey,
      chartId,
      validate: isNatalReportCategoryPack,
    });
    const content = serverCached || await postServerContent({
      kind: 'category',
      userId,
      itemKey: categoryKey,
      chartId,
      validate: isNatalReportCategoryPack,
    });
    categoryCache.set(key, content);
    writeLocal(key, 'category', content);
    return content;
  })().finally(() => {
    if (categoryInFlight.get(key) === request) categoryInFlight.delete(key);
  });
  categoryInFlight.set(key, request);
  return request;
}

export function getNatalCatalogAnswerCached(
  userId: string,
  answerKey: NatalReportAnswerKey,
  isPremium: boolean,
  chartId?: number,
  language?: 'ru' | 'en',
  cacheIdentity?: NatalCatalogCacheIdentity,
): NatalReportAnswer | null {
  const definition = getNatalReportAnswer(answerKey);
  if (!definition || (definition.access === 'premium' && !isPremium)) return null;
  const key = answerScope(userId, answerKey, chartId, language, cacheIdentity);
  const memory = answerCache.get(key);
  if (memory) return memory;
  const local = readLocal(key, 'answer', isNatalReportAnswer);
  if (!local) return null;
  answerCache.set(key, local);
  return local;
}

export async function ensureNatalCatalogAnswer(
  userId: string,
  answerKey: NatalReportAnswerKey,
  isPremium: boolean,
  chartId?: number,
  language?: 'ru' | 'en',
  cacheIdentity?: NatalCatalogCacheIdentity,
): Promise<NatalReportAnswer> {
  const definition = getNatalReportAnswer(answerKey);
  if (!definition) {
    const error = new Error('Natal answer not found') as NatalCatalogError;
    error.status = 400;
    error.code = 'INVALID_ANSWER_KEY';
    throw error;
  }
  // The explicit entitlement flag gates memory and localStorage as well as the
  // request. A previously cached paid answer is never read after access expires.
  if (definition.access === 'premium' && !isPremium) {
    const error = new Error('Premium required') as NatalCatalogError;
    error.status = 403;
    error.code = 'PREMIUM_REQUIRED';
    error.premiumAvailable = true;
    throw error;
  }
  const key = answerScope(userId, answerKey, chartId, language, cacheIdentity);
  const local = getNatalCatalogAnswerCached(
    userId,
    answerKey,
    isPremium,
    chartId,
    language,
    cacheIdentity,
  );
  if (local) return local;
  const existing = answerInFlight.get(key);
  if (existing) return existing;
  const request = (async () => {
    const serverCached = await getServerContent({
      kind: 'answer',
      userId,
      itemKey: answerKey,
      chartId,
      validate: isNatalReportAnswer,
    });
    const content = serverCached || await postServerContent({
      kind: 'answer',
      userId,
      itemKey: answerKey,
      chartId,
      validate: isNatalReportAnswer,
    });
    answerCache.set(key, content);
    writeLocal(key, 'answer', content);
    return content;
  })().finally(() => {
    if (answerInFlight.get(key) === request) answerInFlight.delete(key);
  });
  answerInFlight.set(key, request);
  return request;
}
