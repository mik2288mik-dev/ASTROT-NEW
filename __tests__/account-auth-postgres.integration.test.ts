import crypto from 'crypto';
import type { Pool } from 'pg';

const RUN_POSTGRES = process.env.RUN_ACCOUNT_AUTH_POSTGRES === '1';
const TEST_DATABASE_URL = String(process.env.ACCOUNT_AUTH_TEST_DATABASE_URL || '').trim();

export function assertDedicatedLocalTestDatabaseUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('ACCOUNT_AUTH_TEST_DATABASE_URL must be a valid PostgreSQL URL');
  }
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, '')).toLowerCase();
  const localHost = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(parsed.hostname.toLowerCase());
  const explicitTestToken = /(^|[_-])test($|[_-])/.test(databaseName);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !localHost || !explicitTestToken) {
    throw new Error('Account-auth PostgreSQL tests require a dedicated local database with a standalone "test" name token');
  }
  return value;
}

if (RUN_POSTGRES && !TEST_DATABASE_URL) {
  throw new Error('RUN_ACCOUNT_AUTH_POSTGRES=1 requires ACCOUNT_AUTH_TEST_DATABASE_URL; DATABASE_URL is never accepted');
}
if (TEST_DATABASE_URL) assertDedicatedLocalTestDatabaseUrl(TEST_DATABASE_URL);

const describePostgres = RUN_POSTGRES && TEST_DATABASE_URL ? describe : describe.skip;

describe('account-auth PostgreSQL test database guard', () => {
  it('rejects production-looking, remote, and generic database URLs', () => {
    expect(() => assertDedicatedLocalTestDatabaseUrl('postgres://localhost/astrot')).toThrow(/dedicated local database/);
    expect(() => assertDedicatedLocalTestDatabaseUrl('postgres://localhost/latest')).toThrow(/dedicated local database/);
    expect(() => assertDedicatedLocalTestDatabaseUrl('postgres://localhost/contest')).toThrow(/dedicated local database/);
    expect(() => assertDedicatedLocalTestDatabaseUrl('postgres://db.example.test/astrot_test')).toThrow(/dedicated local database/);
    expect(() => assertDedicatedLocalTestDatabaseUrl('not-a-postgres-url')).toThrow(/valid PostgreSQL URL/);
  });

  it('accepts only an explicitly named local test database', () => {
    expect(assertDedicatedLocalTestDatabaseUrl('postgres://localhost/astrot_account_auth_test'))
      .toBe('postgres://localhost/astrot_account_auth_test');
  });
});

describePostgres('canonical account identity and session PostgreSQL integration', () => {
  let pool: Pool;
  let database: typeof import('../lib/db').db;
  let identity: typeof import('../lib/auth/accountIdentity');
  let emailPassword: typeof import('../lib/auth/emailPassword');
  let passwordHash: typeof import('../lib/auth/passwordHash');
  let authCode: typeof import('../lib/auth/authCode');
  let appAuth: typeof import('../lib/auth/appAuth');
  let accountDeletion: typeof import('../lib/accountDeletion');
  let migrations: typeof import('../lib/migrations');
  let nativeProviderAuth: typeof import('../lib/auth/nativeProviderAuth');
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalFetch = global.fetch;
  const userIds = new Set<string>();
  const sessionIds = new Set<string>();
  const challengeIds = new Set<string>();

  const unique = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
  const providerIdentity = (provider: 'vk' | 'yandex' | 'telegram', subject = unique(provider)) => ({
    provider,
    subject,
    displayName: `${provider} integration user`,
    metadata: { integrationTest: true },
  } as const);

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
    process.env.APP_SESSION_SECRET = 'account-auth-postgres-app-session-secret-32-bytes';
    process.env.AUTH_RATE_LIMIT_SECRET = 'account-auth-postgres-rate-limit-secret-32-bytes';
    process.env.EMAIL_OTP_HASH_SECRET = 'account-auth-postgres-email-code-secret-32-bytes';
    process.env.EMAIL_OTP_DELIVERY_URL = 'https://mailer.example.test/auth-code';
    process.env.EMAIL_OTP_DELIVERY_SECRET = 'account-auth-postgres-mailer-secret';
    process.env.VK_AUTH_CLIENT_ID = 'account-auth-postgres-vk-browser-client';
    process.env.VK_ANDROID_CLIENT_ID = 'account-auth-postgres-vk-client';
    process.env.YANDEX_ANDROID_CLIENT_ID = 'account-auth-postgres-yandex-client';
    process.env.NEXT_PUBLIC_DISTRIBUTION_CHANNEL = 'rustore';

    const db = await import('../lib/db');
    database = db.db;
    identity = await import('../lib/auth/accountIdentity');
    emailPassword = await import('../lib/auth/emailPassword');
    passwordHash = await import('../lib/auth/passwordHash');
    authCode = await import('../lib/auth/authCode');
    appAuth = await import('../lib/auth/appAuth');
    accountDeletion = await import('../lib/accountDeletion');
    migrations = await import('../lib/migrations');
    nativeProviderAuth = await import('../lib/auth/nativeProviderAuth');
    pool = db.getPool();

    const requiredTables = [
      'users',
      'account_identities',
      'account_password_credentials',
      'app_sessions',
      'app_session_revocations',
      'auth_challenges',
      'auth_rate_limits',
    ];
    const tables = await Promise.all(requiredTables.map(async (table) => {
      const result = await pool.query('SELECT to_regclass($1) AS relation', [`public.${table}`]);
      return result.rows[0]?.relation ? null : table;
    }));
    const missing = tables.filter(Boolean);
    if (missing.length) {
      throw new Error(`Dedicated account-auth test database is not migrated; missing: ${missing.join(', ')}`);
    }
  });

  afterEach(async () => {
    if (challengeIds.size) {
      await pool.query('DELETE FROM auth_challenges WHERE challenge_id = ANY($1::text[])', [[...challengeIds]]);
    }
    if (userIds.size) {
      await pool.query('DELETE FROM users WHERE id = ANY($1::bigint[])', [[...userIds]]);
    }
    if (sessionIds.size) {
      await pool.query('DELETE FROM app_session_revocations WHERE session_id = ANY($1::text[])', [[...sessionIds]]);
    }
    await pool.query('DELETE FROM auth_rate_limits');
    challengeIds.clear();
    userIds.clear();
    sessionIds.clear();
    global.fetch = originalFetch;
  });

  afterAll(async () => {
    await pool.end();
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
    global.fetch = originalFetch;
  });

  async function createProviderAccount(provider: 'vk' | 'yandex' | 'telegram', subject = unique(provider)) {
    const result = await identity.resolveVerifiedIdentity(providerIdentity(provider, subject), null, {
      requireNewIdentity: true,
    });
    userIds.add(result.userId);
    return { ...result, subject };
  }

  async function createSession(userId: string) {
    const session = await appAuth.createAppUserSession({ userId, kind: 'native' });
    sessionIds.add(session.sessionId);
    return session;
  }

  async function stageEmailRegistration(input: {
    email: string;
    userId?: string | null;
    password?: string;
    expires?: 'future' | 'past';
  }) {
    const challengeId = unique('email-challenge');
    const code = '123456';
    const password = input.password || 'correct horse battery staple';
    const credentialHash = await passwordHash.hashPassword(password);
    await pool.query(
      `INSERT INTO auth_challenges
       (challenge_id, provider, purpose, user_id, secret_hash, credential_hash, metadata,
        delivery_status, delivered_at, last_sent_at, expires_at)
       VALUES ($1, 'email', 'register', $2, $3, $4, $5::jsonb,
               'sent', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
               CASE WHEN $6 = 'past' THEN NOW() - INTERVAL '1 minute' ELSE NOW() + INTERVAL '10 minutes' END)`,
      [
        challengeId,
        input.userId || null,
        authCode.hashAuthCode(challengeId, code),
        credentialHash,
        JSON.stringify({ email: input.email }),
        input.expires || 'future',
      ],
    );
    challengeIds.add(challengeId);
    return { challengeId, code, password };
  }

  async function registerEmailAccount(email: string) {
    const staged = await stageEmailRegistration({ email });
    const result = await emailPassword.completeEmailPasswordRegistration({
      challengeId: staged.challengeId,
      code: staged.code,
      clientKey: unique('register-client'),
    });
    userIds.add(result.userId);
    return { ...result, ...staged, email };
  }

  async function assertFirstRunDefaults(userId: string) {
    const result = await pool.query(
      `SELECT is_setup, is_guest, premium_until, trial_started_at
       FROM users WHERE id = $1`,
      [userId],
    );
    expect(result.rows[0]).toMatchObject({
      is_setup: false,
      is_guest: false,
      premium_until: null,
      trial_started_at: null,
    });
  }

  async function markAndReadCanonicalAccount(userId: string, marker: string) {
    await pool.query(
      `UPDATE users
       SET name = $2, theme = 'dark', is_setup = TRUE,
           premium_until = NOW() + INTERVAL '30 days'
       WHERE id = $1`,
      [userId, marker],
    );
    return readCanonicalAccount(userId);
  }

  async function seedAndReadOwnedAccountData(userId: string, marker: string) {
    await markAndReadCanonicalAccount(userId, marker);
    const primary = await pool.query(
      `INSERT INTO natal_charts
       (user_id, name, is_primary, subject_type, input_hash, birth_date, birth_time, birth_place)
       VALUES ($1, $2, TRUE, 'self', $3, DATE '1990-01-02', TIME '03:04', 'Test City')
       RETURNING id`,
      [userId, `${marker}-primary`, `${marker}-primary-hash`],
    );
    const saved = await pool.query(
      `INSERT INTO natal_charts
       (user_id, name, is_primary, subject_type, relation_label, input_hash, birth_date, birth_time, birth_place)
       VALUES ($1, $2, FALSE, 'saved_person', 'friend', $3, DATE '1991-02-03', TIME '04:05', 'Saved City')
       RETURNING id`,
      [userId, `${marker}-saved`, `${marker}-saved-hash`],
    );
    await pool.query(
      `INSERT INTO astrology_threads
       (user_id, subject_chart_id, thread_kind, title, schema_version)
       VALUES ($1, $2, 'integration_history', $3, 'test-v1')`,
      [userId, primary.rows[0].id, `${marker}-history`],
    );
    await pool.query(
      `INSERT INTO premium_entitlements
       (user_id, tier_name, status, source, ends_at, metadata)
       VALUES ($1, 'premium', 'active', 'integration_test', NOW() + INTERVAL '30 days', $2::jsonb)`,
      [userId, JSON.stringify({ marker })],
    );
    await pool.query(
      `INSERT INTO user_notification_settings (user_id, enabled, timezone)
       VALUES ($1, FALSE, 'Europe/Moscow')`,
      [userId],
    );
    await pool.query(
      `INSERT INTO content_cache
       (user_id, chart_id, content_type, content_key, access_level, model_tier, prompt_version, payload, text)
       VALUES ($1, $2, 'integration_auth', $3, 'free', 'fast', 'test-v1', $4::jsonb, $5)`,
      [userId, primary.rows[0].id, marker, JSON.stringify({ marker }), `${marker}-cache`],
    );
    return readOwnedAccountData(userId);
  }

  async function readOwnedAccountData(userId: string) {
    const [user, charts, history, entitlement, settings, cache] = await Promise.all([
      pool.query('SELECT id::text, name, theme, is_setup, premium_until FROM users WHERE id = $1', [userId]),
      pool.query('SELECT id, name, subject_type FROM natal_charts WHERE user_id = $1 ORDER BY id', [userId]),
      pool.query('SELECT id, title FROM astrology_threads WHERE user_id = $1 ORDER BY id', [userId]),
      pool.query('SELECT id, status, source FROM premium_entitlements WHERE user_id = $1 ORDER BY id', [userId]),
      pool.query('SELECT enabled, timezone FROM user_notification_settings WHERE user_id = $1', [userId]),
      pool.query('SELECT id, content_key, text FROM content_cache WHERE user_id = $1 ORDER BY id', [userId]),
    ]);
    return {
      user: user.rows,
      charts: charts.rows,
      history: history.rows,
      entitlement: entitlement.rows,
      settings: settings.rows,
      cache: cache.rows,
    };
  }

  async function readCanonicalAccount(userId: string) {
    const result = await pool.query(
      `SELECT id::text AS id, name, theme, is_setup, premium_until
       FROM users WHERE id = $1`,
      [userId],
    );
    return result.rows[0];
  }

  async function linkProvider(userId: string, provider: 'vk' | 'yandex', subject = unique(provider)) {
    const session = await createSession(userId);
    await identity.resolveVerifiedIdentity(providerIdentity(provider, subject), userId, {
      requiredSession: { userId, sessionId: session.sessionId },
    });
    return { session, subject };
  }

  it('stores every auth expiry deadline as a timezone-aware instant', async () => {
    const result = await pool.query(
      `SELECT table_name, data_type
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND column_name = 'expires_at'
         AND table_name = ANY($1::text[])
       ORDER BY table_name`,
      [[
        'app_sessions',
        'app_session_revocations',
        'auth_challenges',
        'auth_exchange_codes',
      ]],
    );
    expect(result.rows).toHaveLength(4);
    expect(result.rows.every((row) => row.data_type === 'timestamp with time zone')).toBe(true);
  });

  it('records the canonical auth migrations and database uniqueness constraints', async () => {
    const applied = await pool.query(
      `SELECT name FROM migrations
       WHERE name = ANY($1::text[])
       ORDER BY name`,
      [[
        'mvp_040_account_identity_sessions',
        'mvp_043_password_authentication',
        'mvp_044_email_identity_uniqueness',
        'mvp_045_auth_expiry_timezone',
      ]],
    );
    expect(applied.rows.map((row) => row.name)).toEqual([
      'mvp_040_account_identity_sessions',
      'mvp_043_password_authentication',
      'mvp_044_email_identity_uniqueness',
      'mvp_045_auth_expiry_timezone',
    ]);
    const indexes = await pool.query(
      `SELECT indexname, indexdef FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname = ANY($1::text[])
       ORDER BY indexname`,
      [[
        'idx_account_identities_email_canonical',
        'idx_account_identities_user_provider',
      ]],
    );
    expect(indexes.rows).toHaveLength(2);
    expect(indexes.rows.find((row) => row.indexname === 'idx_account_identities_email_canonical')?.indexdef)
      .toContain('lower(btrim(provider_subject))');
    expect(indexes.rows.every((row) => row.indexdef.includes('UNIQUE INDEX'))).toBe(true);
    const providerSubjectConstraint = await pool.query(
      `SELECT 1 FROM pg_constraint
       WHERE conrelid = 'account_identities'::regclass
         AND conname = 'account_identities_provider_subject'
         AND contype = 'u'`,
    );
    expect(providerSubjectConstraint.rowCount).toBe(1);
  });

  it('fails the email canonicalization migration closed on case-fold collisions without merging accounts', async () => {
    const first = await createProviderAccount('vk');
    const second = await createProviderAccount('yandex');
    const canonicalEmail = `${unique('migration-collision')}@example.test`.toLowerCase();
    const mixedCaseEmail = canonicalEmail.replace('migration-collision', 'Migration-Collision');

    await pool.query('DROP INDEX idx_account_identities_email_canonical');
    await pool.query("DELETE FROM migrations WHERE name = 'mvp_044_email_identity_uniqueness'");
    await pool.query(
      `INSERT INTO account_identities (user_id, provider, provider_subject, normalized_email)
       VALUES ($1, 'email', $2, $2), ($3, 'email', $4, $4)`,
      [first.userId, canonicalEmail, second.userId, mixedCaseEmail],
    );

    try {
      await expect(migrations.runMigrations()).rejects.toThrow(/automatic merge is forbidden/);
      const owners = await pool.query(
        `SELECT user_id::text AS user_id FROM account_identities
         WHERE provider = 'email' AND lower(btrim(provider_subject)) = $1
         ORDER BY user_id`,
        [canonicalEmail],
      );
      expect(owners.rows.map((row) => row.user_id).sort()).toEqual(
        [first.userId, second.userId].sort(),
      );
      expect(await pool.query(
        "SELECT 1 FROM migrations WHERE name = 'mvp_044_email_identity_uniqueness'",
      )).toMatchObject({ rowCount: 0 });
    } finally {
      await pool.query(
        `DELETE FROM account_identities
         WHERE provider = 'email' AND lower(btrim(provider_subject)) = $1`,
        [canonicalEmail],
      );
      await migrations.runMigrations();
    }

    const restored = await pool.query(
      `SELECT indexdef FROM pg_indexes
       WHERE schemaname = 'public' AND indexname = 'idx_account_identities_email_canonical'`,
    );
    expect(restored.rows[0]?.indexdef).toContain('UNIQUE INDEX');
  }, 30_000);

  it('keeps first-run pending after birth data is saved until chart completion is explicit', async () => {
    const account = await createProviderAccount('vk');

    const pending = await database.users.updateExisting(account.userId, {
      name: 'Pending first run',
      birth_date: '1990-01-02',
      birth_time: '03:04',
      birth_place: 'Moscow',
      is_setup: false,
      language: 'ru',
      theme: 'light',
    });
    const reloadedPending = await database.users.get(account.userId, { hydratePrimaryChart: false });
    const storedPending = await pool.query(
      'SELECT is_setup FROM users WHERE id = $1',
      [account.userId],
    );

    expect(pending?.is_setup).toBe(false);
    expect(reloadedPending?.is_setup).toBe(false);
    expect(storedPending.rows[0]?.is_setup).toBe(false);

    const pendingAfterPartialWrite = await database.users.set(account.userId, { theme: 'dark' });
    expect(pendingAfterPartialWrite?.is_setup).toBe(false);

    const completed = await database.users.updateExisting(account.userId, { is_setup: true });
    const reloadedCompleted = await database.users.get(account.userId, { hydratePrimaryChart: false });

    expect(completed?.is_setup).toBe(true);
    expect(reloadedCompleted?.is_setup).toBe(true);
    const completedAfterPartialWrite = await database.users.set(account.userId, { theme: 'light' });
    expect(completedAfterPartialWrite?.is_setup).toBe(true);
    const completedAfterPartialUpdate = await database.users.updateExisting(account.userId, { language: 'ru' });
    expect(completedAfterPartialUpdate?.is_setup).toBe(true);
  });

  it('scenario A: email registration -> VK link -> VK login returns one canonical users.id and its data', async () => {
    const email = `${unique('scenario-a')}@example.test`;
    const registered = await registerEmailAccount(email);
    await assertFirstRunDefaults(registered.userId);
    const marker = unique('scenario-a-data');
    const before = await seedAndReadOwnedAccountData(registered.userId, marker);
    const linked = await linkProvider(registered.userId, 'vk');

    await identity.revokeSessions(registered.userId);
    const loggedIn = await identity.resolveVerifiedIdentity(providerIdentity('vk', linked.subject), null);

    expect(loggedIn.userId).toBe(registered.userId);
    expect(await readOwnedAccountData(loggedIn.userId)).toEqual(before);
  });

  it('scenario B: VK account -> verified email/password link -> email login returns the same users.id', async () => {
    const account = await createProviderAccount('vk');
    await assertFirstRunDefaults(account.userId);
    const marker = unique('scenario-b-data');
    const before = await markAndReadCanonicalAccount(account.userId, marker);
    const session = await createSession(account.userId);
    const email = `${unique('scenario-b')}@example.test`;
    const staged = await stageEmailRegistration({ email, userId: account.userId });

    const linked = await emailPassword.completeEmailPasswordRegistration({
      challengeId: staged.challengeId,
      code: staged.code,
      clientKey: unique('scenario-b-verify'),
      currentUserId: account.userId,
      currentSessionId: session.sessionId,
    });
    await identity.revokeSessions(account.userId);
    const loggedIn = await emailPassword.authenticateEmailPassword({
      email,
      password: staged.password,
      clientKey: unique('scenario-b-login'),
    });

    expect(linked.userId).toBe(account.userId);
    expect(loggedIn.userId).toBe(account.userId);
    expect(await readCanonicalAccount(loggedIn.userId)).toEqual(before);
  });

  it('scenario C: Yandex account links VK and both provider subjects resolve one users.id', async () => {
    const account = await createProviderAccount('yandex');
    const before = await markAndReadCanonicalAccount(account.userId, unique('scenario-c-data'));
    const linked = await linkProvider(account.userId, 'vk');

    const yandexLogin = await identity.resolveVerifiedIdentity(providerIdentity('yandex', account.subject), null);
    const vkLogin = await identity.resolveVerifiedIdentity(providerIdentity('vk', linked.subject), null);

    expect(yandexLogin.userId).toBe(account.userId);
    expect(vkLogin.userId).toBe(account.userId);
    expect(await readCanonicalAccount(vkLogin.userId)).toEqual(before);
  });

  it.each(['vk', 'yandex', 'email'] as const)(
    'scenario D: Telegram account explicitly links %s and both identities resolve the same users.id',
    async (provider) => {
      const account = await createProviderAccount('telegram');
      const before = await markAndReadCanonicalAccount(account.userId, unique(`scenario-d-${provider}-data`));
      const session = await createSession(account.userId);
      let providerLoginUserId: string;

      if (provider === 'email') {
        const email = `${unique('scenario-d')}@example.test`;
        const staged = await stageEmailRegistration({ email, userId: account.userId });
        await emailPassword.completeEmailPasswordRegistration({
          challengeId: staged.challengeId,
          code: staged.code,
          clientKey: unique('scenario-d-verify'),
          currentUserId: account.userId,
          currentSessionId: session.sessionId,
        });
        providerLoginUserId = (await emailPassword.authenticateEmailPassword({
          email,
          password: staged.password,
          clientKey: unique('scenario-d-login'),
        })).userId;
      } else {
        const subject = unique(provider);
        await identity.resolveVerifiedIdentity(providerIdentity(provider, subject), account.userId, {
          requiredSession: { userId: account.userId, sessionId: session.sessionId },
        });
        providerLoginUserId = (await identity.resolveVerifiedIdentity(providerIdentity(provider, subject), null)).userId;
      }
      const telegramLogin = await identity.resolveVerifiedIdentity(
        providerIdentity('telegram', account.subject),
        null,
      );

      expect(providerLoginUserId).toBe(account.userId);
      expect(telegramLogin.userId).toBe(account.userId);
      expect(await readCanonicalAccount(providerLoginUserId)).toEqual(before);
    },
  );

  it('scenario E: a provider subject owned by account A cannot be linked to account B', async () => {
    const owner = await createProviderAccount('yandex');
    const contender = await createProviderAccount('vk');
    const contenderSession = await createSession(contender.userId);

    await expect(identity.resolveVerifiedIdentity(
      providerIdentity('yandex', owner.subject),
      contender.userId,
      { requiredSession: { userId: contender.userId, sessionId: contenderSession.sessionId } },
    )).rejects.toMatchObject({ status: 409, code: 'IDENTITY_ALREADY_LINKED' });

    const row = await pool.query(
      `SELECT user_id::text AS user_id FROM account_identities
       WHERE provider = 'yandex' AND provider_subject = $1`,
      [owner.subject],
    );
    expect(row.rows).toEqual([{ user_id: owner.userId }]);
    expect(await readCanonicalAccount(contender.userId)).toBeTruthy();
  });

  it('serializes concurrent attempts to link one provider subject to two different accounts', async () => {
    const first = await createProviderAccount('telegram');
    const second = await createProviderAccount('yandex');
    const firstSession = await createSession(first.userId);
    const secondSession = await createSession(second.userId);
    const subject = unique('concurrent-vk');

    const outcomes = await Promise.allSettled([
      identity.resolveVerifiedIdentity(providerIdentity('vk', subject), first.userId, {
        requiredSession: { userId: first.userId, sessionId: firstSession.sessionId },
      }),
      identity.resolveVerifiedIdentity(providerIdentity('vk', subject), second.userId, {
        requiredSession: { userId: second.userId, sessionId: secondSession.sessionId },
      }),
    ]);

    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ status: 409, code: 'IDENTITY_ALREADY_LINKED' });
    const rows = await pool.query(
      `SELECT user_id::text AS user_id FROM account_identities
       WHERE provider = 'vk' AND provider_subject = $1`,
      [subject],
    );
    expect(rows.rows).toHaveLength(1);
    expect([first.userId, second.userId]).toContain(rows.rows[0].user_id);
  });

  it('scenario F: an email identity owned by account A never merges into account B', async () => {
    const email = `${unique('scenario-f')}@example.test`;
    const owner = await registerEmailAccount(email);
    const contender = await createProviderAccount('vk');
    const contenderSession = await createSession(contender.userId);
    const delivered: Array<{ to: string; code: string }> = [];
    global.fetch = jest.fn(async (_url: string, init: RequestInit) => {
      delivered.push(JSON.parse(String(init.body)));
      return { ok: true } as Response;
    }) as typeof fetch;
    const realBegin = await emailPassword.beginEmailPasswordRegistration({
      email,
      password: 'correct horse battery staple',
      passwordConfirmation: 'correct horse battery staple',
      clientKey: unique('scenario-f-real-begin'),
      currentUserId: contender.userId,
    });
    challengeIds.add(realBegin.challengeId);
    const suppressed = await pool.query(
      `SELECT delivery_status, credential_hash, user_id::text AS user_id
       FROM auth_challenges WHERE challenge_id = $1`,
      [realBegin.challengeId],
    );
    expect(delivered).toHaveLength(0);
    expect(suppressed.rows).toEqual([{
      delivery_status: 'suppressed',
      credential_hash: null,
      user_id: contender.userId,
    }]);
    const staged = await stageEmailRegistration({ email, userId: contender.userId });

    await expect(emailPassword.completeEmailPasswordRegistration({
      challengeId: staged.challengeId,
      code: staged.code,
      clientKey: unique('scenario-f-verify'),
      currentUserId: contender.userId,
      currentSessionId: contenderSession.sessionId,
    })).rejects.toMatchObject({ status: 409, code: 'IDENTITY_ALREADY_LINKED' });

    const row = await pool.query(
      `SELECT user_id::text AS user_id FROM account_identities
       WHERE provider = 'email' AND provider_subject = $1`,
      [email],
    );
    expect(row.rows).toEqual([{ user_id: owner.userId }]);
    expect(contender.userId).not.toBe(owner.userId);
  }, 10_000);

  it('consumes one native provider callback exactly once, including concurrent replay', async () => {
    const started = await nativeProviderAuth.beginNativeProviderAuth({
      provider: 'vk',
      purpose: 'login',
    });
    challengeIds.add(started.challengeId);
    const subject = unique('vk-replay-subject');
    let providerCall = 0;
    global.fetch = jest.fn(async () => {
      providerCall += 1;
      return new Response(JSON.stringify(providerCall === 1
        ? { access_token: 'vk-access-token', user_id: subject, state: started.config.state }
        : { user: { user_id: subject, first_name: 'Replay', last_name: 'Test' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
    const complete = () => nativeProviderAuth.completeNativeProviderAuth({
      provider: 'vk',
      challengeId: started.challengeId,
      credential: {
        code: 'vk-authorization-code',
        deviceId: 'vk-device-id',
        state: started.config.state,
      },
    });

    const outcomes = await Promise.allSettled([complete(), complete()]);
    const fulfilled = outcomes.filter(
      (outcome): outcome is PromiseFulfilledResult<Awaited<ReturnType<typeof complete>>> =>
        outcome.status === 'fulfilled',
    );
    const rejected = outcomes.find((outcome) => outcome.status === 'rejected') as PromiseRejectedResult;
    expect(fulfilled).toHaveLength(1);
    userIds.add(fulfilled[0].value.userId);
    expect(['AUTH_CHALLENGE_IN_PROGRESS', 'AUTH_CHALLENGE_INVALID'])
      .toContain(rejected.reason?.code);
    const challenge = await pool.query(
      `SELECT consumed_at, claimed_at, attempts FROM auth_challenges WHERE challenge_id = $1`,
      [started.challengeId],
    );
    expect(challenge.rows[0]).toMatchObject({ claimed_at: null, attempts: 1 });
    expect(challenge.rows[0].consumed_at).not.toBeNull();
    await expect(complete()).rejects.toMatchObject({ code: 'AUTH_CHALLENGE_INVALID' });
  });

  it('rejects a Telegram link if its required app session is revoked before the identity transaction', async () => {
    const account = await createProviderAccount('vk');
    const session = await createSession(account.userId);
    await identity.revokeSessions(account.userId, session.sessionId);
    const subject = unique('telegram-toctou');

    await expect(identity.resolveVerifiedIdentity(
      providerIdentity('telegram', subject),
      account.userId,
      { requiredSession: { userId: account.userId, sessionId: session.sessionId } },
    )).rejects.toMatchObject({ status: 401, code: 'APP_SESSION_REVOKED' });
    const linked = await pool.query(
      `SELECT 1 FROM account_identities WHERE provider = 'telegram' AND provider_subject = $1`,
      [subject],
    );
    expect(linked.rowCount).toBe(0);
  });

  it('scenario G: deletion revokes every token permanently and removes the canonical account', async () => {
    const account = await createProviderAccount('vk');
    const first = await createSession(account.userId);
    const second = await createSession(account.userId);

    await expect(accountDeletion.deleteAccountData(account.userId)).resolves.toEqual({
      deleted: true,
      alreadyDeleted: false,
    });
    userIds.delete(account.userId);

    for (const token of [first.token, second.token]) {
      await expect(appAuth.requireAppUser({
        headers: { authorization: `Bearer ${token}` },
        query: {},
        body: {},
      } as any, { allowGuest: true })).rejects.toMatchObject({
        status: 401,
        code: 'APP_SESSION_REVOKED',
      });
    }
    const deleted = await pool.query('SELECT 1 FROM users WHERE id = $1', [account.userId]);
    const revocations = await pool.query(
      'SELECT session_id FROM app_session_revocations WHERE session_id = ANY($1::text[])',
      [[first.sessionId, second.sessionId]],
    );
    expect(deleted.rowCount).toBe(0);
    expect(revocations.rowCount).toBe(2);
  });

  it('scenario G: an in-flight legacy profile update cannot resurrect a deleted account', async () => {
    const account = await createProviderAccount('vk');
    const [update, deletion] = await Promise.allSettled([
      database.users.updateExisting(account.userId, {
        name: 'Race update',
        birth_date: '1990-01-01',
        birth_time: '12:00',
        birth_place: 'Moscow',
        is_setup: true,
        language: 'ru',
        theme: 'light',
      }),
      accountDeletion.deleteAccountData(account.userId),
    ]);
    expect(deletion).toMatchObject({ status: 'fulfilled' });
    if (update.status === 'rejected') throw update.reason;
    userIds.delete(account.userId);
    await expect(database.users.updateExisting(account.userId, {
      name: 'Post-delete resurrection attempt',
      is_setup: true,
    })).resolves.toBeNull();
    await expect(pool.query('SELECT 1 FROM users WHERE id = $1', [account.userId]))
      .resolves.toMatchObject({ rowCount: 0 });
  });

  it('scenario H: transactional blocking revokes all sessions and old tokens stay revoked after unblock', async () => {
    const account = await createProviderAccount('vk');
    const first = await createSession(account.userId);
    const second = await createSession(account.userId);
    const setAccountBlockedState = (identity as unknown as {
      setAccountBlockedState?: (userId: string, blocked: boolean) => Promise<void>;
    }).setAccountBlockedState;

    expect(setAccountBlockedState).toEqual(expect.any(Function));
    await setAccountBlockedState!(account.userId, true);
    const sessionsAfterBlock = await pool.query(
      `SELECT session_id, revoke_reason FROM app_sessions
       WHERE user_id = $1 ORDER BY session_id`,
      [account.userId],
    );
    expect(sessionsAfterBlock.rows).toHaveLength(2);
    expect(sessionsAfterBlock.rows.every((row) => row.revoke_reason === 'account_blocked')).toBe(true);

    await expect(appAuth.requireAppUser({
      headers: { authorization: `Bearer ${first.token}` },
      query: {},
      body: {},
    } as any, { allowGuest: true })).rejects.toMatchObject({ code: 'ACCOUNT_BLOCKED' });

    await setAccountBlockedState!(account.userId, false);
    await expect(appAuth.requireAppUser({
      headers: { authorization: `Bearer ${second.token}` },
      query: {},
      body: {},
    } as any, { allowGuest: true })).rejects.toMatchObject({
      status: 401,
      code: 'APP_SESSION_REVOKED',
    });
  });

  it('serializes account blocking against concurrent session issuance', async () => {
    const account = await createProviderAccount('vk');
    const setAccountBlockedState = identity.setAccountBlockedState;
    const [sessionOutcome, blockOutcome] = await Promise.allSettled([
      appAuth.createAppUserSession({ userId: account.userId, kind: 'native' }),
      setAccountBlockedState(account.userId, true),
    ]);
    expect(blockOutcome.status).toBe('fulfilled');
    if (sessionOutcome.status === 'fulfilled') {
      sessionIds.add(sessionOutcome.value.sessionId);
    } else {
      expect(sessionOutcome.reason).toMatchObject({ code: 'ACCOUNT_BLOCKED' });
    }
    const active = await pool.query(
      `SELECT 1 FROM app_sessions
       WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
      [account.userId],
    );
    expect(active.rowCount).toBe(0);
  });

  it('enforces email challenge expiry, attempt exhaustion, and one-time replay protection', async () => {
    const expired = await stageEmailRegistration({
      email: `${unique('expired')}@example.test`,
      expires: 'past',
    });
    await expect(emailPassword.completeEmailPasswordRegistration({
      challengeId: expired.challengeId,
      code: expired.code,
      clientKey: unique('expired-client'),
    })).rejects.toMatchObject({ status: 401, code: 'AUTH_CODE_INVALID' });

    const exhausted = await stageEmailRegistration({ email: `${unique('attempts')}@example.test` });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(emailPassword.completeEmailPasswordRegistration({
        challengeId: exhausted.challengeId,
        code: '000000',
        clientKey: unique(`attempt-${attempt}`),
      })).rejects.toMatchObject({ status: 401, code: 'AUTH_CODE_INVALID' });
    }
    await expect(emailPassword.completeEmailPasswordRegistration({
      challengeId: exhausted.challengeId,
      code: exhausted.code,
      clientKey: unique('after-exhaustion'),
    })).rejects.toMatchObject({ status: 401, code: 'AUTH_CODE_INVALID' });
    const attempts = await pool.query(
      'SELECT attempts, consumed_at FROM auth_challenges WHERE challenge_id = $1',
      [exhausted.challengeId],
    );
    expect(attempts.rows[0].attempts).toBe(5);
    expect(attempts.rows[0].consumed_at).not.toBeNull();

    const oneTime = await stageEmailRegistration({ email: `${unique('replay')}@example.test` });
    const firstUse = await emailPassword.completeEmailPasswordRegistration({
      challengeId: oneTime.challengeId,
      code: oneTime.code,
      clientKey: unique('first-use'),
    });
    userIds.add(firstUse.userId);
    await expect(emailPassword.completeEmailPasswordRegistration({
      challengeId: oneTime.challengeId,
      code: oneTime.code,
      clientKey: unique('replay-use'),
    })).rejects.toMatchObject({ status: 401, code: 'AUTH_CODE_INVALID' });
  });

  it('invalidates an older delivered registration code when a resend succeeds', async () => {
    const email = `${unique('resend')}@example.test`;
    const delivered: Array<{ to: string; code: string }> = [];
    global.fetch = jest.fn(async (_url: string, init: RequestInit) => {
      delivered.push(JSON.parse(String(init.body)));
      return { ok: true } as Response;
    }) as typeof fetch;
    const password = 'correct horse battery staple';
    const first = await emailPassword.beginEmailPasswordRegistration({
      email,
      password,
      passwordConfirmation: password,
      clientKey: unique('resend-client'),
    });
    challengeIds.add(first.challengeId);
    await pool.query("UPDATE auth_rate_limits SET expires_at = NOW() - INTERVAL '1 second'");
    const second = await emailPassword.beginEmailPasswordRegistration({
      email,
      password,
      passwordConfirmation: password,
      clientKey: unique('resend-client'),
    });
    challengeIds.add(second.challengeId);

    expect(delivered).toHaveLength(2);
    const beforeReplay = await pool.query(
      `SELECT challenge_id, provider, purpose, delivery_status, consumed_at, claimed_at,
              attempts, expires_at, secret_hash
       FROM auth_challenges
       WHERE challenge_id = ANY($1::text[])
       ORDER BY challenge_id`,
      [[first.challengeId, second.challengeId]],
    );
    const firstRow = beforeReplay.rows.find((row) => row.challenge_id === first.challengeId);
    const secondRow = beforeReplay.rows.find((row) => row.challenge_id === second.challengeId);
    expect(firstRow).toMatchObject({ delivery_status: 'sent' });
    expect(firstRow.consumed_at).not.toBeNull();
    expect(secondRow).toMatchObject({
      provider: 'email',
      purpose: 'register',
      delivery_status: 'sent',
      consumed_at: null,
      claimed_at: null,
      attempts: 0,
    });
    expect(authCode.verifyAuthCode(
      second.challengeId,
      delivered[1].code,
      String(secondRow.secret_hash),
    )).toBe(true);
    await expect(emailPassword.completeEmailPasswordRegistration({
      challengeId: first.challengeId,
      code: delivered[0].code,
      clientKey: unique('old-code'),
    })).rejects.toMatchObject({ status: 401, code: 'AUTH_CODE_INVALID' });
    const afterOldCode = await pool.query(
      `SELECT provider, purpose, delivery_status, consumed_at, claimed_at, attempts,
              expires_at > NOW() AS active
       FROM auth_challenges WHERE challenge_id = $1`,
      [second.challengeId],
    );
    expect(afterOldCode.rows).toEqual([{
      provider: 'email',
      purpose: 'register',
      delivery_status: 'sent',
      consumed_at: null,
      claimed_at: null,
      attempts: 0,
      active: true,
    }]);
    const completed = await emailPassword.completeEmailPasswordRegistration({
      challengeId: second.challengeId,
      code: delivered[1].code,
      clientKey: unique('new-code'),
    });
    userIds.add(completed.userId);
  }, 10_000);

  it('completes password reset once, changes the password, and revokes every existing session', async () => {
    const email = `${unique('password-reset')}@example.test`;
    const owner = await registerEmailAccount(email);
    const first = await createSession(owner.userId);
    const second = await createSession(owner.userId);
    const delivered: Array<{ to: string; code: string; template: string }> = [];
    global.fetch = jest.fn(async (_url: string, init: RequestInit) => {
      delivered.push(JSON.parse(String(init.body)));
      return { ok: true } as Response;
    }) as typeof fetch;
    const reset = await emailPassword.beginPasswordReset({
      email,
      clientKey: unique('password-reset-request'),
    });
    challengeIds.add(reset.challengeId);
    expect(delivered).toEqual([expect.objectContaining({
      to: email,
      template: 'password_reset_code',
    })]);
    const newPassword = 'a different correct horse battery staple';
    const completed = await emailPassword.completePasswordReset({
      challengeId: reset.challengeId,
      code: delivered[0].code,
      password: newPassword,
      passwordConfirmation: newPassword,
      clientKey: unique('password-reset-complete'),
    });
    expect(completed.userId).toBe(owner.userId);
    await expect(emailPassword.authenticateEmailPassword({
      email,
      password: owner.password,
      clientKey: unique('old-password'),
    })).rejects.toMatchObject({ code: 'EMAIL_OR_PASSWORD_INVALID' });
    await expect(emailPassword.authenticateEmailPassword({
      email,
      password: newPassword,
      clientKey: unique('new-password'),
    })).resolves.toMatchObject({ userId: owner.userId });
    for (const token of [first.token, second.token]) {
      await expect(appAuth.requireAppUser({
        headers: { authorization: `Bearer ${token}` },
        query: {},
        body: {},
      } as any, { allowGuest: true })).rejects.toMatchObject({
        code: 'APP_SESSION_REVOKED',
      });
    }
    const sessions = await pool.query(
      `SELECT revoke_reason FROM app_sessions WHERE user_id = $1 ORDER BY session_id`,
      [owner.userId],
    );
    expect(sessions.rows).toHaveLength(2);
    expect(sessions.rows.every((row) => row.revoke_reason === 'password_reset')).toBe(true);
    await expect(emailPassword.completePasswordReset({
      challengeId: reset.challengeId,
      code: delivered[0].code,
      password: newPassword,
      passwordConfirmation: newPassword,
      clientKey: unique('password-reset-replay'),
    })).rejects.toMatchObject({ code: 'AUTH_CODE_INVALID' });
  }, 15_000);

  it('returns generic challenge responses for duplicate registration and unknown password reset targets', async () => {
    const registeredEmail = `${unique('generic-existing')}@example.test`;
    const owner = await registerEmailAccount(registeredEmail);
    const delivered: Array<{ to: string; template: string }> = [];
    global.fetch = jest.fn(async (_url: string, init: RequestInit) => {
      delivered.push(JSON.parse(String(init.body)));
      return { ok: true } as Response;
    }) as typeof fetch;
    const password = 'correct horse battery staple';

    const duplicate = await emailPassword.beginEmailPasswordRegistration({
      email: registeredEmail,
      password,
      passwordConfirmation: password,
      clientKey: unique('duplicate-register'),
    });
    challengeIds.add(duplicate.challengeId);
    const fresh = await emailPassword.beginEmailPasswordRegistration({
      email: `${unique('generic-fresh')}@example.test`,
      password,
      passwordConfirmation: password,
      clientKey: unique('fresh-register'),
    });
    challengeIds.add(fresh.challengeId);
    expect(Object.keys(duplicate)).toEqual(Object.keys(fresh));
    expect(duplicate.challengeId).toEqual(expect.any(String));
    expect(delivered.filter((item) => item.template === 'registration_code')).toHaveLength(1);

    const existingReset = await emailPassword.beginPasswordReset({
      email: registeredEmail,
      clientKey: unique('existing-reset'),
    });
    const missingReset = await emailPassword.beginPasswordReset({
      email: `${unique('missing-reset')}@example.test`,
      clientKey: unique('missing-reset'),
    });
    challengeIds.add(existingReset.challengeId);
    challengeIds.add(missingReset.challengeId);
    expect(Object.keys(existingReset)).toEqual(Object.keys(missingReset));
    expect(delivered.filter((item) => item.template === 'password_reset_code')).toHaveLength(1);
    expect(owner.userId).toEqual(expect.any(String));
  }, 15_000);

  it('keeps email request responses generic when the production delivery adapter is unavailable', async () => {
    const existingEmail = `${unique('delivery-existing')}@example.test`;
    await registerEmailAccount(existingEmail);
    global.fetch = jest.fn(async () => ({ ok: false } as Response)) as typeof fetch;
    const password = 'correct horse battery staple';

    const existingRegistration = await emailPassword.beginEmailPasswordRegistration({
      email: existingEmail,
      password,
      passwordConfirmation: password,
      clientKey: unique('delivery-existing-registration'),
    });
    const newRegistration = await emailPassword.beginEmailPasswordRegistration({
      email: `${unique('delivery-new')}@example.test`,
      password,
      passwordConfirmation: password,
      clientKey: unique('delivery-new-registration'),
    });
    const existingReset = await emailPassword.beginPasswordReset({
      email: existingEmail,
      clientKey: unique('delivery-existing-reset'),
    });
    const missingReset = await emailPassword.beginPasswordReset({
      email: `${unique('delivery-missing')}@example.test`,
      clientKey: unique('delivery-missing-reset'),
    });
    for (const result of [existingRegistration, newRegistration, existingReset, missingReset]) {
      challengeIds.add(result.challengeId);
      expect(result).toEqual({ challengeId: expect.any(String) });
    }
    const statuses = await pool.query(
      `SELECT challenge_id, delivery_status FROM auth_challenges
       WHERE challenge_id = ANY($1::text[])`,
      [[
        existingRegistration.challengeId,
        newRegistration.challengeId,
        existingReset.challengeId,
        missingReset.challengeId,
      ]],
    );
    expect(statuses.rows).toHaveLength(4);
    expect(statuses.rows.map((row) => row.delivery_status).sort()).toEqual([
      'failed',
      'failed',
      'suppressed',
      'suppressed',
    ]);
  }, 15_000);

  it('keeps slow email delivery and suppressed reset responses within one timing envelope', async () => {
    const existingEmail = `${unique('timing-existing')}@example.test`;
    await registerEmailAccount(existingEmail);
    global.fetch = jest.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1_900));
      return { ok: true } as Response;
    }) as typeof fetch;

    const measureReset = async (email: string, clientKey: string) => {
      const startedAt = Date.now();
      const result = await emailPassword.beginPasswordReset({ email, clientKey });
      challengeIds.add(result.challengeId);
      return Date.now() - startedAt;
    };
    const [deliverableMs, suppressedMs] = await Promise.all([
      measureReset(existingEmail, unique('timing-deliverable')),
      measureReset(`${unique('timing-missing')}@example.test`, unique('timing-suppressed')),
    ]);

    expect(deliverableMs).toBeGreaterThanOrEqual(2_800);
    expect(suppressedMs).toBeGreaterThanOrEqual(2_800);
    expect(Math.abs(deliverableMs - suppressedMs)).toBeLessThan(600);
  }, 10_000);
});
