jest.mock('../services/nativeSessionStore', () => ({
  nativeSessionStore: {
    getSession: jest.fn(),
    setSession: jest.fn(),
    getToken: jest.fn(),
    getRefreshToken: jest.fn(),
    setToken: jest.fn(),
    clearToken: jest.fn(),
  },
}));

jest.mock('../services/nativeNetwork', () => ({
  assertNativeNetworkAvailable: jest.fn(async () => undefined),
}));

const mockCapacitorHttpRequest = jest.fn();
jest.mock('@capacitor/core', () => {
  const actual = jest.requireActual('@capacitor/core');
  return {
    ...actual,
    CapacitorHttp: {
      ...actual.CapacitorHttp,
      request: mockCapacitorHttpRequest,
    },
  };
});

import { nativeSessionStore } from '../services/nativeSessionStore';
import { Capacitor } from '@capacitor/core';
import {
  apiFetch,
  clearAppSessionAndLocalData,
  getAppAuthHeaders,
  hasNativeAppSession,
} from '../services/apiClient';
import { getProfile } from '../services/storageService';
import { setAuthSessionMode } from '../services/authSessionIntent';
import { getAccountAuthCapabilities } from '../pages/api/auth/capabilities';

const INVALIDATED_EVENT = 'lumia:app-session-invalidated';
const ENV_KEYS = [
  'NEXT_PUBLIC_MOBILE_BUILD',
  'NEXT_PUBLIC_API_URL',
  'GOOGLE_AUTH_WEB_CLIENT_ID',
  'GOOGLE_AUTH_CLIENT_ID',
  'YANDEX_AUTH_CLIENT_ID',
  'VK_AUTH_CLIENT_ID',
  'YANDEX_ANDROID_CLIENT_ID',
  'VK_ANDROID_CLIENT_ID',
] as const;
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
const originalWindow = (global as any).window;
const originalFetch = global.fetch;
const originalCustomEvent = (global as any).CustomEvent;
const mockedNativeSessionStore = nativeSessionStore as jest.Mocked<typeof nativeSessionStore>;

type RuntimeWindow = EventTarget & {
  localStorage: Storage;
  sessionStorage: Storage;
};

function createStorage(): Storage {
  return {
    clear: jest.fn(),
    getItem: jest.fn(() => null),
    key: jest.fn(() => null),
    length: 0,
    removeItem: jest.fn(),
    setItem: jest.fn(),
  };
}

function installRuntimeWindow(): RuntimeWindow {
  const runtimeWindow = Object.assign(new EventTarget(), {
    localStorage: createStorage(),
    sessionStorage: createStorage(),
  }) as RuntimeWindow;
  Object.defineProperty(global, 'window', {
    configurable: true,
    value: runtimeWindow,
  });
  return runtimeWindow;
}

class RuntimeCustomEvent<T = unknown> extends Event {
  readonly detail: T;

  constructor(type: string, init?: CustomEventInit<T>) {
    super(type, init);
    this.detail = init?.detail as T;
  }
}

describe('account authentication runtime hardening', () => {
  let runtimeWindow: RuntimeWindow;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_MOBILE_BUILD = '1';
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test';
    mockedNativeSessionStore.getSession.mockResolvedValue({
      version: 2,
      accessToken: 'native-session-token',
      refreshToken: 'native-refresh-token',
      accessExpiresAt: Math.floor(Date.now() / 1000) + 600,
      refreshExpiresAt: Math.floor(Date.now() / 1000) + 3_600,
      absoluteExpiresAt: Math.floor(Date.now() / 1000) + 7_200,
    });
    mockedNativeSessionStore.getToken.mockResolvedValue('native-session-token');
    mockedNativeSessionStore.setToken.mockResolvedValue(undefined);
    mockedNativeSessionStore.clearToken.mockResolvedValue(undefined);
    runtimeWindow = installRuntimeWindow();
    (global as any).CustomEvent = RuntimeCustomEvent;
    setAuthSessionMode('automatic');
  });

  afterAll(() => {
    for (const key of ENV_KEYS) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    if (originalWindow === undefined) delete (global as any).window;
    else (global as any).window = originalWindow;
    if (originalFetch === undefined) delete (global as any).fetch;
    else global.fetch = originalFetch;
    if (originalCustomEvent === undefined) delete (global as any).CustomEvent;
    else (global as any).CustomEvent = originalCustomEvent;
  });

  it('invalidates the live app when an authenticated request reports a blocked account', async () => {
    const observed: Array<{ code?: string; status?: number }> = [];
    runtimeWindow.addEventListener(INVALIDATED_EVENT, (event) => {
      observed.push((event as RuntimeCustomEvent<{ code?: string; status?: number }>).detail);
    });
    global.fetch = jest.fn(async () => new Response(JSON.stringify({
      code: 'ACCOUNT_BLOCKED',
      message: 'Account is blocked',
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })) as unknown as jest.MockedFunction<typeof fetch>;

    const response = await apiFetch('/api/users/me');

    expect(response.status).toBe(403);
    expect(mockedNativeSessionStore.clearToken).toHaveBeenCalledTimes(1);
    expect(observed).toHaveLength(1);
    expect(observed[0]).toMatchObject({ code: 'ACCOUNT_BLOCKED', status: 403 });
  });

  it('aborts a fresh native guest bootstrap with the apiFetch timeout signal', async () => {
    jest.useFakeTimers();
    setAuthSessionMode('guest');
    mockedNativeSessionStore.getSession.mockResolvedValue(null);
    let bootstrapSignal: AbortSignal | null | undefined;
    global.fetch = jest.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      bootstrapSignal = init?.signal;
      return new Promise<Response>((_resolve, reject) => {
        const rejectAsAborted = () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        };
        if (bootstrapSignal?.aborted) rejectAsAborted();
        else bootstrapSignal?.addEventListener('abort', rejectAsAborted, { once: true });
      });
    }) as typeof fetch;

    try {
      const request = apiFetch('/api/users/me', {}, 1_000);
      const outcome = request.then(
        () => null,
        (error) => error as Error,
      );
      await jest.advanceTimersByTimeAsync(0);
      expect(bootstrapSignal).toBeDefined();

      await jest.advanceTimersByTimeAsync(1_000);

      await expect(outcome).resolves.toMatchObject({ name: 'AbortError' });
      expect(bootstrapSignal?.aborted).toBe(true);
    } finally {
      jest.useRealTimers();
      global.fetch = originalFetch;
    }
  });

  it('clears browser account data even when native credential cleanup fails', async () => {
    mockedNativeSessionStore.clearToken.mockRejectedValueOnce(new Error('keystore unavailable'));

    await expect(clearAppSessionAndLocalData()).resolves.toBeUndefined();

    expect(runtimeWindow.localStorage.clear).toHaveBeenCalledTimes(1);
    expect(runtimeWindow.sessionStorage.clear).toHaveBeenCalledTimes(1);
  });

  it.each(['signed_out', 'deleted'] as const)(
    'does not reuse a stale Keystore bearer while auth mode is %s',
    async (mode) => {
      setAuthSessionMode(mode);

      await expect(getAppAuthHeaders()).resolves.toEqual({});

      expect(mockedNativeSessionStore.getToken).not.toHaveBeenCalled();
      expect(mockedNativeSessionStore.getSession).not.toHaveBeenCalled();
    },
  );

  it('treats an unreadable native keystore as no session so startup can show sign-in', async () => {
    mockedNativeSessionStore.getSession.mockRejectedValueOnce(new Error('keystore unavailable'));

    await expect(hasNativeAppSession()).resolves.toBe(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses bounded explicit Android HTTP when the mobile build starts before Capacitor marks itself native', async () => {
    const nativePlatform = jest.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
    const platform = jest.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
    mockCapacitorHttpRequest.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: { yandex: true, vk: true },
      url: 'https://api.example.test/api/auth/capabilities?runtime=native',
    });
    global.fetch = jest.fn() as typeof fetch;

    try {
      const response = await apiFetch(
        '/api/auth/capabilities?runtime=native',
        { headers: { Authorization: 'Bearer test-token' } },
        8_000,
      );

      expect(response.headers.get('content-type')).toContain('application/json');
      await expect(response.json()).resolves.toEqual({ yandex: true, vk: true });
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockCapacitorHttpRequest).toHaveBeenCalledWith(expect.objectContaining({
        url: 'https://api.example.test/api/auth/capabilities?runtime=native',
        method: 'GET',
        headers: { authorization: 'Bearer test-token' },
        connectTimeout: 8_000,
        readTimeout: 8_000,
        responseType: 'arraybuffer',
      }));
    } finally {
      platform.mockRestore();
      nativePlatform.mockRestore();
      global.fetch = originalFetch;
    }
  });

  it('represents an empty native HTTP 204 without constructing an invalid body', async () => {
    const nativePlatform = jest.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
    const platform = jest.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
    mockCapacitorHttpRequest.mockResolvedValue({
      status: 204,
      headers: {},
      data: '',
      url: 'https://api.example.test/api/content/forecast/personal',
    });
    global.fetch = jest.fn() as typeof fetch;

    try {
      const response = await apiFetch('/api/content/forecast/personal', {}, 8_000);

      expect(response.status).toBe(204);
      await expect(response.text()).resolves.toBe('');
      expect(global.fetch).not.toHaveBeenCalled();
    } finally {
      platform.mockRestore();
      nativePlatform.mockRestore();
      global.fetch = originalFetch;
    }
  });

  it('ends the Android HTTP call at the apiFetch timeout even when the native bridge is pending', async () => {
    jest.useFakeTimers();
    const nativePlatform = jest.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
    const platform = jest.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
    mockCapacitorHttpRequest.mockImplementation(
      () => new Promise(() => undefined),
    );

    try {
      const outcome = apiFetch(
        '/api/auth/capabilities?runtime=native',
        { headers: { Authorization: 'Bearer test-token' } },
        1_000,
      ).then(
        () => null,
        (error) => error as Error,
      );
      await jest.advanceTimersByTimeAsync(0);
      expect(mockCapacitorHttpRequest).toHaveBeenCalledWith(expect.objectContaining({
        connectTimeout: 1_000,
        readTimeout: 1_000,
      }));

      await jest.advanceTimersByTimeAsync(1_000);
      await expect(outcome).resolves.toMatchObject({ name: 'AbortError' });
    } finally {
      jest.useRealTimers();
      platform.mockRestore();
      nativePlatform.mockRestore();
    }
  });

  it('bypasses cached profile state when the app is opened again', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      const payload = url.includes('/api/auth/session/refresh')
        ? { accessExpiresAt: Math.floor(Date.now() / 1000) + 600 }
        : {
          id: '42',
          name: 'Profile',
          birthDate: '',
          birthTime: '',
          birthPlace: '',
          isSetup: true,
          language: 'ru',
          theme: 'light',
          isPremium: false,
        };
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    try {
      await expect(getProfile({ maxAttempts: 1, timeoutMs: 1_000 })).resolves.toMatchObject({
        id: '42',
      });
      const profileRequest = fetchMock.mock.calls.find(([input]) => (
        String(input).endsWith('/api/users/me')
      ));
      expect(profileRequest).toBeDefined();
      const init = profileRequest?.[1] as RequestInit | undefined;
      const headers = new Headers(init?.headers);
      expect(init?.cache).toBe('no-store');
      expect(headers.get('Cache-Control')).toBe('no-cache');
      expect(headers.get('Pragma')).toBe('no-cache');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('aborts a bounded profile load instead of keeping startup pending', async () => {
    jest.useFakeTimers();
    let requestSignal: AbortSignal | null | undefined;
    global.fetch = jest.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      requestSignal = init?.signal;
      return new Promise<Response>((_resolve, reject) => {
        const rejectAsAborted = () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        };
        if (requestSignal?.aborted) rejectAsAborted();
        else requestSignal?.addEventListener('abort', rejectAsAborted, { once: true });
      });
    }) as typeof fetch;

    try {
      const profile = getProfile({ maxAttempts: 1, timeoutMs: 1_000 });
      const profileOutcome = expect(profile).rejects.toMatchObject({
        name: 'ProfileLoadError',
        status: 503,
        code: 'PROFILE_LOAD_FAILED',
      });
      await jest.advanceTimersByTimeAsync(0);
      expect(requestSignal).toBeDefined();

      await jest.advanceTimersByTimeAsync(1_000);

      await profileOutcome;
      expect(requestSignal?.aborted).toBe(true);
    } finally {
      jest.useRealTimers();
      global.fetch = originalFetch;
    }
  });

  it('masks Google for RuStore while preserving the future Google Play provider', () => {
    process.env.GOOGLE_AUTH_WEB_CLIENT_ID = '';
    process.env.GOOGLE_AUTH_CLIENT_ID = 'google-client';
    process.env.YANDEX_AUTH_CLIENT_ID = 'yandex-browser-client';
    process.env.VK_AUTH_CLIENT_ID = 'vk-browser-client';
    process.env.YANDEX_ANDROID_CLIENT_ID = 'yandex-android-client';
    process.env.VK_ANDROID_CLIENT_ID = 'vk-android-client';
    const distributionAwareCapabilities = getAccountAuthCapabilities as unknown as (
      runtime: 'native' | 'browser',
      channel: 'rustore' | 'google_play' | 'development' | 'telegram',
    ) => ReturnType<typeof getAccountAuthCapabilities>;

    expect(distributionAwareCapabilities('native', 'rustore')).toMatchObject({
      google: false,
      yandex: true,
      vk: true,
    });
    expect(distributionAwareCapabilities('native', 'google_play')).toMatchObject({
      google: true,
      yandex: true,
      vk: true,
    });
    for (const channel of ['development', 'telegram'] as const) {
      expect(distributionAwareCapabilities('native', channel)).toMatchObject({
        google: false,
        yandex: true,
        vk: true,
      });
    }
  });
});
