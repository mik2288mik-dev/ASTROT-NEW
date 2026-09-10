export const AUTH_SESSION_MODE_STORAGE_KEY = 'lumia_auth_session_mode_v1';

export const AUTH_SESSION_MODES = [
  'automatic',
  'account',
  'telegram',
  'guest',
  'signed_out',
  'deleted',
] as const;

export type AuthSessionMode = (typeof AUTH_SESSION_MODES)[number];

const DEFAULT_AUTH_SESSION_MODE: AuthSessionMode = 'automatic';
let inMemoryAuthSessionMode: AuthSessionMode | null = null;

function isAuthSessionMode(value: unknown): value is AuthSessionMode {
  return typeof value === 'string'
    && (AUTH_SESSION_MODES as readonly string[]).includes(value);
}

/**
 * Keeps an explicit logout, deletion, or guest choice across a Mini App reload.
 * Telegram's signed launch data remains present after logout, so its presence alone
 * must never be treated as consent to sign the user back in.
 */
export function getAuthSessionMode(): AuthSessionMode {
  if (typeof window === 'undefined') return DEFAULT_AUTH_SESSION_MODE;
  if (inMemoryAuthSessionMode) return inMemoryAuthSessionMode;

  try {
    const stored = window.localStorage.getItem(AUTH_SESSION_MODE_STORAGE_KEY);
    return isAuthSessionMode(stored) ? stored : DEFAULT_AUTH_SESSION_MODE;
  } catch {
    return DEFAULT_AUTH_SESSION_MODE;
  }
}

export function setAuthSessionMode(mode: AuthSessionMode): void {
  if (typeof window === 'undefined') return;
  inMemoryAuthSessionMode = mode;

  try {
    window.localStorage.setItem(AUTH_SESSION_MODE_STORAGE_KEY, mode);
  } catch {
    // Storage can be unavailable in restricted WebViews. The caller still keeps
    // the in-memory UI state for the current opening.
  }
}

export function resetAuthSessionMode(): void {
  if (typeof window === 'undefined') return;
  inMemoryAuthSessionMode = null;

  try {
    window.localStorage.removeItem(AUTH_SESSION_MODE_STORAGE_KEY);
  } catch {
    // See setAuthSessionMode.
  }
}

export function shouldUseTelegramSession(
  mode: AuthSessionMode = getAuthSessionMode()
): boolean {
  return mode === 'automatic' || mode === 'telegram';
}

/**
 * Returns the Telegram-signed launch payload without applying the local auth
 * choice. Use this only for an explicit Telegram login/link action.
 */
export function getRawTelegramInitData(): string | null {
  if (typeof window === 'undefined') return null;
  const initData = (window as any).Telegram?.WebApp?.initData;
  return typeof initData === 'string' && initData.trim() ? initData.trim() : null;
}

/**
 * Auth payload for ordinary API requests. Guest, signed-out, and deleted modes
 * deliberately suppress Telegram launch data even inside a real Mini App.
 */
export function getActiveTelegramInitData(): string | null {
  return shouldUseTelegramSession() ? getRawTelegramInitData() : null;
}

export function hasTelegramMiniAppContext(): boolean {
  return getRawTelegramInitData() !== null;
}

export function requiresExplicitAuthentication(
  mode: AuthSessionMode = getAuthSessionMode()
): boolean {
  return mode === 'signed_out' || mode === 'deleted';
}
