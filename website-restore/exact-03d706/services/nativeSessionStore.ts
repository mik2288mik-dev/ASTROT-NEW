import { Preferences } from '@capacitor/preferences';
import { nativeIdentityAuth } from './nativeIdentityAuthBridge';
import { isNativeAppRuntime } from './nativeRuntime';

const NATIVE_SESSION_TOKEN_KEY = 'lumia_native_session_token';
const NATIVE_SESSION_READ_TIMEOUT_MS = 2_000;

export type NativeSessionBundle = {
  version: 2;
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
  absoluteExpiresAt: number;
};

export type StoredNativeSession =
  | { version: 1; accessToken: string }
  | NativeSessionBundle;

export interface NativeSessionStore {
  getSession(): Promise<StoredNativeSession | null>;
  setSession(session: NativeSessionBundle): Promise<void>;
  getToken(): Promise<string | null>;
  getRefreshToken(): Promise<string | null>;
  setToken(token: string): Promise<void>;
  clearToken(): Promise<void>;
}

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function shouldUseNativeKeystore(): boolean {
  return typeof window !== 'undefined' && isNativeAppRuntime();
}

function parseStoredSession(value: string | null): StoredNativeSession | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (!raw.startsWith('{')) return { version: 1, accessToken: raw };
  try {
    const parsed = JSON.parse(raw) as Partial<NativeSessionBundle>;
    if (
      parsed.version !== 2
      || typeof parsed.accessToken !== 'string'
      || !parsed.accessToken
      || typeof parsed.refreshToken !== 'string'
      || !parsed.refreshToken
      || !Number.isSafeInteger(parsed.accessExpiresAt)
      || !Number.isSafeInteger(parsed.refreshExpiresAt)
      || !Number.isSafeInteger(parsed.absoluteExpiresAt)
    ) return null;
    return parsed as NativeSessionBundle;
  } catch {
    return null;
  }
}

async function withinNativeReadBudget<T>(promise: Promise<T>, fallback: T, operation: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[NativeSessionStore] ${operation} timed out after ${NATIVE_SESSION_READ_TIMEOUT_MS}ms; continuing without blocking startup`);
      resolve(fallback);
    }, NATIVE_SESSION_READ_TIMEOUT_MS);
  });
  try {
    return await Promise.race([
      promise.catch((error) => {
        console.warn(`[NativeSessionStore] ${operation} failed; continuing without blocking startup`, error);
        return fallback;
      }),
      timeout,
    ]);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

async function readRawSession(): Promise<string | null> {
  if (shouldUseNativeKeystore()) {
    const result = await withinNativeReadBudget(
      nativeIdentityAuth.getSessionToken(),
      { token: null as string | null },
      'secure-session read',
    );
    if (result.token) return result.token;

    // One-time upgrade path from the former plain Preferences store. Some OEM
    // bridges can stall a plugin call during cold start, so this compatibility
    // read is advisory and must never hold the app on its loading screen.
    const legacy = await withinNativeReadBudget(
      Preferences.get({ key: NATIVE_SESSION_TOKEN_KEY }),
      { value: null as string | null },
      'legacy Preferences read',
    );
    if (!legacy.value) return null;

    // Return the usable legacy value immediately. Migration is best-effort and
    // deliberately detached from startup so a keystore write cannot block UI.
    void nativeIdentityAuth.setSessionToken({ token: legacy.value })
      .then(() => Preferences.remove({ key: NATIVE_SESSION_TOKEN_KEY }))
      .catch((error) => console.warn('[NativeSessionStore] Legacy secure-session migration failed', error));
    return legacy.value;
  }
  return storage()?.getItem(NATIVE_SESSION_TOKEN_KEY) || null;
}

async function writeRawSession(value: string): Promise<void> {
  if (shouldUseNativeKeystore()) {
    await nativeIdentityAuth.setSessionToken({ token: value });
    await Preferences.remove({ key: NATIVE_SESSION_TOKEN_KEY });
    return;
  }
  if (
    process.env.NODE_ENV === 'production'
    && process.env.NEXT_PUBLIC_MOBILE_BUILD === '1'
    && parseStoredSession(value)?.version === 2
  ) {
    throw new Error('NATIVE_SECURE_SESSION_STORE_REQUIRED');
  }
  storage()?.setItem(NATIVE_SESSION_TOKEN_KEY, value);
}

export const nativeSessionStore: NativeSessionStore = {
  async getSession() {
    return parseStoredSession(await readRawSession());
  },
  async setSession(session) {
    await writeRawSession(JSON.stringify(session));
  },
  async getToken() {
    return parseStoredSession(await readRawSession())?.accessToken || null;
  },
  async getRefreshToken() {
    const session = parseStoredSession(await readRawSession());
    return session?.version === 2 ? session.refreshToken : null;
  },
  async setToken(token) {
    await writeRawSession(token);
  },
  async clearToken() {
    if (shouldUseNativeKeystore()) {
      await nativeIdentityAuth.clearSessionToken();
      await Preferences.remove({ key: NATIVE_SESSION_TOKEN_KEY });
      return;
    }
    storage()?.removeItem(NATIVE_SESSION_TOKEN_KEY);
  },
};
