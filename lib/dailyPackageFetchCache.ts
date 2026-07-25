import { APP_VOICE_VERSION } from './appVoice';
import { HUMAN_DAILY_PROMPT_VERSION } from './natalHumanShared';

const HUMAN_DAILY_PATH = '/api/content/natal/human-daily';
const STORAGE_PREFIX = 'your-horoscope:daily-package-response:v1';

type CachedDailyResponse = {
  schemaVersion: 1;
  savedAt: string;
  userId: string;
  dateKey: string;
  chartId: string;
  voiceVersion: string;
  promptVersion: string;
  payload: Record<string, unknown>;
};

type DailyRequestDescriptor = {
  method: string;
  userId: string;
  dateKey: string;
  chartId: string;
  storageKey: string;
};

let installed = false;
let originalFetch: typeof window.fetch | null = null;

function getStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function keyPart(value: string): string {
  return encodeURIComponent(value);
}

function buildStorageKey(userId: string, chartId: string, dateKey: string): string {
  return [
    STORAGE_PREFIX,
    keyPart(userId),
    keyPart(chartId),
    keyPart(dateKey),
    keyPart(HUMAN_DAILY_PROMPT_VERSION),
    keyPart(APP_VOICE_VERSION),
  ].join(':');
}

function describeRequest(input: RequestInfo | URL, init?: RequestInit): DailyRequestDescriptor | null {
  if (typeof window === 'undefined') return null;

  const rawUrl = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;

  let url: URL;
  try {
    url = new URL(rawUrl, window.location.origin);
  } catch {
    return null;
  }

  if (url.pathname !== HUMAN_DAILY_PATH) return null;
  if (url.searchParams.get('sectionKey') !== 'daily_overview') return null;

  const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  if (method !== 'GET' && method !== 'POST') return null;

  const userId = String(url.searchParams.get('userId') || '').trim();
  const dateKey = String(url.searchParams.get('date') || '').trim();
  const chartId = String(url.searchParams.get('chartId') || 'primary').trim();
  if (!userId || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;

  return {
    method,
    userId,
    dateKey,
    chartId,
    storageKey: buildStorageKey(userId, chartId, dateKey),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isUsablePayload(payload: unknown, descriptor: DailyRequestDescriptor): payload is Record<string, unknown> {
  if (!isRecord(payload)) return false;
  const dailyPackage = payload.dailyPackage;
  if (!isRecord(dailyPackage)) return false;
  if (typeof dailyPackage.hero_title !== 'string' || !dailyPackage.hero_title.trim()) return false;
  if (typeof dailyPackage.hero_hook !== 'string' || !dailyPackage.hero_hook.trim()) return false;
  if (typeof dailyPackage.overview !== 'string' || !dailyPackage.overview.trim()) return false;

  const meta = dailyPackage.meta;
  if (isRecord(meta)) {
    const dateKey = typeof meta.date_key === 'string' ? meta.date_key : '';
    const voiceVersion = typeof meta.voice_version === 'string' ? meta.voice_version : '';
    if (dateKey && dateKey !== descriptor.dateKey) return false;
    if (voiceVersion && voiceVersion !== APP_VOICE_VERSION) return false;
  }

  return true;
}

function readCachedPayload(descriptor: DailyRequestDescriptor): Record<string, unknown> | null {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(descriptor.storageKey);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Partial<CachedDailyResponse>;
    if (
      entry.schemaVersion !== 1 ||
      entry.userId !== descriptor.userId ||
      entry.dateKey !== descriptor.dateKey ||
      entry.chartId !== descriptor.chartId ||
      entry.voiceVersion !== APP_VOICE_VERSION ||
      entry.promptVersion !== HUMAN_DAILY_PROMPT_VERSION ||
      !isUsablePayload(entry.payload, descriptor)
    ) {
      storage.removeItem(descriptor.storageKey);
      return null;
    }
    return entry.payload;
  } catch {
    return null;
  }
}

function pruneOldEntries(storage: Storage, descriptor: DailyRequestDescriptor): void {
  const userPrefix = `${STORAGE_PREFIX}:${keyPart(descriptor.userId)}:`;
  const keysToRemove: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && key.startsWith(userPrefix) && key !== descriptor.storageKey) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => storage.removeItem(key));
}

function saveCachedPayload(descriptor: DailyRequestDescriptor, payload: unknown): void {
  const storage = getStorage();
  if (!storage || !isUsablePayload(payload, descriptor)) return;

  const entry: CachedDailyResponse = {
    schemaVersion: 1,
    savedAt: new Date().toISOString(),
    userId: descriptor.userId,
    dateKey: descriptor.dateKey,
    chartId: descriptor.chartId,
    voiceVersion: APP_VOICE_VERSION,
    promptVersion: HUMAN_DAILY_PROMPT_VERSION,
    payload,
  };

  try {
    pruneOldEntries(storage, descriptor);
    storage.setItem(descriptor.storageKey, JSON.stringify(entry));
  } catch {
    // Local cache is best-effort. The server cache stays authoritative.
  }
}

async function saveResponseClone(response: Response, descriptor: DailyRequestDescriptor): Promise<void> {
  if (!response.ok) return;
  try {
    const payload = await response.json();
    saveCachedPayload(descriptor, payload);
  } catch {
    // Ignore non-JSON or interrupted responses.
  }
}

function responseFromPayload(payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'x-daily-package-source': 'local-cache',
    },
  });
}

/**
 * Keeps the current personal “Today” package on the device.
 * Only the daily overview endpoint is intercepted; chart calculations and all
 * other natal/synastry/forecast requests keep their original network behavior.
 */
export function installDailyPackageFetchCache(): () => void {
  if (typeof window === 'undefined' || installed) return () => undefined;

  originalFetch = window.fetch.bind(window);
  const baseFetch = originalFetch;

  const cachedFetch: typeof window.fetch = async (input, init) => {
    const descriptor = describeRequest(input, init);
    if (!descriptor) return baseFetch(input, init);

    if (descriptor.method === 'GET') {
      const cached = readCachedPayload(descriptor);
      if (cached) {
        void baseFetch(input, init)
          .then((response) => saveResponseClone(response.clone(), descriptor))
          .catch(() => undefined);
        return responseFromPayload(cached);
      }
    }

    const response = await baseFetch(input, init);
    if (response.ok) {
      void saveResponseClone(response.clone(), descriptor);
    }
    return response;
  };

  window.fetch = cachedFetch;
  installed = true;

  return () => {
    if (installed && originalFetch && window.fetch === cachedFetch) {
      window.fetch = originalFetch;
    }
    installed = false;
    originalFetch = null;
  };
}
