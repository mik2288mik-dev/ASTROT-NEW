import fs from 'node:fs';
import path from 'node:path';
import {
  assertRuStorePurchaseOwner,
  deriveRuStoreEntitlementSnapshot,
  providerEventFromLedger,
  RuStorePaymentError,
  shouldClearRuStoreProviderOverlay,
  shouldApplyRuStoreProviderEvent,
} from '../lib/rustorePayments';
import { toPremiumEntitlementSnapshot } from '../lib/contentArchitecture';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('RuStore server-authoritative entitlement lifecycle', () => {
  const now = new Date('2026-08-13T12:00:00.000Z');
  const future = now.getTime() + 30 * 24 * 60 * 60 * 1000;

  it.each([
    [{ paymentState: 1, autoRenewing: true }, 'paid'],
    [{ paymentState: 2, autoRenewing: true }, 'store_trial'],
    [{ paymentState: 1, autoRenewing: false }, 'cancelled_active'],
    [{ paymentState: 1, autoRenewing: true, gracePeriodEnabled: true }, 'grace'],
  ] as const)('maps the provider response %p to %s while access is paid through', (body, state) => {
    expect(deriveRuStoreEntitlementSnapshot({
      ...body,
      expiryTimeMillis: future,
    }, now)).toMatchObject({
      state,
      isPremium: true,
      expiresAt: new Date(future).toISOString(),
    });
  });

  it('treats RuStore cancelReason 0 as a real user cancellation', () => {
    expect(deriveRuStoreEntitlementSnapshot({
      paymentState: 1,
      autoRenewing: true,
      cancelReason: 0,
      expiryTimeMillis: future,
    }, now)).toMatchObject({ state: 'cancelled_active', isPremium: true });
  });

  it('expires access at paid period end without deleting account data', () => {
    expect(deriveRuStoreEntitlementSnapshot({
      paymentState: 1,
      autoRenewing: false,
      expiryTimeMillis: now.getTime() - 1,
    }, now)).toEqual({
      state: 'expired',
      isPremium: false,
      expiresAt: new Date(now.getTime() - 1).toISOString(),
      autoRenewing: false,
    });
  });

  it('revalidates the whole application at the entitlement boundary', () => {
    const app = read('App.tsx');
    const boundary = app.slice(
      app.indexOf('const refreshEntitlementAtBoundary'),
      app.indexOf('const markFirstValueReached'),
    );
    expect(boundary).toContain('refreshed = await getProfile()');
    expect(boundary).toContain('Math.min(2_147_000_000');
    expect(boundary).toContain('current && String(current.id) === userId ? { ...current } : current');
  });

  it('fails closed for HOLD/CLOSED even when a lagging V4 response still looks active or graceful', () => {
    expect(deriveRuStoreEntitlementSnapshot({
      paymentState: 1,
      autoRenewing: true,
      gracePeriodEnabled: true,
      expiryTimeMillis: future,
    }, now, {
      period: 'HOLD',
      status: 'PAUSED',
      eventTime: '2026-08-13T11:00:00.000Z',
    })).toMatchObject({ state: 'expired', isPremium: false });

    expect(deriveRuStoreEntitlementSnapshot({
      paymentState: 1,
      autoRenewing: true,
      expiryTimeMillis: future,
    }, now, {
      subscriptionEventType: 'CLOSED',
      status: 'CLOSED',
      period: 'MAIN',
      eventTime: '2026-08-13T11:30:00.000Z',
    })).toMatchObject({ state: 'expired', isPremium: false });
  });

  it('does not classify a future paid-through HOLD as subscription expiry analytics', () => {
    const source = read('lib/rustorePayments.ts');
    expect(source).toContain("const terminallyClosed = snapshot.state === 'expired'");
    expect(source).toContain('const actuallyExpired = terminallyClosed ||');
    expect(source).toContain('expiresAt.getTime() <= validationTime.getTime()');
    expect(source).toMatch(/actuallyExpired\s+\? 'subscription_expired'/);
  });

  it('keeps callback failures pending with capped retries instead of dead-lettering after ten attempts', () => {
    const source = read('lib/rustorePayments.ts');
    const worker = source.slice(source.indexOf('export async function processPendingRuStoreEvents'));
    expect(worker).not.toContain('event.attempts >= 10');
    expect(worker).not.toContain("SET processing_status = 'failed'");
    expect(worker).toContain("AND processing_status = 'failed'");
    expect(worker).toContain('RUSTORE_LEGACY_DEAD_LETTER_REQUEUED');
    expect(worker).toContain("SET processing_status = 'pending', failed_at = NULL");
    expect(worker).toContain('retryDelaySeconds(event.attempts)');
  });

  it('keeps a provider-only GRACE/HOLD overlay through restore and ignores equal or older callbacks', () => {
    const ledger = {
      provider_event_time: new Date('2026-08-13T10:00:00.000Z'),
      provider_period: 'GRACE',
      provider_status: 'ACTIVE',
      provider_subscription_event_type: 'PAYMENT_FAILED',
    };
    const overlay = providerEventFromLedger(ledger);
    expect(overlay).toMatchObject({
      period: 'GRACE',
      eventTime: '2026-08-13T10:00:00.000Z',
    });
    expect(deriveRuStoreEntitlementSnapshot({
      paymentState: 1,
      autoRenewing: true,
      expiryTimeMillis: future,
    }, now, overlay)).toMatchObject({ state: 'grace', isPremium: true });
    expect(shouldApplyRuStoreProviderEvent('2026-08-13T10:00:00.000Z', ledger.provider_event_time)).toBe(false);
    expect(shouldApplyRuStoreProviderEvent('2026-08-13T09:59:59.000Z', ledger.provider_event_time)).toBe(false);
    expect(shouldApplyRuStoreProviderEvent('2026-08-13T10:00:01.000Z', ledger.provider_event_time)).toBe(true);
  });

  it('keeps HOLD locked when V4 has not advanced the paid-through date', () => {
    expect(shouldClearRuStoreProviderOverlay({
      paymentState: 1,
      autoRenewing: true,
      expiryTimeMillis: future,
    }, {
      expires_at: new Date(future),
      provider_event_time: new Date('2026-08-13T10:00:00.000Z'),
      provider_period: 'HOLD',
      provider_status: 'PAUSED',
      provider_subscription_event_type: 'PAYMENT_FAILED',
    }, now)).toBe(false);
  });

  it('clears HOLD when a later V4 paid-through date proves recovery', () => {
    expect(shouldClearRuStoreProviderOverlay({
      paymentState: 1,
      autoRenewing: true,
      expiryTimeMillis: future,
    }, {
      expires_at: new Date(future - 24 * 60 * 60 * 1000),
      provider_event_time: new Date('2026-08-13T10:00:00.000Z'),
      provider_period: 'HOLD',
      provider_status: 'PAUSED',
      provider_subscription_event_type: 'PAYMENT_FAILED',
    }, now)).toBe(true);
  });

  it('does not clear a cancellation overlay from a same-period lagging V4 response', () => {
    const ledger = {
      auto_renewing: false,
      provider_event_time: new Date('2026-08-13T10:00:00.000Z'),
      provider_period: 'MAIN',
      provider_status: 'CANCELLED',
      provider_subscription_event_type: 'CANCELLED',
      expires_at: new Date(future),
    };
    expect(shouldClearRuStoreProviderOverlay({
      paymentState: 1,
      autoRenewing: true,
      expiryTimeMillis: future,
    }, ledger, now)).toBe(false);
    expect(deriveRuStoreEntitlementSnapshot({
      paymentState: 1,
      autoRenewing: true,
      expiryTimeMillis: future,
    }, now, providerEventFromLedger(ledger))).toMatchObject({
      state: 'cancelled_active',
      autoRenewing: false,
    });
  });

  it('retains the callback watermark after clearing provider facts', () => {
    const watermarkOnly = {
      provider_event_time: new Date('2026-08-13T10:00:00.000Z'),
      provider_period: null,
      provider_status: null,
      provider_subscription_event_type: null,
    };
    expect(providerEventFromLedger(watermarkOnly)).toBeUndefined();
    expect(shouldApplyRuStoreProviderEvent(
      '2026-08-13T09:59:59.000Z',
      watermarkOnly.provider_event_time,
    )).toBe(false);
  });

  it('applies only a stricter provider fact when event times are equal', () => {
    const eventTime = '2026-08-13T10:00:00.000Z';
    const active = { status: 'ACTIVE', period: 'MAIN', eventTime };
    const hold = { status: 'PAUSED', period: 'HOLD', eventTime };
    expect(shouldApplyRuStoreProviderEvent(eventTime, eventTime, hold, active)).toBe(true);
    expect(shouldApplyRuStoreProviderEvent(eventTime, eventTime, active, hold)).toBe(false);
  });

  it.each([
    [{}, 'RUSTORE_PURCHASE_ACCOUNT_REQUIRED'],
    [{ externalAccountId: 'another-user' }, 'RUSTORE_PURCHASE_USER_MISMATCH'],
  ])('rejects a purchase without a matching provider-verified account', (body, code) => {
    expect(() => assertRuStorePurchaseOwner(body, 'expected-user')).toThrow(
      expect.objectContaining({ code }),
    );
  });

  it('accepts only an exact provider-verified account owner', () => {
    expect(assertRuStorePurchaseOwner({ externalAccountId: 'expected-user' }, 'expected-user'))
      .toBe('expected-user');
  });

  it('does not issue a new 14-day Premium gift from the user profile endpoint', () => {
    const handler = read('pages/api/users/[id].ts');
    expect(handler).not.toContain('NEW_USER_TRIAL_DAYS');
    expect(handler).not.toContain('trialWindow');
    expect(handler).not.toContain('dbUser.trial_started_at');
  });

  it('declares every canonical lifecycle state in the database migration', () => {
    const migrations = read('lib/migrations.ts');
    for (const state of [
      'free',
      'gift',
      'store_trial',
      'paid',
      'grace',
      'cancelled_active',
      'expired',
    ]) {
      expect(migrations).toContain(`'${state}'`);
    }
  });

  it('does not re-grant legacy RuStore HOLD rows during lifecycle backfill', () => {
    const migrations = read('lib/migrations.ts');
    const rustoreCancelled = migrations.indexOf("WHEN pe.source = 'rustore' AND pe.status = 'cancelled' THEN 'expired'");
    const ordinaryCancelled = migrations.indexOf("WHEN pe.status = 'cancelled' AND pe.ends_at > NOW() THEN 'cancelled_active'");
    expect(rustoreCancelled).toBeGreaterThan(-1);
    expect(ordinaryCancelled).toBeGreaterThan(rustoreCancelled);
    expect(migrations).toContain("AND entitlement_state = 'expired'");
    const database = read('lib/db.ts');
    expect(database).toContain("entitlement_state IN ('gift', 'store_trial', 'paid', 'grace', 'cancelled_active')");
  });

  it('does not infer a current paid state from any historical Stars purchase', () => {
    const database = read('lib/db.ts');
    const migrations = read('lib/migrations.ts');
    expect(database.slice(
      database.indexOf('async syncFromUsersTable'),
      database.indexOf('async getActive', database.indexOf('async syncFromUsersTable')),
    )).not.toContain('has_paid_stars');
    expect(migrations.slice(
      migrations.indexOf('async function mvp044PremiumEntitlementLifecycle'),
      migrations.indexOf('async function mvp045RuStoreCallbackOrdering'),
    )).not.toContain("FROM star_payments sp");
    expect(migrations).toContain(
      "WHEN pe.source <> 'users.premium_until' AND pe.metadata->>'legacyKind' = 'paid' THEN 'paid'",
    );
  });

  it('exposes one canonical profile and payment response shape', () => {
    expect(toPremiumEntitlementSnapshot({
      entitlementState: 'cancelled_active',
      source: 'rustore',
      startsAt: '2026-08-01T00:00:00.000Z',
      endsAt: '2099-09-01T00:00:00.000Z',
      metadata: {
        autoRenewing: false,
        productId: 'premium_month',
        period: 'P1M',
      },
    })).toEqual({
      state: 'cancelled_active',
      isPremium: true,
      source: 'rustore',
      startsAt: '2026-08-01T00:00:00.000Z',
      endsAt: '2099-09-01T00:00:00.000Z',
      autoRenew: false,
      productId: 'premium_month',
      period: 'P1M',
    });
  });

  it('normalizes a cancelled entitlement to expired after its paid-through date', () => {
    expect(toPremiumEntitlementSnapshot({
      entitlementState: 'cancelled_active',
      status: 'cancelled',
      source: 'rustore',
      startsAt: '2025-01-01T00:00:00.000Z',
      endsAt: '2025-02-01T00:00:00.000Z',
      metadata: { autoRenewing: false },
    })).toMatchObject({
      state: 'expired',
      isPremium: false,
      endsAt: '2025-02-01T00:00:00.000Z',
      autoRenew: false,
    });
  });

  it('represents an account with no entitlement as Free', () => {
    expect(toPremiumEntitlementSnapshot(null)).toEqual({
      state: 'free',
      isPremium: false,
      source: null,
      startsAt: null,
      endsAt: null,
      autoRenew: null,
      productId: null,
      period: null,
    });
  });

  it('records passive RuStore expiry idempotently without including the purchase id', () => {
    const database = read('lib/db.ts');
    const getActive = database.slice(
      database.indexOf('async getActive(userId: string)'),
      database.indexOf('async getLatest(userId: string)'),
    );
    expect(getActive).toContain('RETURNING source, ends_at, metadata');
    expect(getActive).toContain("'subscription_expired'");
    expect(getActive).toContain('purchase_id_hash');
    expect(getActive).toContain('NOT EXISTS');
  });

  it('fails closed for an unknown canonical database state', () => {
    expect(toPremiumEntitlementSnapshot({
      entitlementState: 'mystery_paid_forever',
      status: 'active',
      source: 'rustore',
      endsAt: '2099-01-01T00:00:00.000Z',
    })).toMatchObject({ state: 'expired', isPremium: false });
  });

  it('returns the same authoritative snapshot from validation and both profile endpoints', () => {
    const validation = read('pages/api/payments/rustore/validate.ts');
    const currentProfile = read('pages/api/users/me.ts');
    const legacyProfile = read('pages/api/users/[id].ts');
    expect(validation).toContain('entitlement: result.entitlement');
    expect(currentProfile).toContain('premiumEntitlement');
    expect(legacyProfile).toContain('premiumEntitlement');
  });
});
