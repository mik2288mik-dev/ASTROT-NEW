import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const mockVerifyIdToken = jest.fn();
const mockResolveVerifiedIdentity = jest.fn();
const mockPoolQuery = jest.fn();
const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: mockVerifyIdToken,
  })),
}));

jest.mock('../lib/db', () => ({
  getPool: jest.fn(() => ({
    query: mockPoolQuery,
    connect: jest.fn(async () => ({
      query: mockClientQuery,
      release: mockClientRelease,
    })),
  })),
}));

jest.mock('../lib/auth/accountIdentity', () => ({
  resolveVerifiedIdentity: mockResolveVerifiedIdentity,
}));

import {
  beginNativeProviderAuth,
  completeNativeProviderAuth,
  getNativeProviderAuthCapabilities,
} from '../lib/auth/nativeProviderAuth';
import { getAccountAuthCapabilities as getServerAccountAuthCapabilities } from '../pages/api/auth/capabilities';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');

type Challenge = {
  challenge_id: string;
  provider: 'google' | 'yandex' | 'vk';
  purpose: 'login' | 'link';
  user_id: string | null;
  state_hash: string | null;
  metadata: Record<string, unknown>;
  attempts: number;
  claimed_at: string | null;
};

function arrangeChallenge(challenge: Challenge) {
  mockClientQuery.mockImplementation(async (sql: string) => {
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 };
    if (sql.includes('FROM auth_challenges')) return { rows: [challenge], rowCount: 1 };
    if (sql.includes('SET claimed_at')) return { rows: [], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  });
  mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 1 });
}

describe('native provider credential authentication', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_AUTH_CLIENT_ID = 'google-web-client.apps.googleusercontent.com';
    process.env.NEXT_PUBLIC_DISTRIBUTION_CHANNEL = 'google_play';
    process.env.YANDEX_AUTH_CLIENT_ID = 'yandex-client';
    process.env.VK_AUTH_CLIENT_ID = '12345678';
    process.env.EMAIL_OTP_DELIVERY_URL = 'https://mailer.example.test/auth-code';
    process.env.EMAIL_OTP_DELIVERY_SECRET = 'test-mailer-secret';
    delete process.env.RESEND_API_KEY;
    delete process.env.AUTH_EMAIL_FROM;
    process.env.APP_SESSION_SECRET = 'app-session-secret-that-is-at-least-32-bytes';
    process.env.AUTH_RATE_LIMIT_SECRET = 'rate-limit-secret-that-is-at-least-32-bytes';
    process.env.EMAIL_OTP_HASH_SECRET = 'email-code-secret-that-is-at-least-32-bytes';
    mockResolveVerifiedIdentity.mockResolvedValue({ userId: '-101', linked: true, existing: false });
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('reports native providers without requiring public origins or browser client secrets', () => {
    delete process.env.PUBLIC_APP_ORIGIN;
    delete process.env.GOOGLE_AUTH_CLIENT_SECRET;
    delete process.env.YANDEX_AUTH_CLIENT_SECRET;
    delete process.env.VK_AUTH_CLIENT_SECRET;

    expect(getNativeProviderAuthCapabilities()).toEqual({
      google: true,
      yandex: true,
      vk: true,
      email: true,
    });
  });

  it('reports browser providers only when redirect origin and server credentials are ready', () => {
    process.env.PUBLIC_APP_ORIGIN = 'https://app.example.test';
    process.env.GOOGLE_AUTH_CLIENT_SECRET = 'google-server-secret';
    process.env.YANDEX_AUTH_CLIENT_SECRET = 'yandex-server-secret';
    process.env.VK_AUTH_CLIENT_SECRET = 'vk-server-secret';

    expect(getServerAccountAuthCapabilities('browser')).toMatchObject({
      google: true,
      yandex: true,
      vk: true,
      emailPassword: true,
      emailDelivery: true,
    });

    delete process.env.GOOGLE_AUTH_CLIENT_SECRET;
    expect(getServerAccountAuthCapabilities('browser')).toMatchObject({
      google: false,
      yandex: true,
      vk: true,
    });
    process.env.PUBLIC_APP_ORIGIN = 'http://app.example.test';
    expect(getServerAccountAuthCapabilities('browser')).toMatchObject({
      google: false,
      yandex: false,
      vk: false,
    });
    expect(getServerAccountAuthCapabilities('native')).toMatchObject({
      google: true,
      yandex: true,
      vk: true,
    });
  });

  it('keeps password login available without mail delivery and fails closed on short production secrets', () => {
    delete process.env.EMAIL_OTP_DELIVERY_URL;
    delete process.env.EMAIL_OTP_DELIVERY_SECRET;
    expect(getServerAccountAuthCapabilities('native')).toMatchObject({
      email: false,
      emailPassword: true,
      emailDelivery: false,
    });

    const mutableEnv = process.env as Record<string, string | undefined>;
    const nodeEnv = mutableEnv.NODE_ENV;
    mutableEnv.NODE_ENV = 'production';
    process.env.AUTH_RATE_LIMIT_SECRET = 'short';
    process.env.EMAIL_OTP_HASH_SECRET = 'short';
    try {
      expect(getServerAccountAuthCapabilities('native')).toMatchObject({
        email: false,
        emailPassword: false,
        emailDelivery: false,
      });
    } finally {
      if (nodeEnv == null) delete mutableEnv.NODE_ENV;
      else mutableEnv.NODE_ENV = nodeEnv;
    }
  });

  it('requires an independent production rate-limit secret instead of falling back to session or OTP HMAC secrets', () => {
    const mutableEnv = process.env as Record<string, string | undefined>;
    const nodeEnv = mutableEnv.NODE_ENV;
    mutableEnv.NODE_ENV = 'production';
    delete process.env.AUTH_RATE_LIMIT_SECRET;

    try {
      expect(getServerAccountAuthCapabilities('native')).toMatchObject({
        emailPassword: false,
        emailDelivery: false,
      });

      process.env.AUTH_RATE_LIMIT_SECRET = process.env.EMAIL_OTP_HASH_SECRET;
      expect(getServerAccountAuthCapabilities('native')).toMatchObject({
        emailPassword: false,
        emailDelivery: false,
      });
      delete process.env.APP_SESSION_SECRET;
      process.env.BOT_TOKEN = 'telegram-bot-token-that-is-at-least-32-bytes';
      process.env.AUTH_RATE_LIMIT_SECRET = 'another-independent-rate-secret-at-least-32-bytes';
      expect(getServerAccountAuthCapabilities('native')).toMatchObject({
        emailPassword: false,
        emailDelivery: false,
      });
    } finally {
      if (nodeEnv == null) delete mutableEnv.NODE_ENV;
      else mutableEnv.NODE_ENV = nodeEnv;
    }
  });

  it('disables email delivery when OTP and app-session secrets are reused', () => {
    const mutableEnv = process.env as Record<string, string | undefined>;
    const nodeEnv = mutableEnv.NODE_ENV;
    mutableEnv.NODE_ENV = 'production';
    process.env.EMAIL_OTP_HASH_SECRET = process.env.APP_SESSION_SECRET;
    try {
      expect(getServerAccountAuthCapabilities('native')).toMatchObject({
        emailPassword: true,
        emailDelivery: false,
      });
    } finally {
      if (nodeEnv == null) delete mutableEnv.NODE_ENV;
      else mutableEnv.NODE_ENV = nodeEnv;
    }
  });

  it('reports email delivery ready when the direct Resend integration is configured', () => {
    delete process.env.EMAIL_OTP_DELIVERY_URL;
    delete process.env.EMAIL_OTP_DELIVERY_SECRET;
    process.env.RESEND_API_KEY = 're_test_server_only_key_1234567890';
    process.env.AUTH_EMAIL_FROM = 'Твой Гороскоп <noreply@auth.tvoi-goroskop.ru>';

    expect(getServerAccountAuthCapabilities('native')).toMatchObject({
      email: true,
      emailPassword: true,
      emailDelivery: true,
    });
  });

  it('creates a Google challenge and verifies audience, issuer/expiry through the official verifier, and nonce', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    const started = await beginNativeProviderAuth({ provider: 'google', purpose: 'login' });

    expect(started.provider).toBe('google');
    expect(started.config).toMatchObject({
      webClientId: 'google-web-client.apps.googleusercontent.com',
    });
    expect(String(started.config.nonce)).toHaveLength(43);
    expect(mockPoolQuery.mock.calls[0][0]).toContain('INSERT INTO auth_challenges');

    arrangeChallenge({
      challenge_id: started.challengeId,
      provider: 'google',
      purpose: 'login',
      user_id: null,
      state_hash: null,
      metadata: { nonce: started.config.nonce },
      attempts: 0,
      claimed_at: null,
    });
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-subject-1',
        aud: 'google-web-client.apps.googleusercontent.com',
        iss: 'https://accounts.google.com',
        exp: Math.floor(Date.now() / 1000) + 300,
        nonce: started.config.nonce,
        email: 'verified@example.test',
        email_verified: true,
        name: 'Verified User',
      }),
    });

    await expect(completeNativeProviderAuth({
      provider: 'google',
      challengeId: started.challengeId,
      credential: { idToken: 'header.payload.signature' },
      currentUserId: null,
    })).resolves.toMatchObject({ userId: '-101' });

    expect(mockVerifyIdToken).toHaveBeenCalledWith(expect.objectContaining({
      idToken: 'header.payload.signature',
      audience: 'google-web-client.apps.googleusercontent.com',
    }));
    expect(mockResolveVerifiedIdentity).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'google',
      subject: 'google-subject-1',
    }), null);
  });

  it('rejects direct native Google starts in RuStore before creating a challenge', async () => {
    process.env.NEXT_PUBLIC_DISTRIBUTION_CHANNEL = 'rustore';

    await expect(beginNativeProviderAuth({ provider: 'google', purpose: 'login' }))
      .rejects.toMatchObject({ status: 403, code: 'AUTH_PROVIDER_UNAVAILABLE' });
    expect(mockPoolQuery).not.toHaveBeenCalled();
  });

  it('rejects a link challenge unless the same active internal account is re-authenticated', async () => {
    arrangeChallenge({
      challenge_id: 'link-challenge',
      provider: 'google',
      purpose: 'link',
      user_id: '42',
      state_hash: null,
      metadata: { nonce: 'expected-nonce' },
      attempts: 0,
      claimed_at: null,
    });

    await expect(completeNativeProviderAuth({
      provider: 'google',
      challengeId: 'link-challenge',
      credential: { idToken: 'header.payload.signature' },
      currentUserId: '99',
    })).rejects.toMatchObject({ status: 403, code: 'AUTH_LINK_SESSION_MISMATCH' });
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
    expect(mockResolveVerifiedIdentity).not.toHaveBeenCalled();
  });

  it('accepts Yandex only for the configured client and uses psuid as the identity subject', async () => {
    arrangeChallenge({
      challenge_id: 'yandex-challenge',
      provider: 'yandex',
      purpose: 'login',
      user_id: null,
      state_hash: null,
      metadata: {},
      attempts: 0,
      claimed_at: null,
    });
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        client_id: 'yandex-client',
        psuid: 'yandex-psuid-1',
        id: 'legacy-id',
        default_email: 'person@yandex.test',
        display_name: 'Yandex User',
      }),
    })) as any;

    await completeNativeProviderAuth({
      provider: 'yandex',
      challengeId: 'yandex-challenge',
      credential: { accessToken: 'opaque-yandex-token' },
      currentUserId: null,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://login.yandex.ru/info?format=json',
      expect.objectContaining({ headers: { Authorization: 'OAuth opaque-yandex-token' } }),
    );
    expect(mockResolveVerifiedIdentity).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'yandex',
      subject: 'yandex-psuid-1',
    }), null);
  });

  it('rejects a Yandex access token issued to a different application', async () => {
    arrangeChallenge({
      challenge_id: 'wrong-yandex-client',
      provider: 'yandex',
      purpose: 'login',
      user_id: null,
      state_hash: null,
      metadata: {},
      attempts: 0,
      claimed_at: null,
    });
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ client_id: 'attacker-client', psuid: 'attacker-subject' }),
    })) as any;

    await expect(completeNativeProviderAuth({
      provider: 'yandex',
      challengeId: 'wrong-yandex-client',
      credential: { accessToken: 'opaque-yandex-token' },
      currentUserId: null,
    })).rejects.toMatchObject({ status: 401, code: 'PROVIDER_CREDENTIAL_INVALID' });
    expect(mockResolveVerifiedIdentity).not.toHaveBeenCalled();
  });

  it('creates VK OAuth 2.1 state and S256 PKCE without returning the verifier', async () => {
    mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    const started = await beginNativeProviderAuth({ provider: 'vk', purpose: 'login' });

    expect(started.config).toMatchObject({
      clientId: '12345678',
      redirectUri: 'vk12345678://vk.ru/blank.html',
      codeChallengeMethod: 'S256',
    });
    expect(String(started.config.state).length).toBeGreaterThanOrEqual(32);
    expect(String(started.config.codeChallenge).length).toBeGreaterThanOrEqual(40);
    expect(started.config).not.toHaveProperty('codeVerifier');

    const insertValues = mockPoolQuery.mock.calls[0][1] as unknown[];
    const metadata = JSON.parse(String(insertValues[6]));
    expect(metadata.codeVerifier).toBeTruthy();
    expect(insertValues[4]).toBe(
      crypto.createHash('sha256').update(String(started.config.state)).digest('hex'),
    );
  });

  it('exchanges a VK code with the stored verifier and binds identity to user_id', async () => {
    const state = 'vk-state-for-this-challenge';
    arrangeChallenge({
      challenge_id: 'vk-complete-challenge',
      provider: 'vk',
      purpose: 'login',
      user_id: null,
      state_hash: crypto.createHash('sha256').update(state).digest('hex'),
      metadata: { codeVerifier: 'stored-pkce-code-verifier' },
      attempts: 0,
      claimed_at: null,
    });
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'vk-access-token', user_id: 'vk-user-1', state }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: { user_id: 'vk-user-1', first_name: 'VK', last_name: 'User' },
        }),
      }) as any;

    await completeNativeProviderAuth({
      provider: 'vk',
      challengeId: 'vk-complete-challenge',
      credential: { code: 'vk-authorization-code', deviceId: 'vk-device-id', state },
      currentUserId: null,
    });

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'https://id.vk.ru/oauth2/auth',
      expect.objectContaining({ method: 'POST' }),
    );
    const tokenRequest = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(String(tokenRequest.body)).toContain('code_verifier=stored-pkce-code-verifier');
    expect(String(tokenRequest.body)).toContain('device_id=vk-device-id');
    expect(mockResolveVerifiedIdentity).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'vk',
      subject: 'vk-user-1',
    }), null);
  });

  it.each([
    {
      name: 'missing returned state',
      token: { access_token: 'vk-access-token', user_id: 'vk-user-1' },
      user: { user: { user_id: 'vk-user-1' } },
    },
    {
      name: 'mismatched token and user-info subjects',
      token: { access_token: 'vk-access-token', user_id: 'vk-user-1', state: 'vk-strict-state' },
      user: { user: { user_id: 'vk-user-2' } },
    },
  ])('rejects VK proof with $name', async ({ token, user }) => {
    const state = 'vk-strict-state';
    arrangeChallenge({
      challenge_id: 'vk-strict-challenge',
      provider: 'vk',
      purpose: 'login',
      user_id: null,
      state_hash: crypto.createHash('sha256').update(state).digest('hex'),
      metadata: { codeVerifier: 'stored-pkce-code-verifier' },
      attempts: 0,
      claimed_at: null,
    });
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => token })
      .mockResolvedValueOnce({ ok: true, json: async () => user }) as any;

    await expect(completeNativeProviderAuth({
      provider: 'vk',
      challengeId: 'vk-strict-challenge',
      credential: { code: 'vk-authorization-code', deviceId: 'vk-device-id', state },
      currentUserId: null,
    })).rejects.toMatchObject({ status: 401, code: 'PROVIDER_CREDENTIAL_INVALID' });
    expect(mockResolveVerifiedIdentity).not.toHaveBeenCalled();
  });

  it('keeps link re-authentication and direct server sessions in the route contract', () => {
    const startRoute = read('pages/api/auth/provider/[provider]/start.ts');
    const completeRoute = read('pages/api/auth/provider/[provider]/complete.ts');
    const capabilities = read('pages/api/auth/capabilities.ts');
    const implementation = read('lib/auth/nativeProviderAuth.ts');

    expect(startRoute).toContain('requireAppUser');
    expect(completeRoute).toContain('requireAppUser');
    expect(completeRoute).toContain('createAppUserSession');
    expect(completeRoute).toContain('toPublicAppProfile');
    expect(completeRoute).toContain('currentUserId');
    expect(completeRoute).toContain('currentSessionId');
    expect(completeRoute).toContain("kind: 'native'");
    expect(completeRoute).not.toContain('setAppSessionCookie');
    expect(completeRoute).not.toContain("req.body?.native === false");
    expect(capabilities).toContain('getAccountAuthCapabilities(runtime, channel)');
    expect(capabilities).toContain('PUBLIC_APP_ORIGIN');
    expect(implementation).not.toContain('PUBLIC_APP_ORIGIN');
    expect(implementation).toContain("'https://id.vk.ru/oauth2/auth'");
    expect(implementation).toContain("'https://id.vk.ru/oauth2/user_info'");
    expect(implementation).toContain('claimed_at');
    expect(implementation).toContain('consumed_at');
    expect(implementation).toContain('requiredSession: { userId: linkUserId');
    expect(implementation).not.toMatch(/console\.(?:log|info|warn|error)\(/);
  });
});
