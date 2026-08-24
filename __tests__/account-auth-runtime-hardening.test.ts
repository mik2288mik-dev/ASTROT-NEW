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

import { nativeSessionStore } from '../services/nativeSessionStore';
import { apiFetch, clearAppSessionAndLocalData, getAppAuthHeaders } from '../services/apiClient';
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

  it('masks Google for RuStore while preserving the future Google Play provider', () => {
    process.env.GOOGLE_AUTH_WEB_CLIENT_ID = '';
    process.env.GOOGLE_AUTH_CLIENT_ID = 'google-client';
    process.env.YANDEX_AUTH_CLIENT_ID = 'yandex-client';
    process.env.VK_AUTH_CLIENT_ID = 'vk-client';
    const distributionAwareCapabilities = getAccountAuthCapabilities as unknown as (
      runtime: 'native' | 'browser',
      channel: 'rustore' | 'google_play',
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
  });
});
