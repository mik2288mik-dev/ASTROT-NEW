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
import {
  processPendingRuStoreEvents,
  processRuStoreCallback,
  RuStorePaymentError,
  validateRuStorePurchase,
} from '../lib/rustorePayments';

const describePostgres = process.env.DATABASE_URL ? describe : describe.skip;

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
    process.env.RUSTORE_PUBLIC_API_TOKEN = 'integration-public-token';
    process.env.RUSTORE_CONSOLE_APP_ID = 'integration-console-app';
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
    global.fetch = jest.fn(async () => new Response(JSON.stringify({
      code: 'OK',
      body: { expiryTimeMillis: expiry, paymentState: 1, externalAccountId: userId },
    }), { status: 200 })) as typeof fetch;

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
      notification_type: 'SUBSCRIPTION_STATUS_CHANGED_SANDBOX',
      data: JSON.stringify({ purchase_id: purchase.purchaseId, status_new: 'ACTIVE' }),
    }, key);
    expect(await processRuStoreCallback({ id: externalEventId, payload })).toMatchObject({ queued: true });
    expect(await processRuStoreCallback({ id: externalEventId, payload })).toMatchObject({ duplicate: true });
    expect(await processPendingRuStoreEvents()).toMatchObject({ processed: 1 });

    expiry = Date.now() - 1000;
    const expired = await validateRuStorePurchase(purchase);
    expect(expired.status).toBe('expired');
    expect(expired.entitlement.isPremium).toBe(false);
  });
});
