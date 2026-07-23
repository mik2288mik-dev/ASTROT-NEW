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
  afterEach(() => {
    jest.restoreAllMocks();
    jest.dontMock('../lib/db');
    Object.defineProperty(globalThis, 'fetch', { value: originalFetch, configurable: true });
    delete process.env.NEXT_PUBLIC_MOBILE_BUILD;
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  it('creates one signed native guest and reuses it on the next request', async () => {
    const { handler, auth, users, set } = await setupNativeHandler();
    const first = mockResponse();
    await handler({ method: 'POST', headers: {} } as any, first.response);

    expect(first.result.statusCode).toBe(200);
    expect(first.result.body.profile).toMatchObject({
      authProvider: 'native',
      isGuest: true,
      isPremium: false,
    });
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
      body: { error: 'APP_AUTH_REQUIRED' },
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

  it('uses the configured HTTPS API base, stores bearer auth, and retries one 401 only once', async () => {
    jest.resetModules();
    process.env.NEXT_PUBLIC_MOBILE_BUILD = '1';
    process.env.NEXT_PUBLIC_API_URL = 'https://astrot-production.up.railway.app/';
    let storedToken: string | null = 'expired-token';
    const store = {
      getToken: jest.fn(async () => storedToken),
      setToken: jest.fn(async (token: string) => { storedToken = token; }),
      clearToken: jest.fn(async () => { storedToken = null; }),
    };
    jest.doMock('../services/nativeSessionStore', () => ({ nativeSessionStore: store }));

    const calls: Array<{ url: string; authorization: string | null }> = [];
    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const authorization = new Headers(init?.headers).get('Authorization');
      calls.push({ url, authorization });
      if (url.endsWith('/api/auth/native-guest')) {
        return new Response(JSON.stringify({ token: 'fresh-token', profile: { id: '-1' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(null, { status: calls.filter((call) => call.url.endsWith('/api/data')).length === 1 ? 401 : 200 });
    });
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true });

    const { apiFetch, getApiBaseUrl } = require('../services/apiClient');
    expect(getApiBaseUrl()).toBe('https://astrot-production.up.railway.app');
    const response = await apiFetch('/api/data');

    expect(response.status).toBe(200);
    expect(calls).toEqual([
      {
        url: 'https://astrot-production.up.railway.app/api/data',
        authorization: 'Bearer expired-token',
      },
      {
        url: 'https://astrot-production.up.railway.app/api/auth/native-guest',
        authorization: null,
      },
      {
        url: 'https://astrot-production.up.railway.app/api/data',
        authorization: 'Bearer fresh-token',
      },
    ]);
  });

  it('recognizes Railway forwarded same-origin requests and standard Capacitor origins', () => {
    const origins = 'https://mobile.example.com';
    expect(isAllowedNativeOrigin('https://localhost', origins)).toBe(true);
    expect(isAllowedNativeOrigin('capacitor://localhost', origins)).toBe(true);
    expect(isAllowedNativeOrigin('https://mobile.example.com/', origins)).toBe(true);
    expect(isAllowedNativeOrigin('https://unknown.example.com', origins)).toBe(false);

    const values: Record<string, string> = {
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'astrot-production.up.railway.app',
      host: '0.0.0.0:8080',
    };
    const headers = { get: (name: string) => values[name.toLowerCase()] || null };
    const forwardedOrigin = getForwardedApiOrigin(headers, 'http://0.0.0.0:8080');
    expect(forwardedOrigin).toBe('https://astrot-production.up.railway.app');
    expect(isSameApiOrigin('https://astrot-production.up.railway.app/', [
      'http://0.0.0.0:8080',
      forwardedOrigin,
    ])).toBe(true);

    const middleware = read('middleware.ts');
    expect(middleware).toContain("matcher: '/api/:path*'");
    expect(middleware).toContain("request.method === 'OPTIONS'");
    expect(middleware).toContain("headers.get('x-forwarded-host')");
    expect(middleware).toContain("headers.get('x-forwarded-proto')");
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
      'lib/dailyQuestions.ts',
    ];
    for (const file of runtimeFiles) {
      expect(read(file)).not.toMatch(/\bfetch\s*\(\s*['"`]\/api\//);
      expect(read(file)).not.toContain('process.env.NEXT_PUBLIC_API_URL');
    }
    expect(read('services/telegramService.ts')).toContain('if (isNativeAppRuntime()) return false');
    expect(read('package.json')).toContain('"build:mobile": "cross-env MOBILE_BUILD=1 NEXT_PUBLIC_MOBILE_BUILD=1 next build"');
    expect(read('next.config.js')).toContain("output: isMobileBuild ? 'export' : 'standalone'");
  });
});
