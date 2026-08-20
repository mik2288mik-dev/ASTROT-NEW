import {
  ACCESS_TOKEN_TTL_SECONDS,
  LEGACY_SESSION_TTL_SECONDS,
  REFRESH_ABSOLUTE_TTL_SECONDS,
  REFRESH_IDLE_TTL_SECONDS,
  createAccessSessionToken,
  createLegacySessionToken,
  createRefreshSessionToken,
  hashRefreshSessionToken,
  verifyAppSessionToken,
  verifyRefreshSessionToken,
} from '../lib/auth/sessionTokens';

const NOW_MS = Date.UTC(2026, 7, 20, 12, 0, 0);

describe('versioned app session tokens', () => {
  const originalSecret = process.env.APP_SESSION_SECRET;

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW_MS);
    process.env.APP_SESSION_SECRET = 'test-app-session-secret-that-is-long-enough';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.APP_SESSION_SECRET;
    else process.env.APP_SESSION_SECRET = originalSecret;
  });

  it('issues a typed access token for exactly fifteen minutes', () => {
    const token = createAccessSessionToken({
      userId: '42',
      sessionId: '5e0e1f8b-166f-4aa6-9ee4-a1ca743b21ad',
      provider: 'native',
    });
    const payload = verifyAppSessionToken(token);

    expect(token).toMatch(/^a2\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(payload).toMatchObject({
      version: 2,
      tokenType: 'access',
      userId: '42',
      provider: 'native',
    });
    expect(payload!.exp - payload!.issuedAt).toBe(ACCESS_TOKEN_TTL_SECONDS);
    expect(ACCESS_TOKEN_TTL_SECONDS).toBe(15 * 60);
  });

  it('continues to verify the old two-part token during the client rollout', () => {
    const token = createLegacySessionToken({
      userId: '42',
      sessionId: 'legacy-session',
      provider: 'web_guest',
    });
    const payload = verifyAppSessionToken(token);

    expect(token.split('.')).toHaveLength(2);
    expect(payload).toMatchObject({ version: 1, userId: '42', sessionId: 'legacy-session' });
    expect(payload!.exp - Math.floor(NOW_MS / 1000)).toBe(LEGACY_SESSION_TTL_SECONDS);
  });

  it('signs a bounded rotating refresh token and stores only a domain-separated hash', () => {
    const sessionId = '5e0e1f8b-166f-4aa6-9ee4-a1ca743b21ad';
    const token = createRefreshSessionToken({
      userId: '42',
      sessionId,
      generation: 0,
      absoluteExpiresAt: Math.floor(NOW_MS / 1000) + REFRESH_ABSOLUTE_TTL_SECONDS,
    });
    const payload = verifyRefreshSessionToken(token);
    const storedHash = hashRefreshSessionToken(token);

    expect(token).toMatch(/^r2\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(payload).toMatchObject({
      version: 2,
      tokenType: 'refresh',
      userId: '42',
      sessionId,
      generation: 0,
    });
    expect(Buffer.from(payload!.nonce, 'base64url')).toHaveLength(32);
    expect(storedHash).toMatch(/^[a-f0-9]{64}$/);
    expect(storedHash).not.toContain(token);
    expect(REFRESH_IDLE_TTL_SECONDS).toBe(90 * 24 * 60 * 60);
    expect(REFRESH_ABSOLUTE_TTL_SECONDS).toBe(365 * 24 * 60 * 60);
  });

  it('rejects tampering, type confusion, malformed payloads, and oversized refresh input', () => {
    const access = createAccessSessionToken({
      userId: '42',
      sessionId: '5e0e1f8b-166f-4aa6-9ee4-a1ca743b21ad',
      provider: 'native',
    });
    const refresh = createRefreshSessionToken({
      userId: '42',
      sessionId: '5e0e1f8b-166f-4aa6-9ee4-a1ca743b21ad',
      generation: 0,
      absoluteExpiresAt: Math.floor(NOW_MS / 1000) + REFRESH_ABSOLUTE_TTL_SECONDS,
    });
    const tampered = `${refresh.slice(0, -1)}${refresh.endsWith('a') ? 'b' : 'a'}`;

    expect(verifyAppSessionToken(refresh)).toBeNull();
    expect(verifyRefreshSessionToken(access)).toBeNull();
    expect(verifyRefreshSessionToken(tampered)).toBeNull();
    expect(verifyRefreshSessionToken(`r2.${'a'.repeat(2100)}.signature`)).toBeNull();
    expect(verifyRefreshSessionToken('r2.not-json.signature')).toBeNull();
  });
});
