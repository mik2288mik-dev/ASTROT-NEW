const API_BASE = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_API_URL || '';
const INIT_DATA_HEADER = 'x-telegram-init-data';
const SESSION_STORAGE_KEY = 'lumia_app_session_id';

function getTelegramInitData(): string | null {
  if (typeof window === 'undefined') return null;
  const initData = (window as any).Telegram?.WebApp?.initData;
  return typeof initData === 'string' && initData.trim() ? initData : null;
}

/** Headers fragment for authenticated Telegram WebApp API calls */
export function getTelegramInitDataHeaders(): Record<string, string> {
  const initData = getTelegramInitData();
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

  const initData = getTelegramInitData();
  const sessionId = getOrCreateAppSessionId();
  if (!initData || !sessionId) return;

  const response = await fetch(`${API_BASE}/api/users/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [INIT_DATA_HEADER]: initData,
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

  const initData = getTelegramInitData();
  if (!initData) return;

  await fetch(`${API_BASE}/api/notifications/attribution`, {
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

export async function recordUserAppEvent(payload: {
  eventType: string;
  section?: string | null;
  source?: string | null;
  eventPayload?: Record<string, any>;
}): Promise<void> {
  if (typeof window === 'undefined') return;

  const initData = getTelegramInitData();
  if (!initData || !payload.eventType) return;

  await fetch(`${API_BASE}/api/users/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [INIT_DATA_HEADER]: initData,
    },
    body: JSON.stringify(payload),
  }).catch((error) => {
    console.warn('[UserEvents] Failed:', error?.message || error);
  });
}

export async function updateUserNotificationSettings(payload: {
  enabled?: boolean;
  morningEnabled?: boolean;
  dayEnabled?: boolean;
  eveningEnabled?: boolean;
  reactivationEnabled?: boolean;
  timezone?: string | null;
}): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const initData = getTelegramInitData();
  if (!initData) return false;

  try {
    const response = await fetch(`${API_BASE}/api/users/notification-settings`, {
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

/** Ensure a non-Telegram browser has a signed HttpOnly guest session. Telegram remains the priority provider. */
export async function ensureWebGuestSession(): Promise<any | null> {
  if (typeof window === 'undefined' || getTelegramInitData()) return null;
  const response = await fetch(`${API_BASE}/api/auth/guest`, { method: 'POST', credentials: 'include' });
  if (!response.ok) throw new Error(`Guest session failed: ${response.status}`);
  const payload = await response.json();
  return payload?.profile || null;
}
