import { apiFetch } from './apiClient';
import { parseHomeCard, type HomeCardsResponse, type PublishedHomeCard } from '../lib/homeCards';

export const HOME_CARDS_CHANGED_EVENT = 'nebo:home-cards-changed';
export const HOME_CARDS_STORAGE_SIGNAL = 'nebo:home-cards-update';
const PREFIX = 'nebo:home-cards:v1:';
const TTL_MS = 30_000;
export type HomeCardsRequest = { userId: string | number | null; isPremium: boolean; locale: 'ru' | 'en' };
export type HomeCardsCache = HomeCardsResponse & { expiresAt: number };
const cache = new Map<string, HomeCardsCache>();
const pending = new Map<string, { epoch: number; promise: Promise<HomeCardsCache> }>();
let epoch = 0;

export const homeCardsCacheKey = (input: HomeCardsRequest): string => `${PREFIX}${encodeURIComponent(String(input.userId ?? 'anonymous'))}:${input.isPremium ? 'premium' : 'free'}:${input.locale}`;

function normalizeResponse(value: unknown): HomeCardsResponse {
  const data = value as Partial<HomeCardsResponse> | null;
  if (!data || !Array.isArray(data.cards)) throw new Error('Не удалось получить карточки.');
  const cards: PublishedHomeCard[] = [];
  for (const raw of data.cards.slice(0, 30)) {
    try { if (Number.isSafeInteger(raw.id) && raw.id > 0) cards.push({ ...parseHomeCard(raw), id: raw.id }); }
    catch { /* Ignore one malformed card without breaking the home screen. */ }
  }
  const nextChangeAt = typeof data.nextChangeAt === 'string' && Number.isFinite(Date.parse(data.nextChangeAt)) ? data.nextChangeAt : null;
  return { cards, nextChangeAt };
}

export function invalidateHomeCards(broadcast = true): void {
  epoch += 1;
  cache.clear();
  pending.clear();
  if (typeof window === 'undefined') return;
  try {
    Object.keys(window.localStorage).filter((key) => key.startsWith(PREFIX)).forEach((key) => window.localStorage.removeItem(key));
    if (broadcast) window.localStorage.setItem(HOME_CARDS_STORAGE_SIGNAL, `${Date.now()}:${epoch}`);
  } catch { /* Storage can be unavailable in private browsing. */ }
  window.dispatchEvent(new Event(HOME_CARDS_CHANGED_EVENT));
}

/** Local cache is account/tier-specific and cannot outlive a scheduled change. */
export async function loadHomeCards(input: HomeCardsRequest, force = false): Promise<HomeCardsCache> {
  const key = homeCardsCacheKey(input);
  const now = Date.now();
  let stored = cache.get(key);
  if (!force && !stored && typeof window !== 'undefined') {
    try {
      const raw = JSON.parse(window.localStorage.getItem(key) || 'null');
      if (raw && Number.isFinite(raw.expiresAt) && raw.expiresAt > now && raw.expiresAt <= now + TTL_MS) {
        stored = { ...normalizeResponse(raw), expiresAt: raw.expiresAt };
        cache.set(key, stored);
      }
    } catch { /* A cache entry is optional. */ }
  }
  if (!force && stored && stored.expiresAt > now) return stored;
  const existing = pending.get(key);
  if (existing && existing.epoch === epoch) return existing.promise;
  const requestEpoch = epoch;
  const promise = (async () => {
    const response = await apiFetch(`/api/content/home-cards?locale=${input.locale}`, { method: 'GET', cache: 'no-store' });
    if (!response.ok) throw new Error('Не удалось получить карточки.');
    const data = normalizeResponse(await response.json());
    if (requestEpoch !== epoch) return loadHomeCards(input, true);
    const receivedAt = Date.now();
    const next = data.nextChangeAt ? Date.parse(data.nextChangeAt) : Infinity;
    const result: HomeCardsCache = { ...data, expiresAt: Math.min(receivedAt + TTL_MS, next) };
    cache.set(key, result);
    if (typeof window !== 'undefined') {
      try { window.localStorage.setItem(key, JSON.stringify(result)); } catch { /* Memory cache remains available. */ }
    }
    return result;
  })();
  pending.set(key, { epoch: requestEpoch, promise });
  try { return await promise; }
  finally { if (pending.get(key)?.promise === promise) pending.delete(key); }
}
