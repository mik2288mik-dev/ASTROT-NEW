import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const mockPoolQuery = jest.fn();
const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();
const mockConnect = jest.fn();
const mockConsumeAuthRateLimit = jest.fn();
const mockRequireAppUser = jest.fn();

jest.mock('../lib/db', () => ({
  getPool: () => ({
    query: mockPoolQuery,
    connect: mockConnect,
  }),
  db: {
    users: {
      get: jest.fn(),
    },
  },
}));

jest.mock('../lib/auth/authRateLimit', () => ({
  consumeAuthRateLimit: mockConsumeAuthRateLimit,
  getAuthClientKey: jest.fn(() => 'ip:test-client'),
}));

jest.mock('../lib/auth/appAuth', () => ({
  requireAppUser: mockRequireAppUser,
  createAppUserSession: jest.fn(),
  setAppSessionCookie: jest.fn(),
}));

import {
  consumeAuthExchange,
  finishOAuth,
} from '../lib/auth/accountIdentity';
import startOAuthHandler from '../pages/api/auth/oauth/[provider]/start';
import exchangeHandler from '../pages/api/auth/exchange';

const ROOT = path.resolve(__dirname, '..');
const originalFetch = global.fetch;
const originalEnv = { ...process.env };

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function boundExchangeHash(code: string, binding: string): string {
  return sha256(`oauth-browser-exchange\0${binding}\0${code}`);
}

function mockResponse() {
  const result = {
    statusCode: 200,
    body: null as any,
    headers: {} as Record<string, string | string[]>,
  };
  const response = {
    status(code: number) {
      result.statusCode = code;
      return response;
    },
    json(body: any) {
      result.body = body;
      return response;
    },
    setHeader(name: string, value: string | string[]) {
      result.headers[name] = value;
      return response;
    },
    getHeader(name: string) {
      return result.headers[name];
    },
    redirect(code: number, location: string) {
      result.statusCode = code;
      result.headers.Location = location;
      return response;
    },
  };
  return { response: response as any, result };
}

describe('browser OAuth binding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PUBLIC_APP_ORIGIN = 'https://app.example.test';
    process.env.GOOGLE_AUTH_CLIENT_ID = 'google-client';
    process.env.GOOGLE_AUTH_CLIENT_SECRET = 'google-secret';
    mockPoolQuery.mockResolvedValue({ rowCount: 1, rows: [] });
    mockConnect.mockResolvedValue({
      query: mockClientQuery,
      release: mockClientRelease,
    });
    mockRequireAppUser.mockResolvedValue({
      userId: '42',
      sessionId: 'session-42',
      provider: 'web_guest',
      isGuest: false,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('rate-limits web starts, stores only a binding hash, and sets a short-lived HttpOnly cookie', async () => {
    const { response, result } = mockResponse();

    await startOAuthHandler({
      method: 'POST',
      query: { provider: 'google' },
      body: { purpose: 'login' },
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    } as any, response);

    expect(result.statusCode).toBe(200);
    expect(mockConsumeAuthRateLimit).toHaveBeenCalledTimes(2);
    expect(mockConsumeAuthRateLimit).toHaveBeenCalledWith(expect.objectContaining({
      scope: 'oauth_browser_start_client',
      key: 'ip:test-client',
    }));
    expect(mockConsumeAuthRateLimit).toHaveBeenCalledWith(expect.objectContaining({
      scope: 'oauth_browser_start_global',
      key: 'global',
    }));

    const cookie = String(result.headers['Set-Cookie'] || '');
    expect(cookie).toMatch(/^__Host-lumia_oauth_binding=[A-Za-z0-9_-]+;/);
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Max-Age=600');

    const insert = mockPoolQuery.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO auth_challenges'));
    expect(insert).toBeTruthy();
    const metadata = JSON.parse(String(insert?.[1]?.[6] || '{}'));
    expect(metadata.oauthBindingHash).toMatch(/^[a-f0-9]{64}$/);
    expect(metadata).not.toHaveProperty('oauthBinding');

    const cleanupSql = mockPoolQuery.mock.calls
      .map(([sql]) => String(sql))
      .filter((sql) => sql.includes('DELETE FROM auth_'))
      .join('\n');
    expect(cleanupSql).toContain('LIMIT 250');
  });

  it('retires the legacy native browser-OAuth start', async () => {
    const { response, result } = mockResponse();

    await startOAuthHandler({
      method: 'POST',
      query: { provider: 'google' },
      body: { purpose: 'login', native: true },
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    } as any, response);

    expect(result.statusCode).toBe(410);
    expect(result.body).toMatchObject({ error: 'NATIVE_BROWSER_OAUTH_RETIRED' });
    expect(mockPoolQuery).not.toHaveBeenCalled();
  });

  it('binds account linking to the initiating active app session through callback completion', async () => {
    const { response, result } = mockResponse();

    await startOAuthHandler({
      method: 'POST',
      query: { provider: 'google' },
      body: { purpose: 'link' },
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    } as any, response);

    expect(result.statusCode).toBe(200);
    const insert = mockPoolQuery.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO auth_challenges'));
    const metadata = JSON.parse(String(insert?.[1]?.[6] || '{}'));
    expect(insert?.[1]?.[3]).toBe('42');
    expect(metadata.requiredSessionId).toBe('session-42');

    const identitySource = fs.readFileSync(path.join(ROOT, 'lib/auth/accountIdentity.ts'), 'utf8');
    expect(identitySource).toContain('requiredSessionId');
    expect(identitySource).toContain('requiredSession: { userId: linkUserId, sessionId: requiredSessionId }');
  });

  it('rejects a callback when its browser binding differs from the initiating browser', async () => {
    const stateSecret = 'oauth-state-secret';
    const attackerBinding = 'attacker-browser-binding';
    mockClientQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT * FROM auth_challenges')) {
        return {
          rowCount: 1,
          rows: [{
            challenge_id: 'challenge-1',
            provider: 'google',
            purpose: 'login',
            user_id: null,
            state_hash: sha256(stateSecret),
            redirect_uri: 'https://app.example.test/api/auth/oauth/google/callback',
            metadata: {
              codeVerifier: 'pkce-verifier',
              oauthBindingHash: sha256(attackerBinding),
            },
          }],
        };
      }
      return { rowCount: 1, rows: [] };
    });
    global.fetch = jest.fn() as any;

    await expect((finishOAuth as any)({
      provider: 'google',
      code: 'provider-code',
      state: `challenge-1.${stateSecret}`,
      browserBinding: 'different-browser-binding',
    })).rejects.toMatchObject({
      status: 401,
      code: 'OAUTH_BROWSER_BINDING_INVALID',
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('accepts only the browser binding that was used to hash an exchange code', async () => {
    const exchangeCode = 'one-time-exchange-code';
    const ownerBinding = 'owner-browser-binding';
    const storedHash = boundExchangeHash(exchangeCode, ownerBinding);
    mockClientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes('SELECT user_id, session_kind')) {
        return params?.[0] === storedHash
          ? { rowCount: 1, rows: [{ user_id: '42', session_kind: 'web' }] }
          : { rowCount: 0, rows: [] };
      }
      return { rowCount: 1, rows: [] };
    });

    await expect((consumeAuthExchange as any)(exchangeCode, 'transferred-to-another-browser'))
      .rejects.toMatchObject({ code: 'AUTH_EXCHANGE_INVALID' });

    mockClientQuery.mockClear();
    await expect((consumeAuthExchange as any)(exchangeCode, ownerBinding)).resolves.toEqual({
      userId: '42',
      kind: 'web',
    });
  });

  it('requires the binding cookie at the exchange route and removes legacy Android callback code', async () => {
    const { response, result } = mockResponse();
    await exchangeHandler({
      method: 'POST',
      body: { code: 'transferred-code' },
      headers: {},
    } as any, response);

    expect(result.statusCode).toBe(401);
    expect(result.body).toMatchObject({ error: 'OAUTH_BROWSER_BINDING_REQUIRED' });

    const app = fs.readFileSync(path.join(ROOT, 'App.tsx'), 'utf8');
    const service = fs.readFileSync(path.join(ROOT, 'services/accountAuthService.ts'), 'utf8');
    expect(app).not.toContain('exchangeNativeLoginCode');
    expect(app).not.toContain("parsed.host !== 'auth'");
    expect(service).not.toContain('exchangeNativeLoginCode');
  });
});
