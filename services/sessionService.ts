const API_BASE = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_API_URL || '';
const INIT_DATA_HEADER = 'x-telegram-init-data';
const SESSION_STORAGE_KEY = 'lumia_app_session_id';

function getTelegramInitData(): string | null {
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
