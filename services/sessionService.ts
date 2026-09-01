import {
  apiFetch,
  apiFetchUnauthenticated,
  isNativeAppRuntime,
  persistNativeSessionResponse,
} from './apiClient';
import {
  getActiveTelegramInitData,
  getRawTelegramInitData,
} from './authSessionIntent';
import {
  sanitizeUserAppEvent,
  type SanitizedUserAppEvent,
} from '../lib/premiumAnalytics';
import {
  createDiagnosticTraceId,
  diagnosticErrorCode,
  diagnosticHttpStatus,
  diagnosticTraceHeaders,
  formatDiagnosticFields,
} from '../lib/diagnosticTrace';
import {
  diagnosticLog,
  showRuntimeDiagnosticsForFailure,
} from '../lib/runtimeDiagnostics';

const INIT_DATA_HEADER = 'x-telegram-init-data';
const SESSION_STORAGE_KEY = 'lumia_app_session_id';
const USER_APP_EVENT_QUEUE_STORAGE_KEY = 'lumia_user_app_event_queue_v1';
const MAX_QUEUED_USER_APP_EVENTS = 40;
const NATIVE_GUEST_TIMEOUT_MS = 15_000;

let userAppEventDeliveryChain: Promise<void> = Promise.resolve();
let userAppEventOnlineListenerInstalled = false;
let userAppEventQueueGeneration = 0;
const activeUserAppEventControllers = new Set<AbortController>();

/** Poll until Telegram WebApp exposes signed initData (required for API auth). */
export async function waitForTelegramInitData(options?: {
  maxAttempts?: number;
  delayMs?: number;
}): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  const maxAttempts = options?.maxAttempts ?? 20;
  const delayMs = options?.delayMs ?? 300;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const initData = getRawTelegramInitData();
    if (initData) return initData;
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return null;
}

/** Headers fragment for authenticated Telegram WebApp API calls */
export function getTelegramInitDataHeaders(): Record<string, string> {
  const initData = getActiveTelegramInitData();
  return initData ? { [INIT_DATA_HEADER]: initData } : {};
}

/**
 * Raw Telegram launch proof for a deliberate Telegram-only action such as
 * login, identity linking, or Stars payment. Never use this as a global API
 * fallback: the server must validate it alongside the canonical app session.
 */
export function getExplicitTelegramInitDataHeaders(): Record<string, string> {
  const initData = getRawTelegramInitData();
  return initData ? { [INIT_DATA_HEADER]: initData } : {};
}

export function getOrCreateAppSessionId(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;

    const created = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2)}`;

    window.sessionStorage.setItem(SESSION_STORAGE_KEY, created);
    return created;
  } catch {
    return null;
  }
}

export async function recordUserSession(telegramPlatform?: string | null): Promise<void> {
  if (typeof window === 'undefined') return;

  const initData = getActiveTelegramInitData();
  const sessionId = getOrCreateAppSessionId();
  if (!sessionId) return;
  // Пишем вход и для веб-гостей (авторизация по signed cookie), поэтому credentials:'include',
  // а initData — опционально. Раньше без initData выходили → входы веб-гостей терялись.

  const response = await apiFetch('/api/users/session', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(initData ? { [INIT_DATA_HEADER]: initData } : {}),
    },
    body: JSON.stringify({
      sessionId,
      telegramPlatform: telegramPlatform || null,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || payload.error || `Session tracking failed: ${response.status}`);
  }
}

export async function recordNotificationAttribution(payload: {
  source?: string | null;
  scenario?: string | null;
  nl?: string | number | null;
  section?: string | null;
  eventType?: 'click' | 'open';
}): Promise<void> {
  if (typeof window === 'undefined') return;

  const initData = getActiveTelegramInitData();
  if (!initData) return;

  await apiFetch('/api/notifications/attribution', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [INIT_DATA_HEADER]: initData,
    },
    body: JSON.stringify({
      ...payload,
      eventType: payload.eventType || 'click',
    }),
  }).catch((error) => {
    console.warn('[Notifications] Attribution failed:', error?.message || error);
  });
}

function userAppEventQueueStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage || null;
  } catch {
    return null;
  }
}

function readUserAppEventQueue(storage: Storage): SanitizedUserAppEvent[] {
  try {
    const raw = storage.getItem(USER_APP_EVENT_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => sanitizeUserAppEvent(entry))
      .filter((entry): entry is SanitizedUserAppEvent => Boolean(entry))
      .slice(-MAX_QUEUED_USER_APP_EVENTS);
  } catch {
    return [];
  }
}

function writeUserAppEventQueue(storage: Storage, events: SanitizedUserAppEvent[]): boolean {
  try {
    if (events.length === 0) {
      storage.removeItem(USER_APP_EVENT_QUEUE_STORAGE_KEY);
    } else {
      storage.setItem(
        USER_APP_EVENT_QUEUE_STORAGE_KEY,
        JSON.stringify(events.slice(-MAX_QUEUED_USER_APP_EVENTS)),
      );
    }
    return true;
  } catch {
    return false;
  }
}

export function clearQueuedUserAppEvents(): void {
  userAppEventQueueGeneration += 1;
  const activeControllers = Array.from(activeUserAppEventControllers);
  activeUserAppEventControllers.clear();
  activeControllers.forEach((controller) => controller.abort());
  const storage = userAppEventQueueStorage();
  if (!storage) return;
  try {
    storage.removeItem(USER_APP_EVENT_QUEUE_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

function shouldRetryUserAppEvent(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function sendUserAppEvent(event: SanitizedUserAppEvent): Promise<boolean> {
  const controller = new AbortController();
  activeUserAppEventControllers.add(controller);
  try {
    const initData = getActiveTelegramInitData();
    const response = await apiFetch('/api/users/events', {
      method: 'POST',
      credentials: 'include',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(initData ? { [INIT_DATA_HEADER]: initData } : {}),
      },
      body: JSON.stringify(event),
    });
    if (response.ok) return true;
    if (shouldRetryUserAppEvent(Number(response.status || 0))) return false;
    console.warn('[UserEvents] Event rejected:', Number(response.status || 0));
    return true;
  } catch {
    // Account switches abort only telemetry requests. The generation guard and
    // cleared queue deliberately prevent these events from being retried as the
    // next authenticated user.
    return controller.signal.aborted;
  } finally {
    activeUserAppEventControllers.delete(controller);
  }
}

async function flushQueuedUserAppEvents(
  expectedGeneration = userAppEventQueueGeneration,
): Promise<void> {
  const storage = userAppEventQueueStorage();
  if (!storage) return;
  for (;;) {
    if (expectedGeneration !== userAppEventQueueGeneration) return;
    const queued = readUserAppEventQueue(storage);
    if (queued.length === 0) return;
    const delivered = queued[0];
    if (!await sendUserAppEvent(delivered)) return;
    if (expectedGeneration !== userAppEventQueueGeneration) return;
    // Re-read after delivery: another call may have appended an event while the
    // request was in flight. At the 40-event cap the delivered entry may already
    // have been evicted, so remove by stable id instead of dropping the new head.
    const latest = readUserAppEventQueue(storage);
    const deliveredIndex = delivered.eventId
      ? latest.findIndex((event) => event.eventId === delivered.eventId)
      : latest.findIndex((event) => JSON.stringify(event) === JSON.stringify(delivered));
    if (deliveredIndex < 0) continue;
    writeUserAppEventQueue(storage, [
      ...latest.slice(0, deliveredIndex),
      ...latest.slice(deliveredIndex + 1),
    ]);
  }
}

function scheduleQueuedUserAppEventFlush(): void {
  const expectedGeneration = userAppEventQueueGeneration;
  userAppEventDeliveryChain = userAppEventDeliveryChain
    .catch(() => undefined)
    .then(() => flushQueuedUserAppEvents(expectedGeneration));
}

function ensureUserAppEventOnlineRetry(): void {
  if (userAppEventOnlineListenerInstalled || typeof window === 'undefined') return;
  if (typeof window.addEventListener !== 'function') return;
  window.addEventListener('online', scheduleQueuedUserAppEventFlush);
  userAppEventOnlineListenerInstalled = true;
}

function createUserAppEventId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function recordUserAppEvent(payload: {
  eventType: string;
  section?: string | null;
  source?: string | null;
  eventPayload?: Record<string, unknown>;
}): Promise<void> {
  if (typeof window === 'undefined' || !payload.eventType) return;
  const sanitizedEvent = sanitizeUserAppEvent({
    ...payload,
    eventId: createUserAppEventId(),
  });
  if (!sanitizedEvent) return;

  ensureUserAppEventOnlineRetry();
  // Persist before entering the delivery chain. A later purchase_success must
  // survive an earlier slow checkout_start request and an immediate app close.
  const storage = userAppEventQueueStorage();
  const queued = storage
    ? [...readUserAppEventQueue(storage), sanitizedEvent].slice(-MAX_QUEUED_USER_APP_EVENTS)
    : null;
  const persisted = Boolean(storage && queued && writeUserAppEventQueue(storage, queued));
  const expectedGeneration = userAppEventQueueGeneration;
  userAppEventDeliveryChain = userAppEventDeliveryChain
    .catch(() => undefined)
    .then(async () => {
      if (expectedGeneration !== userAppEventQueueGeneration) return;
      // localStorage keeps already-sanitized events across a WebView/process
      // restart. Account logout and deletion clear both app storages.
      if (persisted) {
        await flushQueuedUserAppEvents(expectedGeneration);
        return;
      }

      if (expectedGeneration !== userAppEventQueueGeneration) return;
      if (!await sendUserAppEvent(sanitizedEvent)) {
        console.warn('[UserEvents] Event delivery deferred');
      }
    });
  await userAppEventDeliveryChain;
}

export type UserNotificationSettings = {
  enabled: boolean;
  morning_enabled: boolean;
  day_enabled: boolean;
  evening_enabled: boolean;
  reactivation_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  timezone: string | null;
};

export async function getUserNotificationSettings(): Promise<UserNotificationSettings | null> {
  if (typeof window === 'undefined') return null;
  const initData = getActiveTelegramInitData();
  if (!initData) return null;
  try {
    const response = await apiFetch('/api/users/notification-settings', {
      method: 'GET',
      headers: { [INIT_DATA_HEADER]: initData },
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return (payload?.settings as UserNotificationSettings) || null;
  } catch {
    return null;
  }
}

export async function updateUserNotificationSettings(payload: {
  enabled?: boolean;
  morningEnabled?: boolean;
  dayEnabled?: boolean;
  eveningEnabled?: boolean;
  reactivationEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone?: string | null;
}): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const initData = getActiveTelegramInitData();
  if (!initData) return false;

  try {
    const response = await apiFetch('/api/users/notification-settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [INIT_DATA_HEADER]: initData,
      },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch (error: any) {
    console.warn('[Notifications] Settings update failed:', error?.message || error);
    return false;
  }
}

function guestSessionError(payload: any, status: number): Error & { code: string; status: number } {
  const error = new Error(payload?.message || payload?.error || `Guest session failed: ${status}`) as Error & {
    code: string;
    status: number;
  };
  error.code = String(payload?.code || payload?.error || 'GUEST_SESSION_FAILED');
  error.status = status;
  return error;
}

async function createNativeGuestSession(traceId: string): Promise<any | null> {
  const startedAt = Date.now();
  diagnosticLog('INFO', 'auth_guest', formatDiagnosticFields({
    traceId, side: 'client', stage: 'session_request', status: 'start', runtime: 'native',
  }));
  try {
    const response = await apiFetchUnauthenticated(
      '/api/auth/native-guest',
      {
        method: 'POST',
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json',
          ...diagnosticTraceHeaders(traceId),
        },
        body: JSON.stringify({ sessionVersion: 2 }),
      },
      NATIVE_GUEST_TIMEOUT_MS,
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.profile) throw guestSessionError(payload, response.status);
    diagnosticLog('INFO', 'auth_guest', formatDiagnosticFields({
      traceId,
      side: 'client',
      stage: 'session_persist',
      status: 'start',
      durationMs: Date.now() - startedAt,
      httpStatus: response.status,
      runtime: 'native',
    }));
    await persistNativeSessionResponse(payload);
    diagnosticLog('INFO', 'auth_guest', formatDiagnosticFields({
      traceId,
      side: 'client',
      stage: 'finished',
      status: 'ok',
      durationMs: Date.now() - startedAt,
      httpStatus: response.status,
      runtime: 'native',
    }));
    return payload.profile;
  } catch (error) {
    diagnosticLog('ERROR', 'auth_guest', formatDiagnosticFields({
      traceId,
      side: 'client',
      stage: 'finished',
      status: 'error',
      durationMs: Date.now() - startedAt,
      httpStatus: diagnosticHttpStatus(error),
      errorCode: diagnosticErrorCode(error, 'GUEST_SESSION_FAILED'),
      runtime: 'native',
    }));
    showRuntimeDiagnosticsForFailure('guest authentication failed', error, {
      includeClientErrors: true,
    });
    throw error;
  }
}

/** Explicitly create or reuse a guest session, including inside Telegram. */
export async function ensureWebGuestSession(): Promise<any | null> {
  if (typeof window === 'undefined') return null;
  const traceId = createDiagnosticTraceId('auth-guest');
  if (isNativeAppRuntime()) return createNativeGuestSession(traceId);

  const startedAt = Date.now();
  diagnosticLog('INFO', 'auth_guest', formatDiagnosticFields({
    traceId, side: 'client', stage: 'session_request', status: 'start', runtime: 'browser',
  }));
  try {
    const response = await apiFetch(
      '/api/auth/guest',
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...diagnosticTraceHeaders(traceId),
        },
        body: JSON.stringify({ sessionVersion: 2 }),
      },
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.profile) throw guestSessionError(payload, response.status);
    diagnosticLog('INFO', 'auth_guest', formatDiagnosticFields({
      traceId,
      side: 'client',
      stage: 'finished',
      status: 'ok',
      durationMs: Date.now() - startedAt,
      httpStatus: response.status,
      runtime: 'browser',
    }));
    return payload.profile;
  } catch (error) {
    diagnosticLog('ERROR', 'auth_guest', formatDiagnosticFields({
      traceId,
      side: 'client',
      stage: 'finished',
      status: 'error',
      durationMs: Date.now() - startedAt,
      httpStatus: diagnosticHttpStatus(error),
      errorCode: diagnosticErrorCode(error, 'GUEST_SESSION_FAILED'),
      runtime: 'browser',
    }));
    throw error;
  }
}
