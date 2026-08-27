import fs from 'fs';
import path from 'path';
import {
  getForwardedApiOrigin,
  isAllowedNativeOrigin,
  isSameApiOrigin,
} from '../lib/apiCors';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const originalFetch = globalThis.fetch;
const originalDatabaseUrl = process.env.DATABASE_URL;

function installBrowserStorage(): void {
  const values = new Map<string, string>();
  const localStorage = {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, String(value));
    },
  };
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
  });
}

function mockResponse() {
  const result = { statusCode: 200, body: null as any, headers: {} as Record<string, string> };
  const response = {
    status(code: number) {
      result.statusCode = code;
      return response;
    },
    json(body: any) {
      result.body = body;
      return response;
    },
    setHeader(name: string, value: string) {
      result.headers[name] = value;
    },
  };
  return { response: response as any, result };
}

async function setupNativeHandler() {
  jest.resetModules();
  process.env.APP_SESSION_SECRET = 'native-test-session-secret-that-is-long-enough';
  const users = new Map<string, any>();
  const set = jest.fn(async (id: string, profile: any) => {
    users.set(id, { id, ...profile });
    return users.get(id);
  });
  const get = jest.fn(async (id: string) => users.get(id));
  jest.doMock('../lib/db', () => ({ db: { users: { set, get } } }));
  const handler = require('../pages/api/auth/native-guest').default;
  const auth = require('../lib/auth/appAuth');
  return { handler, auth, users, set };
}

describe('mobile API and native auth', () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.dontMock('../lib/db');
    jest.dontMock('../services/nativeSessionStore');
    Object.defineProperty(globalThis, 'fetch', { value: originalFetch, configurable: true });
    delete process.env.NEXT_PUBLIC_MOBILE_BUILD;
    delete process.env.NEXT_PUBLIC_API_URL;
    delete (globalThis as any).window;
  });

  afterAll(() => {
    if (originalDatabaseUrl) process.env.DATABASE_URL = originalDatabaseUrl;
    else delete process.env.DATABASE_URL;
  });

  it('creates one signed native guest and reuses it on the next request', async () => {
    const { handler, auth, users, set } = await setupNativeHandler();
    const first = mockResponse();
    await handler({ method: 'POST', headers: {}, body: { sessionVersion: 2 } } as any, first.response);

    expect(first.result.statusCode).toBe(200);
    expect(first.result.body.profile).toMatchObject({
      authProvider: 'native',
      isGuest: true,
      isPremium: false,
    });
    // The isolated unit has no durable app_sessions database, so the server
    // intentionally falls back to a signed v1 bearer even when v2 is requested.
    // PostgreSQL suites cover persisted access/refresh issuance and rotation.
    expect(auth.verifyAppSessionToken(first.result.body.token)).toMatchObject({
      userId: first.result.body.profile.id,
      provider: 'native',
    });

    const second = mockResponse();
    await handler({
      method: 'POST',
      headers: { authorization: `Bearer ${first.result.body.token}` },
    } as any, second.response);

    expect(second.result.statusCode).toBe(200);
    expect(second.result.body.token).toBe(first.result.body.token);
    expect(second.result.body.profile.id).toBe(first.result.body.profile.id);
    expect(users.size).toBe(1);
    expect(set).toHaveBeenCalledTimes(1);
  });

  it('rejects a tampered bearer and keeps expectedUserId protection for native guests', async () => {
    const { handler, auth, set } = await setupNativeHandler();
    const created = mockResponse();
    await handler({ method: 'POST', headers: {} } as any, created.response);

    const tampered = mockResponse();
    const token = created.result.body.token as string;
    await handler({
      method: 'POST',
      headers: { authorization: `Bearer ${token.slice(0, -1)}x` },
    } as any, tampered.response);
    expect(tampered.result).toMatchObject({
      statusCode: 401,
      body: { error: 'APP_SESSION_INVALID' },
    });
    expect(set).toHaveBeenCalledTimes(1);

    await expect(auth.requireAppUser({
      headers: { authorization: `Bearer ${token}` },
      query: {},
      body: {},
    }, {
      expectedUserId: '-999',
      allowGuest: true,
    })).rejects.toMatchObject({ status: 403, code: 'USER_ID_MISMATCH' });
  });

  it.each([
    { status: 401, field: 'error', code: 'APP_SESSION_INVALID' },
    { status: 401, field: 'code', code: 'APP_SESSION_REVOKED' },
    { status: 401, field: 'error', code: 'APP_AUTH_REQUIRED' },
    { status: 403, field: 'code', code: 'ACCOUNT_BLOCKED' },
  ] as const)('clears a native session only for explicit session failure $code', async ({ status, field, code }) => {
    jest.resetModules();
    process.env.NEXT_PUBLIC_MOBILE_BUILD = '1';
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test/';
    const session = {
      version: 2 as const,
      accessToken: 'active-token',
      refreshToken: 'active-refresh-token',
      accessExpiresAt: Math.floor(Date.now() / 1000) + 600,
      refreshExpiresAt: Math.floor(Date.now() / 1000) + 3_600,
      absoluteExpiresAt: Math.floor(Date.now() / 1000) + 7_200,
    };
    const store = {
      getSession: jest.fn(async () => session),
      setSession: jest.fn(async () => undefined),
      getToken: jest.fn(async () => session.accessToken),
      setToken: jest.fn(async () => undefined),
      clearToken: jest.fn(async () => undefined),
    };
    jest.doMock('../services/nativeSessionStore', () => ({ nativeSessionStore: store }));

    const calls: Array<{ url: string; authorization: string | null }> = [];
    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const authorization = new Headers(init?.headers).get('Authorization');
      calls.push({ url, authorization });
      if (url.endsWith('/api/auth/session/refresh')) {
        return new Response(JSON.stringify({ code: 'APP_SESSION_REFRESH_INVALID' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ [field]: code }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true });

    const { apiFetch, getApiBaseUrl } = require('../services/apiClient');
    expect(getApiBaseUrl()).toBe('https://api.example.test');
    const response = await apiFetch('/api/data');

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ [field]: code });
    expect(calls).toEqual(
      code === 'APP_AUTH_REQUIRED'
        ? [
        {
          url: 'https://api.example.test/api/data',
          authorization: 'Bearer active-token',
        },
        {
          url: 'https://api.example.test/api/auth/session/refresh',
          authorization: 'Refresh active-refresh-token',
        },
        ]
        : [
          {
            url: 'https://api.example.test/api/data',
            authorization: 'Bearer active-token',
          },
        ],
    );
    expect(store.clearToken).toHaveBeenCalledTimes(1);
    expect(store.setToken).not.toHaveBeenCalled();
  });

  it('preserves a native session for unrelated 401 responses', async () => {
    jest.resetModules();
    process.env.NEXT_PUBLIC_MOBILE_BUILD = '1';
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test';
    const session = {
      version: 2 as const,
      accessToken: 'active-token',
      refreshToken: 'active-refresh-token',
      accessExpiresAt: Math.floor(Date.now() / 1000) + 600,
      refreshExpiresAt: Math.floor(Date.now() / 1000) + 3_600,
      absoluteExpiresAt: Math.floor(Date.now() / 1000) + 7_200,
    };
    const store = {
      getSession: jest.fn(async () => session),
      setSession: jest.fn(async () => undefined),
      getToken: jest.fn(async () => 'active-token'),
      setToken: jest.fn(async () => undefined),
      clearToken: jest.fn(async () => undefined),
    };
    jest.doMock('../services/nativeSessionStore', () => ({ nativeSessionStore: store }));
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: jest.fn(async () => new Response(JSON.stringify({ code: 'INVALID_CREDENTIALS' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })),
    });

    const { apiFetch } = await import('../services/apiClient');
    const response = await apiFetch('/api/auth/password/login', { method: 'POST' });

    expect(store.clearToken).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ code: 'INVALID_CREDENTIALS' });
  });

  it('recognizes an actual Capacitor platform without relying on a build flag', async () => {
    jest.resetModules();
    delete process.env.NEXT_PUBLIC_MOBILE_BUILD;
    const { Capacitor } = await import('@capacitor/core');
    jest.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);

    const { isNativeAppRuntime } = await import('../services/apiClient');

    expect(isNativeAppRuntime()).toBe(true);
  });

  it.each(['signed_out', 'account'] as const)(
    'does not create an implicit native guest in %s mode without a token',
    async (mode) => {
    jest.resetModules();
    installBrowserStorage();
    process.env.NEXT_PUBLIC_MOBILE_BUILD = '1';
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test';
    const store = {
      getToken: jest.fn(async () => null),
      setToken: jest.fn(async () => undefined),
      clearToken: jest.fn(async () => undefined),
    };
    jest.doMock('../services/nativeSessionStore', () => ({ nativeSessionStore: store }));

    const intent = await import('../services/authSessionIntent');
    intent.setAuthSessionMode(mode);
    const calls: string[] = [];
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: jest.fn(async (input: RequestInfo | URL) => {
        calls.push(String(input));
        return new Response('{}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    });

    const { apiFetch } = await import('../services/apiClient');
    await expect(apiFetch('/api/auth/telegram/login', { method: 'POST' }))
      .resolves.toMatchObject({ status: 200 });
    expect(calls).toEqual(['https://api.example.test/api/auth/telegram/login']);
    expect(store.setToken).not.toHaveBeenCalled();
    },
  );

  it('recognizes forwarded same-origin requests and standard Capacitor origins', () => {
    const origins = 'https://mobile.example.com';
    expect(isAllowedNativeOrigin('https://localhost', origins)).toBe(true);
    expect(isAllowedNativeOrigin('capacitor://localhost', origins)).toBe(true);
    expect(isAllowedNativeOrigin('https://mobile.example.com/', origins)).toBe(true);
    expect(isAllowedNativeOrigin('https://unknown.example.com', origins)).toBe(false);

    const values: Record<string, string> = {
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'api.example.test',
      host: '0.0.0.0:8080',
    };
    const headers = { get: (name: string) => values[name.toLowerCase()] || null };
    const forwardedOrigin = getForwardedApiOrigin(headers, 'http://0.0.0.0:8080');
    expect(forwardedOrigin).toBe('https://api.example.test');
    expect(isSameApiOrigin('https://api.example.test/', [
      'http://0.0.0.0:8080',
      forwardedOrigin,
    ])).toBe(true);

    const middleware = read('middleware.ts');
    const cors = read('lib/apiCors.ts');
    expect(middleware).toContain("matcher: '/api/:path*'");
    expect(middleware).toContain("request.method === 'OPTIONS'");
    expect(middleware).toContain("fetchSite === 'cross-site'");
    expect(middleware).toContain("'CROSS_SITE_REQUEST_DENIED'");
    expect(cors).toContain("headers.get('x-forwarded-host')");
    expect(cors).toContain("headers.get('x-forwarded-proto')");
    expect(middleware).toContain("'Vary'");
    expect(middleware).not.toContain("Access-Control-Allow-Origin', '*");
    expect(middleware).not.toContain('Access-Control-Allow-Credentials');
  });

  it('routes client API calls through apiClient and disables Stars in native builds', () => {
    const runtimeFiles = [
      ...fs.readdirSync(path.join(ROOT, 'services'))
        .filter((file) => file.endsWith('.ts') && file !== 'apiClient.ts')
        .map((file) => `services/${file}`),
      'views/Settings.tsx',
      'views/Paywall.tsx',
      'lib/personalForecastPrewarm.ts',
    ];
    for (const file of runtimeFiles) {
      expect(read(file)).not.toMatch(/\bfetch\s*\(\s*['"`]\/api\//);
      expect(read(file)).not.toContain('process.env.NEXT_PUBLIC_API_URL');
    }
    expect(read('services/telegramService.ts')).toContain('if (isNativeAppRuntime()) return false');
    expect(read('package.json')).toContain('"build:mobile": "node scripts/build-mobile.mjs"');
    const mobileBuild = read('scripts/build-mobile.mjs');
    expect(mobileBuild).toContain('NEXT_PUBLIC_DISTRIBUTION_CHANNEL');
    expect(mobileBuild).toContain('NEXT_PUBLIC_API_URL');
    expect(mobileBuild).toContain("process.env.NEXT_PUBLIC_MOBILE_BUILD = '1'");
    const androidDebug = read('scripts/android-debug.mjs');
    expect(androidDebug).toContain("run('npm', ['run', 'build:mobile'])");
    expect(androidDebug).toContain("run('npx', ['cap', 'sync', 'android'])");
    expect(read('next.config.js')).toContain("output: isMobileBuild ? 'export' : 'standalone'");
  });
});
