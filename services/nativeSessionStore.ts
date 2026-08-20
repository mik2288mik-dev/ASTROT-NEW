import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { nativeIdentityAuth } from './nativeIdentityAuthBridge';

const NATIVE_SESSION_TOKEN_KEY = 'lumia_native_session_token';

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
  return typeof window !== 'undefined' && Capacitor.isNativePlatform();
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

async function readRawSession(): Promise<string | null> {
  if (shouldUseNativeKeystore()) {
    const result = await nativeIdentityAuth.getSessionToken();
    if (result.token) return result.token;
    // One-time upgrade path from the former plain Preferences store.
    const legacy = await Preferences.get({ key: NATIVE_SESSION_TOKEN_KEY });
    if (!legacy.value) return null;
    await nativeIdentityAuth.setSessionToken({ token: legacy.value });
    await Preferences.remove({ key: NATIVE_SESSION_TOKEN_KEY });
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
