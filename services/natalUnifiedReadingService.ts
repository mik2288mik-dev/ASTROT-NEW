import type { NatalChartData } from '../types';
import {
  isNatalUnifiedReading,
  NATAL_UNIFIED_READING_CONTRACT_VERSION,
  NATAL_COPY_REVISION,
  type NatalUnifiedReading,
  type NatalUnifiedReadingTier,
} from '../lib/natalReading/unifiedReading';
import { apiFetch } from './apiClient';
import { getTelegramInitDataHeaders } from './sessionService';

const LOCAL_CACHE_PREFIX = 'nebo:natal-unified-reading:v4';
const LOCAL_CACHE_LIMIT = 24;

type UnifiedReadingError = Error & {
  status?: number;
  code?: string;
  premiumAvailable?: boolean;
  retryAfterMs?: number;
};

type CacheEntry = {
  schemaVersion: 1;
  scopeKey: string;
  content: NatalUnifiedReading;
  updatedAt: string;
};

const memory = new Map<string, NatalUnifiedReading>();
const inFlight = new Map<string, Promise<NatalUnifiedReading>>();

function languageKey(language?: 'ru' | 'en'): 'ru' | 'en' {
  return language === 'en' ? 'en' : 'ru';
}

function hash(value: string): string {
  let result = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    result ^= value.charCodeAt(i);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

function chartFingerprint(chart: NatalChartData): string {
  const value = chart as any;
  const metadata = value.calculationMetadata && typeof value.calculationMetadata === 'object'
    ? { ...value.calculationMetadata, calculatedAt: undefined }
    : undefined;
  return hash(JSON.stringify({
    schemaVersion: value.schemaVersion,
    calculationVersion: value.calculationVersion,
    birth: value.birth,
    positions: value.positions,
    angles: value.angles,
    houses: value.houses,
    aspects: value.aspects,
    chartQuality: value.chartQuality,
    calculationMetadata: metadata,
  }));
}

function scopeKey(input: {
  userId: string;
  chartData: NatalChartData;
  chartId?: number;
  language?: 'ru' | 'en';
  tier: NatalUnifiedReadingTier;
}): string {
  return [
    String(input.userId || '').trim(),
    input.chartId != null ? String(input.chartId) : 'primary',
    languageKey(input.language),
    chartFingerprint(input.chartData),
    input.tier,
    NATAL_UNIFIED_READING_CONTRACT_VERSION,
  ].join(':');
}

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function localKey(scope: string): string {
  return `${LOCAL_CACHE_PREFIX}:${encodeURIComponent(scope)}`;
}

function readLocal(scope: string): NatalUnifiedReading | null {
  const localStorage = storage();
  if (!localStorage) return null;
  const key = localKey(scope);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Partial<CacheEntry>;
    if (
      entry.schemaVersion !== 1
      || entry.scopeKey !== scope
      || !isNatalUnifiedReading(entry.content)
      || entry.content.copyRevision !== NATAL_COPY_REVISION
    ) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.content;
  } catch {
    try { localStorage.removeItem(key); } catch {}
    return null;
  }
}

function writeLocal(scope: string, content: NatalUnifiedReading): void {
  if (content.copyRevision !== NATAL_COPY_REVISION) return;
  const localStorage = storage();
  if (!localStorage) return;
  try {
    const entry: CacheEntry = {
      schemaVersion: 1,
      scopeKey: scope,
      content,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(localKey(scope), JSON.stringify(entry));
    const entries: Array<{ key: string; updatedAt: string }> = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(`${LOCAL_CACHE_PREFIX}:`)) continue;
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || '{}') as Partial<CacheEntry>;
        entries.push({ key, updatedAt: String(parsed.updatedAt || '') });
      } catch {
        entries.push({ key, updatedAt: '' });
      }
    }
    entries
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(LOCAL_CACHE_LIMIT)
      .forEach((entryToRemove) => localStorage.removeItem(entryToRemove.key));
  } catch {
    // Local cache is only a fast/offline layer.
  }
}

function endpoint(
  userId: string,
  tier: NatalUnifiedReadingTier,
  chartId?: number,
): string {
  const params = new URLSearchParams({ userId, tier });
  if (chartId != null) params.set('chartId', String(chartId));
  return `/api/content/natal/reading?${params.toString()}`;
}

async function responseError(response: Response): Promise<UnifiedReadingError> {
  const payload = await response.json().catch(() => ({}));
  const error = new Error(
    payload.message || payload.error || `Failed (${response.status})`,
  ) as UnifiedReadingError;
  error.status = response.status;
  error.code = payload.code || payload.error;
  error.premiumAvailable = payload.premiumRequired === true;
  error.retryAfterMs = Number(payload.retryAfterMs) || undefined;
  return error;
}

function readPayload(payload: any): NatalUnifiedReading {
  const content = payload?.interpretation?.content;
  if (isNatalUnifiedReading(content)) return content;
  const error = new Error('Unified natal reading response is incomplete') as UnifiedReadingError;
  error.status = 502;
  error.code = 'NATAL_UNIFIED_RESPONSE_INCOMPLETE';
  throw error;
}

async function getServer(
  userId: string,
  tier: NatalUnifiedReadingTier,
  chartId?: number,
): Promise<NatalUnifiedReading | null> {
  const response = await apiFetch(endpoint(userId, tier, chartId), {
    method: 'GET',
    headers: getTelegramInitDataHeaders(),
    cache: 'no-store',
  });
  if (response.status === 404) return null;
  if (!response.ok) throw await responseError(response);
  return readPayload(await response.json());
}

export function clearNatalUnifiedReadingCache(userId?: string): void {
  if (!userId) {
    memory.clear();
    inFlight.clear();
  } else {
    const prefix = `${String(userId).trim()}:`;
    for (const key of memory.keys()) {
      if (key.startsWith(prefix)) memory.delete(key);
    }
    for (const key of inFlight.keys()) {
      if (key.startsWith(prefix)) inFlight.delete(key);
    }
  }

  const localStorage = storage();
  if (!localStorage) return;
  const ownerPrefix = userId ? `${String(userId).trim()}:` : null;
  const remove: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(`${LOCAL_CACHE_PREFIX}:`)) continue;
    if (!ownerPrefix) {
      remove.push(key);
      continue;
    }
    try {
      const entry = JSON.parse(localStorage.getItem(key) || '{}') as Partial<CacheEntry>;
      if (String(entry.scopeKey || '').startsWith(ownerPrefix)) remove.push(key);
    } catch {
      remove.push(key);
    }
  }
  remove.forEach((key) => localStorage.removeItem(key));
}

export function getNatalUnifiedReadingCached(input: {
  userId: string;
  chartData: NatalChartData;
  chartId?: number;
  language?: 'ru' | 'en';
  tier: NatalUnifiedReadingTier;
}): NatalUnifiedReading | null {
  const scope = scopeKey(input);
  const cached = memory.get(scope);
  if (cached) return cached;
  const local = readLocal(scope);
  if (!local) return null;
  memory.set(scope, local);
  return local;
}

export async function ensureNatalUnifiedReading(input: {
  userId: string;
  chartData: NatalChartData;
  chartId?: number;
  language?: 'ru' | 'en';
  tier: NatalUnifiedReadingTier;
}): Promise<NatalUnifiedReading> {
  const scope = scopeKey(input);
  const local = getNatalUnifiedReadingCached(input);
  if (local) return local;
  const active = inFlight.get(scope);
  if (active) return active;

  const request = (async () => {
    const serverCached = await getServer(input.userId, input.tier, input.chartId);
    if (!serverCached) {
      const error = new Error('Saved natal reading is not ready') as UnifiedReadingError;
      error.code = 'NATAL_UNIFIED_READING_NOT_READY';
      error.status = 404;
      throw error;
    }
    const content = serverCached;
    if (content.copyRevision === NATAL_COPY_REVISION) memory.set(scope, content);
    writeLocal(scope, content);
    return content;
  })().finally(() => {
    if (inFlight.get(scope) === request) inFlight.delete(scope);
  });

  inFlight.set(scope, request);
  return request;
}

/** Only the first-create flow waits for the autonomous server job. Never POST. */
export async function waitForPreparedNatalReading(
  input: Parameters<typeof ensureNatalUnifiedReading>[0],
  options: { timeoutMs?: number; isCurrent?: () => boolean } = {},
): Promise<NatalUnifiedReading> {
  const deadline = Date.now() + (options.timeoutMs ?? 300_000);
  while (Date.now() < deadline) {
    if (options.isCurrent && !options.isCurrent()) throw new Error('Natal preparation cancelled');
    try { return await ensureNatalUnifiedReading(input); }
    catch (error) {
      if ((error as UnifiedReadingError).code !== 'NATAL_UNIFIED_READING_NOT_READY') throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw Object.assign(new Error('Saved natal reading is not ready'), { code: 'NATAL_PREPARATION_TIMEOUT' });
}
