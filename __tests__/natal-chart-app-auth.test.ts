import crypto from 'crypto';

const BOT_TOKEN = 'test-telegram-bot-token';
const originalDatabaseUrl = process.env.DATABASE_URL;
const chartData = {
  sun: { sign: 'Pisces' },
  moon: { sign: 'Cancer' },
  rising: { sign: 'Libra' },
};
const validBody = {
  userId: '123',
  name: 'Test User',
  birthDate: '1990-05-15',
  birthTime: '12:30',
  birthPlace: 'Moscow',
  language: 'en',
  primary: true,
};

function createResponse() {
  const res: any = {
    setHeader: jest.fn(),
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

function createTelegramInitData(userId: string): string {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'test-query-id',
    user: JSON.stringify({ id: Number(userId), first_name: 'Telegram' }),
  });
  const dataCheckString = Array.from(params.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  params.set('hash', crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex'));
  return params.toString();
}

async function setup() {
  process.env.BOT_TOKEN = BOT_TOKEN;
  process.env.APP_SESSION_SECRET = 'test-app-session-secret-that-is-long-enough';

  const ensureCanonicalPrimaryChart = jest.fn().mockResolvedValue({
    chart: {
      chart_data: chartData,
      sun_sign: 'Pisces',
      moon_sign: 'Cancer',
      ascendant_sign: 'Libra',
    },
    source: 'calculated',
  });
  const repairCanonicalChartForUser = jest.fn();
  const primaryChartCalculation = jest.fn((userId: string) => `primary-chart:${userId}`);

  jest.doMock('../lib/natalChartPersistence', () => ({
    ensureCanonicalPrimaryChart,
    repairCanonicalChartForUser,
  }));
  jest.doMock('../lib/serverLocks', () => ({
    tryAcquireLock: jest.fn().mockReturnValue(true),
    releaseLock: jest.fn(),
    LockKeys: { primaryChartCalculation },
  }));
  jest.doMock('../lib/rateLimit', () => ({
    withRateLimit: (routeHandler: any) => routeHandler,
    RATE_LIMIT_CONFIGS: { FREE: { windowMs: 60_000, maxRequests: 10 } },
  }));

  const { createAppSessionToken } = await import('../lib/auth/appAuth');
  const { default: handler } = await import('../pages/api/charts/index');
  return { createAppSessionToken, ensureCanonicalPrimaryChart, handler, primaryChartCalculation };
}

async function call(handler: any, body: any, headers: Record<string, string>) {
  const res = createResponse();
  await handler({ method: 'POST', query: {}, body, headers } as any, res);
  return res;
}

describe('primary chart app auth', () => {
  beforeEach(() => {
    jest.resetModules();
    delete process.env.DATABASE_URL;
  });

  afterAll(() => {
    if (originalDatabaseUrl) process.env.DATABASE_URL = originalDatabaseUrl;
    else delete process.env.DATABASE_URL;
  });

  it('allows a web guest with a signed app session to create a basic chart', async () => {
    const { createAppSessionToken, ensureCanonicalPrimaryChart, handler, primaryChartCalculation } = await setup();
    const guestUserId = '-42';
    const token = createAppSessionToken({ userId: guestUserId, sessionId: 'guest-session', provider: 'web_guest' });

    const res = await call(handler, { ...validBody, userId: guestUserId }, {
      cookie: `lumia_app_session=${token}`,
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ chart_data: chartData }));
    expect(primaryChartCalculation).toHaveBeenCalledWith(guestUserId);
    expect(ensureCanonicalPrimaryChart).toHaveBeenCalledWith(expect.objectContaining({ userId: guestUserId }));
  });

  it('continues to authenticate Telegram users through initData headers', async () => {
    const { ensureCanonicalPrimaryChart, handler } = await setup();

    const res = await call(handler, validBody, {
      'x-telegram-init-data': createTelegramInitData(validBody.userId),
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(ensureCanonicalPrimaryChart).toHaveBeenCalledWith(expect.objectContaining({ userId: validBody.userId }));
  });

  it('returns 403 when body.userId does not match the authenticated app user', async () => {
    const { createAppSessionToken, ensureCanonicalPrimaryChart, handler } = await setup();
    const token = createAppSessionToken({ userId: '-42', sessionId: 'guest-session', provider: 'web_guest' });

    const res = await call(handler, { ...validBody, userId: '-43' }, {
      cookie: `lumia_app_session=${token}`,
    });

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'USER_ID_MISMATCH' }));
    expect(ensureCanonicalPrimaryChart).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid userId before chart calculation', async () => {
    const { ensureCanonicalPrimaryChart, handler } = await setup();

    const res = await call(handler, { ...validBody, userId: 'undefined' }, {});

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_USER_ID' }));
    expect(ensureCanonicalPrimaryChart).not.toHaveBeenCalled();
  });

  it('does not grant or return trial/premium data to a guest', async () => {
    const { createAppSessionToken, ensureCanonicalPrimaryChart, handler } = await setup();
    const guestUserId = '-99';
    const token = createAppSessionToken({ userId: guestUserId, sessionId: 'guest-session-no-premium', provider: 'web_guest' });

    const res = await call(handler, { ...validBody, userId: guestUserId }, {
      cookie: `lumia_app_session=${token}`,
    });

    const persistenceArgs = ensureCanonicalPrimaryChart.mock.calls[0][0];
    const responsePayload = res.json.mock.calls[0][0];
    expect(persistenceArgs).not.toHaveProperty('isPremium');
    expect(persistenceArgs).not.toHaveProperty('trial');
    expect(responsePayload).not.toHaveProperty('isPremium');
    expect(responsePayload).not.toHaveProperty('trial');
  });
});
