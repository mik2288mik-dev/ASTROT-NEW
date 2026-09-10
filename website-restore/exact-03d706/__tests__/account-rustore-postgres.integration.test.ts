import crypto from 'crypto';
import type { NextApiRequest } from 'next';
import { db, getPool } from '../lib/db';
import {
  assertAppSessionActive,
  persistAppSession,
  resolveTelegramIdentityForLogin,
  resolveVerifiedIdentity,
  revokeSessions,
  userHasRecoveryIdentity,
} from '../lib/auth/accountIdentity';
import {
  createAppSessionToken,
  requireAppUser,
} from '../lib/auth/appAuth';
import { deleteAccountData } from '../lib/accountDeletion';
import { runMigrations } from '../lib/migrations';
import {
  processPendingRuStoreEvents,
  processRuStoreCallback,
  RuStorePaymentError,
  validateRuStorePurchase,
} from '../lib/rustorePayments';

const TEST_DATABASE_URL = String(process.env.ACCOUNT_AUTH_TEST_DATABASE_URL || '').trim();
const RUN_POSTGRES = process.env.RUN_ACCOUNT_AUTH_POSTGRES === '1';
if (RUN_POSTGRES && (!TEST_DATABASE_URL || process.env.DATABASE_URL !== TEST_DATABASE_URL)) {
  throw new Error('RuStore PostgreSQL integration must use the guarded ACCOUNT_AUTH_TEST_DATABASE_URL');
}
if (RUN_POSTGRES) {
  let parsed: URL;
  try {
    parsed = new URL(TEST_DATABASE_URL);
  } catch {
    throw new Error('RuStore PostgreSQL integration requires a valid guarded PostgreSQL URL');
  }
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, '')).toLowerCase();
  const localHost = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(parsed.hostname.toLowerCase());
  if (
    !['postgres:', 'postgresql:'].includes(parsed.protocol)
    || !localHost
    || !/(^|[_-])test($|[_-])/.test(databaseName)
  ) {
    throw new Error('RuStore PostgreSQL integration requires a dedicated local database with a standalone "test" name token');
  }
}
const describePostgres = RUN_POSTGRES ? describe : describe.skip;

function nextUserId(): string {
  return String(-(BigInt(Date.now()) * 10000n + BigInt(crypto.randomInt(1, 9999))));
}

async function createUser(isGuest = true): Promise<string> {
  const userId = nextUserId();
  await db.users.set(userId, {
    name: isGuest ? 'Guest integration' : 'Account integration',
    language: 'ru',
    theme: 'light',
    is_setup: false,
    is_premium: false,
  });
  await getPool().query('UPDATE users SET is_guest = $2 WHERE id = $1', [userId, isGuest]);
  return userId;
}

function bearerRequest(token: string): NextApiRequest {
  return {
    headers: { authorization: `Bearer ${token}` },
    query: {},
    cookies: {},
  } as unknown as NextApiRequest;
}

function encryptedCallback(input: Record<string, unknown>, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(input), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, encrypted, cipher.getAuthTag()]).toString('base64');
}

describePostgres('PostgreSQL account, session, deletion, and RuStore integration', () => {
  const users = new Set<string>();
  const originalFetch = global.fetch;

  beforeAll(() => {
    process.env.APP_SESSION_SECRET = 'integration-test-session-secret-32-bytes';
    process.env.RUSTORE_PACKAGE_NAME = 'com.integration.test';
    process.env.RUSTORE_ALLOWED_PRODUCT_IDS = 'premium_month';
    const privateKey = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
    process.env.RUSTORE_KEY_ID = 'integration-key';
    process.env.RUSTORE_PRIVATE_KEY_BASE64 = privateKey
      .export({ format: 'der', type: 'pkcs8' })
      .toString('base64');
    process.env.RUSTORE_CONSOLE_APP_ID = 'integration-console-app';
    process.env.RUSTORE_PAY_MODE = 'sandbox';
    process.env.RUSTORE_NOTIFICATION_AES_KEY = crypto.randomBytes(32).toString('base64');
  });

  afterEach(async () => {
    global.fetch = originalFetch;
    for (const userId of users) {
      await getPool().query('DELETE FROM users WHERE id = $1', [userId]).catch(() => undefined);
    }
    users.clear();
    await getPool().query(
      `DELETE FROM payment_provider_events WHERE external_event_id LIKE 'integration-%'`,
    ).catch(() => undefined);
  });

  afterAll(async () => {
    await getPool().end();
  });

  it('creates a first Telegram account against the real users schema', async () => {
    const telegramId = String(Date.now() * 1000 + crypto.randomInt(1, 999));
    const account = await resolveTelegramIdentityForLogin({
      provider: 'telegram',
      subject: telegramId,
      displayName: 'Telegram integration',
      metadata: { username: 'integration' },
    }, telegramId);
    users.add(account.userId);

    expect(account).toMatchObject({ linked: true, existing: false });
    expect(account.userId).not.toBe(telegramId);
    await expect(getPool().query(
      `SELECT u.id, i.provider_subject
       FROM users u
       JOIN account_identities i ON i.user_id = u.id
       WHERE u.id = $1 AND i.provider = 'telegram'`,
      [account.userId],
    )).resolves.toMatchObject({
      rowCount: 1,
      rows: [expect.objectContaining({ provider_subject: telegramId })],
    });
  });

  it('keeps one users.id while linking every provider and blocks identity conflicts', async () => {
    const userId = await createUser(true);
    const otherUserId = await createUser(true);
    users.add(userId);
    users.add(otherUserId);
    await getPool().query(
      `INSERT INTO premium_entitlements
       (user_id, tier_name, status, source, starts_at, ends_at)
       VALUES ($1, 'premium', 'active', 'integration', NOW(), NOW() + interval '30 days')`,
      [userId],
    );

    for (const provider of ['vk', 'yandex', 'google', 'email', 'telegram'] as const) {
      const result = await resolveVerifiedIdentity({
        provider,
        subject: `${provider}-${userId}`,
        email: provider === 'email' ? `person-${userId}@example.test` : null,
      }, userId);
      expect(result.userId).toBe(userId);
    }

    expect(await userHasRecoveryIdentity(userId)).toBe(true);
    const account = await getPool().query(
      `SELECT is_guest, premium_until,
              (SELECT COUNT(*)::int FROM account_identities WHERE user_id = users.id) AS identities,
              (SELECT COUNT(*)::int FROM premium_entitlements WHERE user_id = users.id) AS entitlements
       FROM users WHERE id = $1`,
      [userId],
    );
    expect(account.rows[0]).toMatchObject({ is_guest: false, identities: 5, entitlements: 1 });

    await expect(resolveVerifiedIdentity({
      provider: 'google',
      subject: `google-${userId}`,
    }, otherUserId)).rejects.toMatchObject({ code: 'IDENTITY_ALREADY_LINKED', status: 409 });
    const owner = await resolveVerifiedIdentity({ provider: 'google', subject: `google-${userId}` });
    expect(owner.userId).toBe(userId);
  });

  it('revokes current and all sessions and rejects old bearer tokens', async () => {
    const userId = await createUser(false);
    users.add(userId);
    const firstId = crypto.randomUUID();
    const secondId = crypto.randomUUID();
    await persistAppSession({ sessionId: firstId, userId, kind: 'native' });
    await persistAppSession({ sessionId: secondId, userId, kind: 'web' });
    const firstToken = createAppSessionToken({ userId, provider: 'native', sessionId: firstId });
    const secondToken = createAppSessionToken({ userId, provider: 'web_guest', sessionId: secondId });

    expect((await requireAppUser(bearerRequest(firstToken), { allowGuest: true })).userId).toBe(userId);
    await revokeSessions(userId, firstId);
    await expect(requireAppUser(bearerRequest(firstToken), { allowGuest: true }))
      .rejects.toMatchObject({ code: 'APP_SESSION_REVOKED' });
    expect((await requireAppUser(bearerRequest(secondToken), { allowGuest: true })).userId).toBe(userId);
    await revokeSessions(userId);
    await expect(assertAppSessionActive(secondId, userId)).rejects.toMatchObject({ code: 'APP_SESSION_REVOKED' });
  });

  it('deletes only the target account, is idempotent, invalidates sessions, and rolls back on failure', async () => {
    const userId = await createUser(false);
    const otherUserId = await createUser(false);
    users.add(userId);
    users.add(otherUserId);
    const sessionId = crypto.randomUUID();
    await persistAppSession({ sessionId, userId, kind: 'native' });
    const token = createAppSessionToken({ userId, provider: 'native', sessionId });
    await getPool().query(
      `INSERT INTO natal_charts (user_id, name, is_primary) VALUES ($1, 'Integration', TRUE)`,
      [userId],
    );

    expect(await deleteAccountData(userId)).toEqual({ deleted: true, alreadyDeleted: false });
    users.delete(userId);
    expect(await deleteAccountData(userId)).toEqual({ deleted: false, alreadyDeleted: true });
    await expect(requireAppUser(bearerRequest(token), { allowGuest: true }))
      .rejects.toMatchObject({ code: 'APP_SESSION_REVOKED' });
    expect((await getPool().query('SELECT 1 FROM users WHERE id = $1', [otherUserId])).rowCount).toBe(1);

    const rollbackUserId = await createUser(false);
    users.add(rollbackUserId);
    await getPool().query(`
      CREATE OR REPLACE FUNCTION integration_block_user_delete() RETURNS trigger AS $$
      BEGIN
        IF OLD.id = ${rollbackUserId} THEN RAISE EXCEPTION 'integration rollback'; END IF;
        RETURN OLD;
      END;
      $$ LANGUAGE plpgsql
    `);
    await getPool().query(
      `CREATE TRIGGER integration_block_user_delete
       BEFORE DELETE ON users FOR EACH ROW EXECUTE FUNCTION integration_block_user_delete()`,
    );
    try {
      await expect(deleteAccountData(rollbackUserId)).rejects.toThrow('integration rollback');
      expect((await getPool().query('SELECT 1 FROM users WHERE id = $1', [rollbackUserId])).rowCount).toBe(1);
    } finally {
      await getPool().query('DROP TRIGGER IF EXISTS integration_block_user_delete ON users');
      await getPool().query('DROP FUNCTION IF EXISTS integration_block_user_delete()');
    }
  });

  it('validates Premium server-side, prevents purchase reuse, restores, expires, and queues callbacks idempotently', async () => {
    const userId = await createUser(false);
    const otherUserId = await createUser(false);
    users.add(userId);
    users.add(otherUserId);
    let expiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
    global.fetch = jest.fn(async (input) => new Response(JSON.stringify(
      String(input).includes('/public/auth')
        ? { code: 'OK', body: { jwe: 'integration-public-token', ttl: 900 } }
        : {
            code: 'OK',
            timestamp: new Date().toISOString(),
            body: {
              expiryTimeMillis: expiry,
              paymentState: 1,
              autoRenewing: true,
              externalAccountId: userId,
            },
          },
    ), { status: 200 })) as typeof fetch;

    const purchase = {
      userId,
      productId: 'premium_month',
      purchaseId: `integration-purchase-${crypto.randomUUID()}`,
      invoiceId: `integration-invoice-${crypto.randomUUID()}`,
      sandbox: true,
    };
    expect((await validateRuStorePurchase(purchase)).entitlement.isPremium).toBe(true);
    expect((await validateRuStorePurchase(purchase)).entitlement.isPremium).toBe(true);
    await expect(validateRuStorePurchase({ ...purchase, userId: otherUserId }))
      .rejects.toBeInstanceOf(RuStorePaymentError);

    const key = Buffer.from(process.env.RUSTORE_NOTIFICATION_AES_KEY!, 'base64');
    const externalEventId = `integration-event-${crypto.randomUUID()}`;
    const payload = encryptedCallback({
      app_id: process.env.RUSTORE_CONSOLE_APP_ID,
      notification_type: 'SUBSCRIPTION_EVENT_SANDBOX',
      data: JSON.stringify({
        product_code: purchase.productId,
        purchase_id: purchase.purchaseId,
        subscription_event_type: 'ACTIVATED',
        status_new: 'ACTIVE',
        period_new: 'MAIN',
        autorenewing: true,
        event_time: new Date().toISOString(),
      }),
    }, key);
    expect(await processRuStoreCallback({ id: externalEventId, payload })).toMatchObject({ queued: true });
    expect(await processRuStoreCallback({ id: externalEventId, payload })).toMatchObject({ duplicate: true });
    expect(await processPendingRuStoreEvents()).toMatchObject({ processed: 1 });

    const holdEventTime = new Date(Date.now() + 1000);
    const holdEventId = `integration-hold-${crypto.randomUUID()}`;
    const holdPayload = encryptedCallback({
      app_id: process.env.RUSTORE_CONSOLE_APP_ID,
      notification_type: 'SUBSCRIPTION_EVENT_SANDBOX',
      data: JSON.stringify({
        product_code: purchase.productId,
        purchase_id: purchase.purchaseId,
        subscription_event_type: 'PAYMENT_FAILED',
        status_new: 'PAUSED',
        period_new: 'HOLD',
        autorenewing: true,
        event_time: holdEventTime.toISOString(),
      }),
    }, key);
    expect(await processRuStoreCallback({ id: holdEventId, payload: holdPayload }))
      .toMatchObject({ queued: true });
    expect(await processPendingRuStoreEvents()).toMatchObject({ processed: 1 });
    expect((await validateRuStorePurchase(purchase)).status).toBe('expired');

    expiry += 31 * 24 * 60 * 60 * 1000;
    expect((await validateRuStorePurchase(purchase)).status).toBe('paid');
    const recoveredLedger = await getPool().query(
      `SELECT provider_event_time, provider_period, provider_status,
              provider_subscription_event_type
       FROM store_purchases
       WHERE provider = 'rustore' AND external_purchase_id = $1`,
      [purchase.purchaseId],
    );
    expect(recoveredLedger.rows[0]).toMatchObject({
      provider_period: null,
      provider_status: null,
      provider_subscription_event_type: null,
    });
    expect(recoveredLedger.rows[0].provider_event_time).not.toBeNull();

    const staleEventId = `integration-stale-${crypto.randomUUID()}`;
    const stalePayload = encryptedCallback({
      app_id: process.env.RUSTORE_CONSOLE_APP_ID,
      notification_type: 'SUBSCRIPTION_EVENT_SANDBOX',
      data: JSON.stringify({
        product_code: purchase.productId,
        purchase_id: purchase.purchaseId,
        subscription_event_type: 'PAYMENT_FAILED',
        status_new: 'PAUSED',
        period_new: 'HOLD',
        autorenewing: true,
        event_time: new Date(holdEventTime.getTime() - 1).toISOString(),
      }),
    }, key);
    expect(await processRuStoreCallback({ id: staleEventId, payload: stalePayload }))
      .toMatchObject({ queued: true });
    expect(await processPendingRuStoreEvents()).toMatchObject({ processed: 1 });
    expect((await validateRuStorePurchase(purchase)).status).toBe('paid');

    expiry = Date.now() - 1000;
    const expired = await validateRuStorePurchase(purchase);
    expect(expired.status).toBe('expired');
    expect(expired.entitlement.isPremium).toBe(false);
  });

  it('backfills a legacy RuStore paused row as expired without re-granting access', async () => {
    const userId = await createUser(false);
    users.add(userId);
    await getPool().query(
      `INSERT INTO premium_entitlements (
         user_id, tier_name, status, entitlement_state, source, starts_at, ends_at, metadata
       ) VALUES (
         $1, 'premium', 'cancelled', 'gift', 'rustore', NOW(), NOW() + INTERVAL '30 days',
         '{"legacyKind":"rustore_paused"}'::jsonb
       )`,
      [userId],
    );
    await getPool().query(
      `DELETE FROM migrations WHERE name = 'mvp_044_premium_entitlement_lifecycle'`,
    );

    try {
      await runMigrations();
      const result = await getPool().query(
        `SELECT status, entitlement_state FROM premium_entitlements
         WHERE user_id = $1 AND source = 'rustore'`,
        [userId],
      );
      expect(result.rows[0]).toMatchObject({ status: 'expired', entitlement_state: 'expired' });
      expect(await db.premium_entitlements.getActive(userId)).toBeNull();
    } finally {
      await getPool().query(
        `INSERT INTO migrations (name) VALUES ('mvp_044_premium_entitlement_lifecycle')
         ON CONFLICT (name) DO NOTHING`,
      );
    }
  });
});
