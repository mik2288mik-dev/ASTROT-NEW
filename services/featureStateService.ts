import { apiFetch } from './apiClient';
import { getTelegramInitDataHeaders } from './sessionService';

/**
 * Client side of `/api/users/feature-state`: personal records of home features.
 * The device keeps a copy so screens open instantly and offline; writes made
 * offline are kept as pending and sent on the next load.
 */

type FeatureItems = Record<string, unknown>;
type PendingWrite = { key: string; value: unknown };

const CACHE_PREFIX = 'nebo.feature.v1';
const memory = new Map<string, FeatureItems>();
const inflight = new Map<string, Promise<FeatureItems>>();

function cacheKey(userId: string, feature: string): string {
  return `${CACHE_PREFIX}:${userId}:${feature}`;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be full or blocked; the server copy still works.
  }
}

/** Saved copy on this device, without a network request. */
export function peekFeatureState(userId: string, feature: string): FeatureItems {
  const key = cacheKey(userId, feature);
  const cached = memory.get(key);
  if (cached) return cached;
  if (typeof window === 'undefined') return {};
  const stored = readJson<FeatureItems>(key, {});
  memory.set(key, stored);
  return stored;
}

function remember(userId: string, feature: string, items: FeatureItems): void {
  const key = cacheKey(userId, feature);
  memory.set(key, items);
  if (typeof window !== 'undefined') writeJson(key, items);
}

async function sendWrite(feature: string, write: PendingWrite): Promise<boolean> {
  try {
    const response = await apiFetch('/api/users/feature-state', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() },
      body: JSON.stringify({ feature, key: write.key, value: write.value }),
    }, 10_000);
    return response.ok;
  } catch {
    return false;
  }
}

async function flushPending(userId: string, feature: string): Promise<void> {
  const pendingKey = `${cacheKey(userId, feature)}:pending`;
  const pending = readJson<PendingWrite[]>(pendingKey, []);
  if (!pending.length) return;
  const left: PendingWrite[] = [];
  for (const write of pending) {
    if (!(await sendWrite(feature, write))) left.push(write);
  }
  writeJson(pendingKey, left);
}

/** Loads records from the server (pending offline writes go first). */
export function loadFeatureState(userId: string, feature: string): Promise<FeatureItems> {
  const key = cacheKey(userId, feature);
  const running = inflight.get(key);
  if (running) return running;
  const request = (async () => {
    await flushPending(userId, feature);
    try {
      const response = await apiFetch(`/api/users/feature-state?feature=${encodeURIComponent(feature)}`, {
        method: 'GET',
        credentials: 'include',
        headers: getTelegramInitDataHeaders(),
      }, 10_000);
      if (!response.ok) return peekFeatureState(userId, feature);
      const payload = await response.json() as { items?: FeatureItems };
      const pending = readJson<PendingWrite[]>(`${key}:pending`, []);
      const items: FeatureItems = { ...(payload.items || {}) };
      for (const write of pending) {
        if (write.value === null) delete items[write.key];
        else items[write.key] = write.value;
      }
      remember(userId, feature, items);
      return items;
    } catch {
      return peekFeatureState(userId, feature);
    }
  })().finally(() => { inflight.delete(key); });
  inflight.set(key, request);
  return request;
}

/** Saves one record; `null` removes it. Resolves once the device copy is updated. */
export async function saveFeatureState(userId: string, feature: string, itemKey: string, value: unknown): Promise<void> {
  const items = { ...peekFeatureState(userId, feature) };
  if (value === null) delete items[itemKey];
  else items[itemKey] = value;
  remember(userId, feature, items);
  if (typeof window === 'undefined') return;
  const write: PendingWrite = { key: itemKey, value };
  if (await sendWrite(feature, write)) return;
  const pendingKey = `${cacheKey(userId, feature)}:pending`;
  const pending = readJson<PendingWrite[]>(pendingKey, []).filter((item) => item.key !== itemKey);
  writeJson(pendingKey, [...pending, write].slice(-50));
}
