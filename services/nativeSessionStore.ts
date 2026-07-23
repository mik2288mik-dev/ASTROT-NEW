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

export const nativeSessionStore: NativeSessionStore = {
  async getToken() {
    return storage()?.getItem(NATIVE_SESSION_TOKEN_KEY) || null;
  },
  async setToken(token) {
    storage()?.setItem(NATIVE_SESSION_TOKEN_KEY, token);
  },
  async clearToken() {
    storage()?.removeItem(NATIVE_SESSION_TOKEN_KEY);
  },
};
