import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const NATIVE_SESSION_TOKEN_KEY = 'lumia_native_session_token';

export interface NativeSessionStore {
  getToken(): Promise<string | null>;
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

function shouldUseNativePreferences(): boolean {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform();
}

export const nativeSessionStore: NativeSessionStore = {
  async getToken() {
    if (shouldUseNativePreferences()) {
      const result = await Preferences.get({ key: NATIVE_SESSION_TOKEN_KEY });
      return result.value || null;
    }
    return storage()?.getItem(NATIVE_SESSION_TOKEN_KEY) || null;
  },
  async setToken(token) {
    if (shouldUseNativePreferences()) {
      await Preferences.set({ key: NATIVE_SESSION_TOKEN_KEY, value: token });
      return;
    }
    storage()?.setItem(NATIVE_SESSION_TOKEN_KEY, token);
  },
  async clearToken() {
    if (shouldUseNativePreferences()) {
      await Preferences.remove({ key: NATIVE_SESSION_TOKEN_KEY });
      return;
    }
    storage()?.removeItem(NATIVE_SESSION_TOKEN_KEY);
  },
};
