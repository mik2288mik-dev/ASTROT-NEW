import crypto from 'crypto';
import type { PremiumEntitlementState } from '../types';
import { getPool } from './db';
import { enqueueNeboOpsEvent, wakeNeboOpsDelivery } from './neboOps';
import {
  getPremiumEntitlementState,
  publicPremiumEntitlementSnapshot,
} from './contentArchitecture';
import { queuePersonalForecastPrewarmForUser } from './personalForecastPrewarm';

export type RuStoreValidationInput = {
  userId: string;
  productId?: string;
  purchaseId?: string;
  invoiceId?: string;
  sandbox?: boolean;
  providerEvent?: RuStoreSubscriptionEventContext;
};

export type RuStoreSubscriptionEventContext = {
  subscriptionEventType?: string | null;
  status?: string | null;
  period?: string | null;
  autoRenewing?: boolean | null;
  eventTime?: string | null;
};

export type RuStoreEntitlementSnapshot = {
  state: Exclude<PremiumEntitlementState, 'free' | 'gift'>;
  isPremium: boolean;
  expiresAt: string | null;
  autoRenewing: boolean | null;
};

export class RuStorePaymentError extends Error {
  constructor(readonly code: string, message = code) {
    super(message);
    this.name = 'RuStorePaymentError';
  }
}

type RuStoreApiResponse = { code?: string; message?: string; timestamp?: string; body?: any };

type RuStoreApiBody = {
  body: any;
  timestamp: string;
};

type CachedRuStoreToken = {
  identity: string;
  value: string;
  refreshAt: number;
};

let cachedRuStoreToken: CachedRuStoreToken | null = null;
let ruStoreTokenRequest: Promise<string> | null = null;

const RUSTORE_PUBLIC_API_ORIGIN = 'https://public-api-m.rustore.ru';

function required(name: string): string {
  const value = String(process.env[name] || '').trim();
  if (!value || value.includes('_REQUIRED') || value.includes('[УКАЖИТЕ')) {
    throw new RuStorePaymentError('RUSTORE_CONFIGURATION_REQUIRED', `${name} is required`);
  }
  return value;
}

function allowedProductIds(): Set<string> {
  return new Set(String(process.env.RUSTORE_ALLOWED_PRODUCT_IDS || '')
    .split(',').map((value) => value.trim()).filter(Boolean));
}

function validateProductId(productId: string): void {
  const ids = allowedProductIds();
  if (!productId || !ids.has(productId)) {
    throw new RuStorePaymentError('RUSTORE_PRODUCT_NOT_ALLOWED');
  }
}

function apiRoot(sandbox: boolean): string {
  return sandbox
    ? `${RUSTORE_PUBLIC_API_ORIGIN}/public/sandbox`
    : `${RUSTORE_PUBLIC_API_ORIGIN}/public`;
}

export function resolveRuStoreSandboxMode(): boolean {
  const mode = String(process.env.RUSTORE_PAY_MODE || '').trim().toLowerCase();
  if (mode === 'sandbox') return true;
  if (mode === 'production') return false;
  throw new RuStorePaymentError('RUSTORE_PAY_MODE_REQUIRED');
}

function ruStorePrivateKey(): crypto.KeyObject {
  const encoded = required('RUSTORE_PRIVATE_KEY_BASE64').replace(/\s+/g, '');
  try {
    return crypto.createPrivateKey({
      key: Buffer.from(encoded, 'base64'),
      format: 'der',
      type: 'pkcs8',
    });
  } catch {
    throw new RuStorePaymentError('RUSTORE_PRIVATE_KEY_INVALID');
  }
}

async function requestRuStoreApiToken(): Promise<string> {
  const keyId = required('RUSTORE_KEY_ID');
  const privateKeyValue = required('RUSTORE_PRIVATE_KEY_BASE64').replace(/\s+/g, '');
  const identity = crypto.createHash('sha256').update(`${keyId}:${privateKeyValue}`).digest('hex');
  if (cachedRuStoreToken?.identity === identity && cachedRuStoreToken.refreshAt > Date.now()) {
    return cachedRuStoreToken.value;
  }
  if (ruStoreTokenRequest) return ruStoreTokenRequest;

  ruStoreTokenRequest = (async () => {
    const timestamp = new Date().toISOString();
    const signature = crypto.sign(
      'RSA-SHA512',
      Buffer.from(`${keyId}${timestamp}`, 'utf8'),
      ruStorePrivateKey(),
    ).toString('base64');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(`${RUSTORE_PUBLIC_API_ORIGIN}/public/auth/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyId, timestamp, signature }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({})) as RuStoreApiResponse;
      const jwe = String(payload.body?.jwe || '').trim();
      const ttlSeconds = Number(payload.body?.ttl);
      if (!response.ok || payload.code !== 'OK' || !jwe || !Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
        throw new RuStorePaymentError(
          'RUSTORE_API_AUTH_FAILED',
          payload.message || `HTTP_${response.status}`,
        );
      }
      cachedRuStoreToken = {
        identity,
        value: jwe,
        // RuStore tokens currently live for 900 seconds. Refresh early so a
        // token cannot expire between acquisition and subscription lookup.
        refreshAt: Date.now() + Math.max(1, ttlSeconds - 60) * 1_000,
      };
      return jwe;
    } finally {
      clearTimeout(timer);
    }
  })().finally(() => {
    ruStoreTokenRequest = null;
  });
  return ruStoreTokenRequest;
}

function tokenWasRejected(response: Response, payload: RuStoreApiResponse): boolean {
  const message = String(payload.message || '').toLowerCase();
  return response.status === 401
    || response.status === 403
    || (message.includes('jwe') && (message.includes('expired') || message.includes('token')));
}

async function ruStoreGet(path: string, sandbox: boolean): Promise<RuStoreApiBody> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const token = await requestRuStoreApiToken();
      const response = await fetch(`${apiRoot(sandbox)}${path}`, {
        headers: { 'Public-Token': token },
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({})) as RuStoreApiResponse;
      if (attempt === 0 && tokenWasRejected(response, payload)) {
        cachedRuStoreToken = null;
        continue;
      }
      if (!response.ok || payload.code !== 'OK' || !payload.body) {
        throw new RuStorePaymentError('RUSTORE_API_VALIDATION_FAILED', payload.message || `HTTP_${response.status}`);
      }
      const timestamp = asProviderTimestampText(payload.timestamp);
      if (!timestamp) throw new RuStorePaymentError('RUSTORE_API_TIMESTAMP_REQUIRED');
      return { body: payload.body, timestamp };
    }
    throw new RuStorePaymentError('RUSTORE_API_AUTH_FAILED');
  } finally {
    clearTimeout(timer);
  }
}

function asDate(value: unknown): Date | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const date = new Date(numeric);
  return Number.isNaN(date.getTime()) ? null : date;
}

function asProviderEventTime(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function asProviderTimestampText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const timestamp = value.trim();
  if (!timestamp || Number.isNaN(Date.parse(timestamp))) return null;
  // Require an explicit UTC offset so PostgreSQL never interprets provider
  // order in the database session timezone. Keep the raw fractional seconds.
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(timestamp)) return null;
  return timestamp;
}

export function shouldApplyRuStoreProviderEvent(
  eventTime: unknown,
  currentProviderEventTime: unknown,
  incomingEvent?: RuStoreSubscriptionEventContext,
  currentEvent?: RuStoreSubscriptionEventContext,
): boolean {
  const incoming = asProviderEventTime(eventTime);
  if (!incoming) return false;
  const current = currentProviderEventTime instanceof Date
    ? currentProviderEventTime
    : asProviderEventTime(currentProviderEventTime);
  if (!current || incoming.getTime() > current.getTime()) return true;
  if (incoming.getTime() < current.getTime() || !incomingEvent || !currentEvent) return false;

  const restrictionRank = (event: RuStoreSubscriptionEventContext): number => {
    const eventType = String(event.subscriptionEventType || '').toUpperCase();
    const status = String(event.status || '').toUpperCase();
    const period = String(event.period || '').toUpperCase();
    if (eventType === 'CLOSED' || ['CLOSED', 'TERMINATED'].includes(status)) return 4;
    if (period === 'HOLD' || ['HOLD', 'PAUSED'].includes(status)) return 3;
    if (eventType === 'CANCELLED' || status === 'CANCELLED' || event.autoRenewing === false) return 2;
    if (period === 'GRACE' || status === 'GRACE') return 1;
    return 0;
  };
  // RuStore does not document a total order for equal event_time values. On a
  // tie, accept only a stricter fact so access can never be over-granted.
  return restrictionRank(incomingEvent) > restrictionRank(currentEvent);
}

export function providerEventFromLedger(row: any): RuStoreSubscriptionEventContext | undefined {
  const eventTime = asProviderTimestampText(row?.provider_event_time_raw)
    || (asProviderEventTime(row?.provider_event_time)?.toISOString() ?? null);
  if (!eventTime) return undefined;
  if (!row?.provider_subscription_event_type && !row?.provider_status && !row?.provider_period) {
    return undefined;
  }
  return {
    subscriptionEventType: row.provider_subscription_event_type || null,
    status: row.provider_status || null,
    period: row.provider_period || null,
    autoRenewing: typeof row.auto_renewing === 'boolean' ? row.auto_renewing : null,
    eventTime,
  };
}

export function shouldClearRuStoreProviderOverlay(
  body: any,
  row: any,
  now = new Date(),
): boolean {
  const overlay = providerEventFromLedger(row);
  if (!overlay) return false;

  const incomingExpiry = asDate(body?.expiryTimeMillis);
  const storedExpiry = asDate(row?.expires_at);
  const paymentState = Number(body?.paymentState);
  const providerSaysAccessIsActive = (paymentState === 1 || paymentState === 2)
    && !!incomingExpiry
    && incomingExpiry.getTime() > now.getTime();
  if (!providerSaysAccessIsActive) return false;

  // Only a later paid-through date is objective proof that the subscription
  // moved beyond the provider-only HOLD/GRACE/CANCELLED fact. A same-period V4
  // response may lag the callback and must not erase it.
  return !!storedExpiry && incomingExpiry.getTime() > storedExpiry.getTime();
}

export function assertRuStorePurchaseOwner(body: any, expectedUserId: string): string {
  const externalAccountId = String(body?.externalAccountId || '').trim();
  if (!externalAccountId) {
    throw new RuStorePaymentError('RUSTORE_PURCHASE_ACCOUNT_REQUIRED');
  }
  if (externalAccountId !== expectedUserId) {
    throw new RuStorePaymentError('RUSTORE_PURCHASE_USER_MISMATCH');
  }
  return externalAccountId;
}

export function deriveRuStoreEntitlementSnapshot(
  body: any,
  now = new Date(),
  providerEvent?: RuStoreSubscriptionEventContext,
): RuStoreEntitlementSnapshot {
  const expiresAt = asDate(body?.expiryTimeMillis);
  const autoRenewing = typeof providerEvent?.autoRenewing === 'boolean'
    ? providerEvent.autoRenewing
    : (typeof body?.autoRenewing === 'boolean' ? body.autoRenewing : null);
  if (!expiresAt || expiresAt.getTime() <= now.getTime()) {
    return {
      state: 'expired',
      isPremium: false,
      expiresAt: expiresAt?.toISOString() || null,
      autoRenewing,
    };
  }

  const providerPeriod = String(
    providerEvent?.period || body?.period || body?.periodNew || body?.subscriptionPeriod || '',
  ).trim().toUpperCase();
  const providerStatus = String(providerEvent?.status || '').trim().toUpperCase();
  const providerEventType = String(providerEvent?.subscriptionEventType || '').trim().toUpperCase();
  const isClosed = providerEventType === 'CLOSED'
    || ['CLOSED', 'TERMINATED'].includes(providerStatus);
  const isHold = providerPeriod === 'HOLD'
    || providerStatus === 'HOLD'
    || providerStatus === 'PAUSED';
  if (isClosed || isHold) {
    return { state: 'expired', isPremium: false, expiresAt: expiresAt.toISOString(), autoRenewing };
  }
  const isGrace = body?.gracePeriodEnabled === true
    || providerPeriod === 'GRACE'
    || providerStatus === 'GRACE';
  if (isGrace) {
    return { state: 'grace', isPremium: true, expiresAt: expiresAt.toISOString(), autoRenewing };
  }
  if (body?.paymentState === 2) {
    return { state: 'store_trial', isPremium: true, expiresAt: expiresAt.toISOString(), autoRenewing };
  }
  if (body?.paymentState === 1) {
    const hasCancellationReason = body?.cancelReason !== undefined && body?.cancelReason !== null;
    const hasCancellationTime = body?.userCancellationTimeMillis !== undefined
      && body?.userCancellationTimeMillis !== null;
    const cancelled = autoRenewing === false
      || providerEventType === 'CANCELLED'
      || hasCancellationReason
      || hasCancellationTime;
    return {
      state: cancelled ? 'cancelled_active' : 'paid',
      isPremium: true,
      expiresAt: expiresAt.toISOString(),
      autoRenewing,
    };
  }
  return {
    state: 'expired',
    isPremium: false,
    expiresAt: expiresAt.toISOString(),
    autoRenewing,
  };
}

async function upsertSubscription(
  input: RuStoreValidationInput,
  body: any,
  productId: string,
  providerObservedAt: string,
) {
  const purchaseId = String(input.purchaseId || '').trim();
  if (!purchaseId) throw new RuStorePaymentError('RUSTORE_PURCHASE_ID_REQUIRED');
  assertRuStorePurchaseOwner(body, input.userId);
  const validationTimestamp = asProviderTimestampText(providerObservedAt);
  if (!validationTimestamp) throw new RuStorePaymentError('RUSTORE_API_TIMESTAMP_REQUIRED');
  const validationTime = new Date(validationTimestamp);
  let snapshot = deriveRuStoreEntitlementSnapshot(body, validationTime);
  const incomingProviderEventTime = input.providerEvent?.eventTime
    ? asProviderTimestampText(input.providerEvent.eventTime)
    : null;
  if (input.providerEvent?.eventTime && !incomingProviderEventTime) {
    throw new RuStorePaymentError('RUSTORE_CALLBACK_EVENT_TIME_REQUIRED');
  }
  let appliedProviderEventTime: string | null = null;
  let queuedNotification = false;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // The network request completes before a scarce DB connection is held.
    // Serialize only the ledger mutation and release automatically at COMMIT.
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [`rustore:${purchaseId}`],
    );
    // The unique index arbitrates concurrent first claims. Only after the
    // INSERT has either won or waited for the winner do we lock and verify the
    // immutable owner. SELECT ... FOR UPDATE alone cannot lock a missing row.
    const insertedPurchase = await client.query(
      `INSERT INTO store_purchases (
         provider, user_id, external_purchase_id, external_product_id,
         status, entitlement_state, auto_renewing, purchased_at, expires_at,
         last_validated_at, updated_at
       ) VALUES (
         'rustore', $1, $2, $3, $4, $4, $5, CURRENT_TIMESTAMP, $6,
          $7::timestamptz, CURRENT_TIMESTAMP
       )
       ON CONFLICT (provider, external_purchase_id) WHERE external_purchase_id IS NOT NULL
       DO NOTHING`,
      [
        input.userId,
        purchaseId,
        productId,
        snapshot.state,
        snapshot.autoRenewing,
        snapshot.expiresAt,
        validationTimestamp,
      ],
    );
    const inserted = insertedPurchase.rowCount === 1;
    const existing = await client.query(
      `SELECT user_id, status, entitlement_state, auto_renewing, expires_at,
              last_validated_at, provider_event_time, provider_period, provider_status,
              provider_subscription_event_type,
              to_char(
                provider_event_time AT TIME ZONE 'UTC',
                'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
              ) AS provider_event_time_raw,
              (last_validated_at > $2::timestamptz) AS stored_validation_is_newer,
              (last_validated_at = $2::timestamptz) AS validation_timestamp_is_equal,
              ($3::timestamptz IS NOT NULL AND (
                provider_event_time IS NULL OR provider_event_time < $3::timestamptz
              )) AS incoming_provider_event_is_newer,
              ($3::timestamptz IS NOT NULL AND provider_event_time = $3::timestamptz)
                AS provider_event_timestamp_is_equal
       FROM store_purchases
       WHERE provider = 'rustore' AND external_purchase_id = $1 FOR UPDATE`,
      [purchaseId, validationTimestamp, incomingProviderEventTime],
    );
    if (!existing.rows[0]) {
      throw new RuStorePaymentError('RUSTORE_PURCHASE_LEDGER_WRITE_FAILED');
    }
    if (String(existing.rows[0].user_id) !== input.userId) {
      throw new RuStorePaymentError('RUSTORE_PURCHASE_OWNED_BY_ANOTHER_USER');
    }
    const existingProviderEvent = providerEventFromLedger(existing.rows[0]);
    const providerEventIsNewer = !!input.providerEvent && (
      existing.rows[0].incoming_provider_event_is_newer === true
      || (
        existing.rows[0].provider_event_timestamp_is_equal === true
        && shouldApplyRuStoreProviderEvent(
          input.providerEvent.eventTime,
          existingProviderEvent?.eventTime,
          input.providerEvent,
          existingProviderEvent,
        )
      )
    );
    if (providerEventIsNewer && input.providerEvent) {
      appliedProviderEventTime = incomingProviderEventTime;
    }
    const validationIsOlder = existing.rows[0].stored_validation_is_newer === true;
    const validationIsEqual = existing.rows[0].validation_timestamp_is_equal === true;
    if (!inserted && (validationIsOlder || validationIsEqual) && !providerEventIsNewer) {
      const storedExpiresAt = existing.rows[0].expires_at
        ? new Date(existing.rows[0].expires_at)
        : null;
      const storedState = String(existing.rows[0].entitlement_state || existing.rows[0].status || 'expired');
      const allowedStoredStates = new Set(['store_trial', 'paid', 'grace', 'cancelled_active']);
      const storedIsPremium = allowedStoredStates.has(storedState)
        && !!storedExpiresAt
        && storedExpiresAt.getTime() > validationTime.getTime();
      snapshot = {
        state: storedIsPremium
          ? storedState as RuStoreEntitlementSnapshot['state']
          : 'expired',
        isPremium: storedIsPremium,
        expiresAt: storedExpiresAt && !Number.isNaN(storedExpiresAt.getTime())
          ? storedExpiresAt.toISOString()
          : null,
        autoRenewing: typeof existing.rows[0].auto_renewing === 'boolean'
          ? existing.rows[0].auto_renewing
          : null,
      };
      await client.query('COMMIT');
      return { status: snapshot.state, expiresAt: snapshot.expiresAt, snapshot };
    }
    if (validationIsOlder && providerEventIsNewer) {
      const storedExpiresAt = existing.rows[0].expires_at
        ? new Date(existing.rows[0].expires_at)
        : null;
      const storedState = String(existing.rows[0].entitlement_state || existing.rows[0].status || 'expired');
      body = {
        paymentState: storedState === 'store_trial'
          ? 2
          : (storedExpiresAt && storedExpiresAt > validationTime ? 1 : 0),
        autoRenewing: typeof existing.rows[0].auto_renewing === 'boolean'
          ? existing.rows[0].auto_renewing
          : null,
        expiryTimeMillis: storedExpiresAt?.getTime(),
        gracePeriodEnabled: storedState === 'grace',
      };
    }
    const clearExistingProviderOverlay = !providerEventIsNewer
      && shouldClearRuStoreProviderOverlay(body, existing.rows[0], validationTime);
    const effectiveProviderEvent = providerEventIsNewer
      ? input.providerEvent
      : (clearExistingProviderOverlay ? undefined : existingProviderEvent);
    snapshot = deriveRuStoreEntitlementSnapshot(body, validationTime, effectiveProviderEvent);
    const expiresAt = snapshot.expiresAt ? new Date(snapshot.expiresAt) : null;
    await client.query(
      `UPDATE store_purchases
       SET external_product_id = $2,
           status = $3,
           entitlement_state = $3,
           auto_renewing = $4,
           expires_at = $5,
           provider_event_time = COALESCE($6::timestamptz, provider_event_time),
           provider_period = CASE
             WHEN $12 THEN NULL WHEN $6::timestamptz IS NULL THEN provider_period ELSE $7
           END,
           provider_status = CASE
             WHEN $12 THEN NULL WHEN $6::timestamptz IS NULL THEN provider_status ELSE $8
           END,
           provider_subscription_event_type = CASE
             WHEN $12 THEN NULL
             WHEN $6::timestamptz IS NULL THEN provider_subscription_event_type
             ELSE $9
           END,
           last_validated_at = GREATEST(last_validated_at, $10::timestamptz),
           updated_at = CURRENT_TIMESTAMP
       WHERE provider = 'rustore'
         AND external_purchase_id = $1
          AND user_id = $11`,
      [
        purchaseId,
        productId,
        snapshot.state,
        snapshot.autoRenewing,
        snapshot.expiresAt,
        appliedProviderEventTime,
        input.providerEvent?.period || null,
        input.providerEvent?.status || null,
        input.providerEvent?.subscriptionEventType || null,
        validationTimestamp,
        input.userId,
        clearExistingProviderOverlay,
      ],
    );

    if (snapshot.isPremium && expiresAt) {
      await client.query(
        `UPDATE premium_entitlements
         SET status = 'expired', entitlement_state = 'expired', updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1
           AND source = 'rustore'
           AND metadata->>'purchaseId' = $2
           AND ends_at <> $3`,
        [input.userId, purchaseId, expiresAt.toISOString()],
      );
      await client.query(
        `INSERT INTO premium_entitlements (
           user_id, tier_name, status, entitlement_state, source, starts_at, ends_at, metadata
         )
         VALUES ($1, 'premium', 'active', $2, 'rustore', CURRENT_TIMESTAMP, $3, $4::jsonb)
         ON CONFLICT (user_id, tier_name, ends_at, source) DO UPDATE
           SET status = 'active', entitlement_state = EXCLUDED.entitlement_state,
               metadata = EXCLUDED.metadata, updated_at = CURRENT_TIMESTAMP`,
        [
          input.userId,
          snapshot.state,
          expiresAt.toISOString(),
          JSON.stringify({
            provider: 'rustore',
            purchaseId,
             productId,
             autoRenewing: snapshot.autoRenewing,
             providerEventTime: effectiveProviderEvent?.eventTime || null,
           }),
        ],
      );
    } else {
      await client.query(
        `UPDATE premium_entitlements
         SET status = 'expired', entitlement_state = 'expired',
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1
           AND source = 'rustore'
           AND metadata->>'purchaseId' = $2`,
        [input.userId, purchaseId],
      );
    }

    const providerStatus = String(effectiveProviderEvent?.status || '').trim().toUpperCase();
    const providerEventType = String(
      effectiveProviderEvent?.subscriptionEventType || '',
    ).trim().toUpperCase();
    const terminallyClosed = snapshot.state === 'expired'
      && (providerEventType === 'CLOSED' || ['CLOSED', 'TERMINATED'].includes(providerStatus));
    const actuallyExpired = terminallyClosed || (snapshot.state === 'expired'
      && !!expiresAt
      && expiresAt.getTime() <= validationTime.getTime());
    const lifecycleEventType = snapshot.state === 'cancelled_active'
      ? 'subscription_cancelled'
      : actuallyExpired
        ? 'subscription_expired'
        : null;
    if (lifecycleEventType) {
      await client.query(
        `INSERT INTO user_app_events (user_id, event_type, section, source, payload_json)
         SELECT $1, $2, 'premium', 'rustore_callback', $3::jsonb
         WHERE NOT EXISTS (
           SELECT 1 FROM user_app_events
           WHERE user_id = $1
             AND event_type = $2
             AND source = 'rustore_callback'
             AND payload_json->>'purchase_id_hash' = $4
             AND payload_json->>'entitlement_ends_at' IS NOT DISTINCT FROM $5
         )`,
        [
          input.userId,
          lifecycleEventType,
          JSON.stringify({
            entitlement_state: snapshot.state,
            entitlement_ends_at: snapshot.expiresAt,
            product_id: productId,
            auto_renew: snapshot.autoRenewing,
            purchase_id_hash: crypto.createHash('sha256').update(purchaseId).digest('hex'),
          }),
          crypto.createHash('sha256').update(purchaseId).digest('hex'),
          snapshot.expiresAt,
        ],
      );
    }
    const previousState = String(existing.rows[0].entitlement_state || existing.rows[0].status || 'expired');
    const previousExpiresAt = existing.rows[0].expires_at
      ? new Date(existing.rows[0].expires_at).getTime()
      : 0;
    const newPaidPeriod = (snapshot.state === 'paid' || snapshot.state === 'cancelled_active')
      && (inserted || previousState === 'store_trial'
        || (!!expiresAt && expiresAt.getTime() > previousExpiresAt));
    const stateChanged = inserted || previousState !== snapshot.state;
    const eventTypes: string[] = [];
    if (newPaidPeriod) eventTypes.push('payment_confirmed');
    if (snapshot.state === 'store_trial' && stateChanged) eventTypes.push('trial_started');
    if (lifecycleEventType && stateChanged) eventTypes.push(lifecycleEventType);
    if (snapshot.state === 'grace' && stateChanged) eventTypes.push('subscription_grace');
    if (snapshot.state === 'paid' && !newPaidPeriod && stateChanged) eventTypes.push('subscription_resumed');
    const purchaseHash = crypto.createHash('sha256').update(purchaseId).digest('hex');
    for (const eventType of eventTypes) {
      // A paid-through date identifies a confirmed period. Other transitions
      // also use the accepted provider event time, allowing a later cancel
      // after a resume while repeated validation stays silent.
      const transitionIdentity = eventType === 'payment_confirmed'
        ? snapshot.expiresAt || 'unknown'
        : `${snapshot.expiresAt || 'unknown'}:${appliedProviderEventTime || validationTimestamp}`;
      const transitionHash = crypto.createHash('sha256').update(transitionIdentity).digest('hex');
      await enqueueNeboOpsEvent(client, {
        eventKey: `rustore:${purchaseHash}:${eventType}:${transitionHash}`,
        eventType,
        userId: input.userId,
        occurredAt: new Date(appliedProviderEventTime || validationTimestamp),
        payload: {
          provider: 'rustore',
          productId,
          state: snapshot.state,
          expiresAt: snapshot.expiresAt,
          autoRenewing: snapshot.autoRenewing,
          sandbox: input.sandbox === true,
        },
      });
      queuedNotification = true;
    }
    await client.query('COMMIT');
    if (queuedNotification) wakeNeboOpsDelivery();
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  return { status: snapshot.state, expiresAt: snapshot.expiresAt, snapshot };
}

async function fetchRuStoreSubscription(
  productId: string,
  purchaseId: string,
  sandbox: boolean,
): Promise<RuStoreApiBody> {
  const packageName = required('RUSTORE_PACKAGE_NAME');
  validateProductId(productId);
  if (!purchaseId) throw new RuStorePaymentError('RUSTORE_PURCHASE_ID_REQUIRED');
  const response = await ruStoreGet(
    `/v4/subscription/${encodeURIComponent(packageName)}/${encodeURIComponent(productId)}/${encodeURIComponent(purchaseId)}`,
    sandbox,
  );
  const body = response.body;
  const providerProductId = String(
    body?.productId || body?.productCode || body?.product_code || '',
  ).trim();
  if (providerProductId && providerProductId !== productId) {
    throw new RuStorePaymentError('RUSTORE_PURCHASE_PRODUCT_MISMATCH');
  }
  return response;
}

/** Validates a RuStore Pay SDK subscription at RuStore before changing Premium. */
export async function validateRuStorePurchase(input: RuStoreValidationInput) {
  const productId = String(input.productId || '').trim();
  const purchaseId = String(input.purchaseId || '').trim();
  validateProductId(productId);
  if (!purchaseId) throw new RuStorePaymentError('RUSTORE_PURCHASE_ID_REQUIRED');
  const response = await fetchRuStoreSubscription(
    productId,
    purchaseId,
    input.sandbox === true,
  );
  const result = await upsertSubscription(input, response.body, productId, response.timestamp);
  const entitlement = publicPremiumEntitlementSnapshot(
    await getPremiumEntitlementState(input.userId),
  );
  if (entitlement.isPremium) {
    queuePersonalForecastPrewarmForUser({
      userId: input.userId,
      accessTier: 'premium',
      reason: 'premium_activated',
    });
  }
  return { ...result, purchaseActive: result.snapshot.isPremium, entitlement };
}

/**
 * Links an unrecognised callback only after the provider verifies both the
 * subscription endpoint and its externalAccountId. Callback fields are merely
 * candidates for that lookup and never grant access by themselves.
 */
export async function validateRuStorePurchaseFromProviderIdentity(input: {
  productId: string;
  purchaseId: string;
  invoiceId?: string;
  sandbox?: boolean;
  providerEvent?: RuStoreSubscriptionEventContext;
}) {
  const productId = String(input.productId || '').trim();
  const purchaseId = String(input.purchaseId || '').trim();
  validateProductId(productId);
  if (!purchaseId) throw new RuStorePaymentError('RUSTORE_PURCHASE_ID_REQUIRED');
  const response = await fetchRuStoreSubscription(productId, purchaseId, input.sandbox === true);
  const body = response.body;
  const userId = String(body?.externalAccountId || '').trim();
  if (!userId) throw new RuStorePaymentError('RUSTORE_PURCHASE_ACCOUNT_REQUIRED');
  const upserted = await upsertSubscription(
    { ...input, userId },
    body,
    productId,
    response.timestamp,
  );
  const result = { ...upserted, userId };
  const entitlement = publicPremiumEntitlementSnapshot(
    await getPremiumEntitlementState(result.userId),
  );
  if (entitlement.isPremium) {
    queuePersonalForecastPrewarmForUser({
      userId: result.userId,
      accessTier: 'premium',
      reason: 'premium_restored',
    });
  }
  return { ...result, purchaseActive: result.snapshot.isPremium, entitlement };
}

export type RuStoreCallback = { id?: string; timestamp?: string; payload?: string };

export function decryptRuStoreCallback(payload: string): any {
  const key = Buffer.from(required('RUSTORE_NOTIFICATION_AES_KEY'), 'base64');
  const decoded = Buffer.from(String(payload || ''), 'base64');
  if (key.length !== 32 || decoded.length <= 28) throw new RuStorePaymentError('RUSTORE_CALLBACK_DECRYPT_FAILED');
  const iv = decoded.subarray(0, 12);
  const authTag = decoded.subarray(decoded.length - 16);
  const encrypted = decoded.subarray(12, decoded.length - 16);
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8'));
  } catch {
    throw new RuStorePaymentError('RUSTORE_CALLBACK_DECRYPT_FAILED');
  }
}

/**
 * Authenticates and durably queues a notification. It deliberately does not
 * call RuStore Public API so the callback can acknowledge delivery quickly.
 */
export async function processRuStoreCallback(callback: RuStoreCallback) {
  const eventId = String(callback.id || '').trim();
  if (!eventId || !callback.payload) throw new RuStorePaymentError('RUSTORE_CALLBACK_INVALID');
  const payload = decryptRuStoreCallback(callback.payload);
  const appId = required('RUSTORE_CONSOLE_APP_ID');
  if (String(payload.app_id || payload.appId || '') !== appId) {
    throw new RuStorePaymentError('RUSTORE_CALLBACK_APP_MISMATCH');
  }
  const data = typeof payload.data === 'string' ? JSON.parse(payload.data) : payload.data || {};
  const purchaseId = String(
    data.purchase_id || data.purchaseId || data.purchase?.purchaseId || '',
  ).trim();
  const productId = String(
    data.product_code || data.productId || data.product_id || data.purchase?.productId || '',
  ).trim().slice(0, 200);
  const status = String(data.status_new || data.statusNew || data.status || '').toLowerCase() || null;
  const period = String(data.period_new || data.periodNew || '').trim().toUpperCase() || null;
  const subscriptionEventType = String(
    data.subscription_event_type || data.subscriptionEventType || '',
  ).trim().toUpperCase() || null;
  const eventTime = String(
    data.event_time || data.eventTime || '',
  ).trim() || null;
  const autoRenewing = typeof data.autorenewing === 'boolean'
    ? data.autorenewing
    : (typeof data.autoRenewing === 'boolean' ? data.autoRenewing : null);
  const notificationType = String(payload.notification_type || 'unknown').trim().toUpperCase();
  const sandbox = data.sandbox === true
    || payload.sandbox === true
    || notificationType.endsWith('_SANDBOX');
  if (sandbox !== resolveRuStoreSandboxMode()) {
    throw new RuStorePaymentError('RUSTORE_CALLBACK_ENVIRONMENT_MISMATCH');
  }
  const testEvent = notificationType === 'TEST_EVENT'
    || notificationType === 'TEST_EVENT_SANDBOX';
  const subscriptionEvent = notificationType === 'SUBSCRIPTION_EVENT'
    || notificationType === 'SUBSCRIPTION_EVENT_SANDBOX';
  if (!testEvent && !subscriptionEvent) {
    throw new RuStorePaymentError('RUSTORE_CALLBACK_TYPE_UNSUPPORTED');
  }
  if (!purchaseId && !testEvent) {
    throw new RuStorePaymentError('RUSTORE_CALLBACK_PURCHASE_REQUIRED');
  }
  if (purchaseId && !asProviderEventTime(eventTime)) {
    throw new RuStorePaymentError('RUSTORE_CALLBACK_EVENT_TIME_REQUIRED');
  }
  if (subscriptionEvent) {
    validateProductId(productId);
    const validEventTypes = new Set([
      'ACTIVATED', 'RENEWED', 'CANCELLED', 'RESUMED', 'PAYMENT_FAILED', 'CLOSED',
    ]);
    const validStatuses = new Set(['ACTIVE', 'PAUSED', 'CLOSED', 'TERMINATED']);
    const validPeriods = new Set(['TRIAL', 'PROMO', 'MAIN', 'GRACE', 'HOLD']);
    if (!validEventTypes.has(subscriptionEventType || '')) {
      throw new RuStorePaymentError('RUSTORE_CALLBACK_EVENT_TYPE_INVALID');
    }
    if (!validStatuses.has(String(status || '').toUpperCase())) {
      throw new RuStorePaymentError('RUSTORE_CALLBACK_STATUS_INVALID');
    }
    if (!validPeriods.has(period || '')) {
      throw new RuStorePaymentError('RUSTORE_CALLBACK_PERIOD_INVALID');
    }
    if (autoRenewing === null) {
      throw new RuStorePaymentError('RUSTORE_CALLBACK_AUTORENEW_REQUIRED');
    }
  }
  const pool = getPool();
  if (testEvent) {
    await pool.query(
      `INSERT INTO payment_provider_events (
         provider, external_event_id, event_type, processing_status,
         processed_at, next_attempt_at, event_payload, sandbox
       )
       VALUES ('rustore', $1, $2, 'processed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $3::jsonb, $4)
       ON CONFLICT (provider, external_event_id) DO UPDATE
         SET processing_status = 'processed', processed_at = CURRENT_TIMESTAMP,
             processing_started_at = NULL, last_error = NULL`,
      [eventId, notificationType, JSON.stringify({ notificationType, test: true }), sandbox],
    );
    return { duplicate: false, test: true };
  }
  const inserted = await pool.query(
    `INSERT INTO payment_provider_events (
       provider, external_event_id, event_type, external_purchase_id, status,
       processing_status, next_attempt_at, event_payload, sandbox
     )
     VALUES ('rustore', $1, $2, $3, $4, 'pending', CURRENT_TIMESTAMP, $5::jsonb, $6)
     ON CONFLICT (provider, external_event_id) DO NOTHING RETURNING id`,
    [
      eventId,
      notificationType,
      purchaseId || null,
      status,
      JSON.stringify({
        notificationType,
        purchaseId: purchaseId || null,
        productId: productId || null,
        status,
        period,
        subscriptionEventType,
        autoRenewing,
        eventTime,
      }),
      sandbox,
    ],
  );
  if (!inserted.rowCount) return { duplicate: true };

  return { duplicate: false, queued: true };
}

function retryDelaySeconds(attempt: number): number {
  return Math.min(6 * 60 * 60, 15 * (2 ** Math.max(0, attempt - 1)));
}

/**
 * Durable queue worker. A row is claimed with SKIP LOCKED, then validated
 * outside the claim transaction. Failures persist with bounded backoff.
 */
export async function processPendingRuStoreEvents(limit = 20): Promise<{
  claimed: number;
  processed: number;
  retried: number;
  failed: number;
}> {
  const pool = getPool();
  const claimed: any[] = [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // A worker may die after claiming a row. Reclaim abandoned leases so a
    // provider retry or the next cron run can make progress idempotently.
    await client.query(
      `UPDATE payment_provider_events
       SET processing_status = 'pending', processing_started_at = NULL,
           next_attempt_at = NOW(),
           last_error = COALESCE(last_error, 'RUSTORE_PROCESSING_LEASE_EXPIRED')
       WHERE provider = 'rustore'
         AND processing_status = 'processing'
         AND processed_at IS NULL
         AND failed_at IS NULL
         AND (
           processing_started_at IS NULL
           OR processing_started_at <= NOW() - INTERVAL '5 minutes'
         )`,
    );
    // Earlier releases dead-lettered callbacks after ten attempts. Requeue
    // those durable rows so transient provider/backend failures remain
    // recoverable and the same idempotent ownership validation can finish.
    await client.query(
      `UPDATE payment_provider_events
       SET processing_status = 'pending', failed_at = NULL,
           processing_started_at = NULL, next_attempt_at = NOW(),
           last_error = COALESCE(last_error, 'RUSTORE_LEGACY_DEAD_LETTER_REQUEUED')
       WHERE provider = 'rustore'
         AND processing_status = 'failed'
         AND processed_at IS NULL`,
    );
    const rows = await client.query(
      `SELECT id, external_purchase_id, sandbox, attempts, event_payload
       FROM payment_provider_events
       WHERE provider = 'rustore'
         AND processing_status = 'pending'
         AND processed_at IS NULL
         AND failed_at IS NULL
         AND next_attempt_at <= NOW()
       ORDER BY received_at
       FOR UPDATE SKIP LOCKED
       LIMIT $1`,
      [Math.max(1, Math.min(100, limit))],
    );
    for (const row of rows.rows) {
      await client.query(
        `UPDATE payment_provider_events
         SET processing_status = 'processing', processing_started_at = CURRENT_TIMESTAMP,
             attempts = attempts + 1
         WHERE id = $1 AND processing_status = 'pending'`,
        [row.id],
      );
      claimed.push({ ...row, attempts: Number(row.attempts || 0) + 1 });
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  let processed = 0;
  let retried = 0;
  let failed = 0;
  for (const event of claimed) {
    try {
      const record = await pool.query(
        `SELECT user_id, external_product_id, external_invoice_id
         FROM store_purchases
         WHERE provider = 'rustore' AND external_purchase_id = $1 LIMIT 1`,
        [event.external_purchase_id],
      );
      if (!record.rows[0]) {
        const eventPayload = typeof event.event_payload === 'string'
          ? JSON.parse(event.event_payload)
          : (event.event_payload || {});
        const productId = String(eventPayload.productId || '').trim();
        if (!productId) throw new RuStorePaymentError('RUSTORE_PURCHASE_NOT_LINKED');
        await validateRuStorePurchaseFromProviderIdentity({
          productId,
          purchaseId: String(event.external_purchase_id),
          sandbox: event.sandbox === true,
          providerEvent: {
            subscriptionEventType: eventPayload.subscriptionEventType,
            status: eventPayload.status,
            period: eventPayload.period,
            autoRenewing: eventPayload.autoRenewing,
            eventTime: eventPayload.eventTime,
          },
        });
      } else {
        const row = record.rows[0];
        const eventPayload = typeof event.event_payload === 'string'
          ? JSON.parse(event.event_payload)
          : (event.event_payload || {});
        await validateRuStorePurchase({
          userId: String(row.user_id),
          productId: String(row.external_product_id),
          purchaseId: String(event.external_purchase_id),
          invoiceId: row.external_invoice_id || undefined,
          sandbox: event.sandbox === true,
          providerEvent: {
            subscriptionEventType: eventPayload.subscriptionEventType,
            status: eventPayload.status,
            period: eventPayload.period,
            autoRenewing: eventPayload.autoRenewing,
            eventTime: eventPayload.eventTime,
          },
        });
      }
      await pool.query(
        `UPDATE payment_provider_events
         SET processing_status = 'processed', processed_at = CURRENT_TIMESTAMP,
             processing_started_at = NULL, last_error = NULL
         WHERE id = $1`,
        [event.id],
      );
      processed += 1;
    } catch (error) {
      const message = error instanceof RuStorePaymentError
        ? error.code
        : (error instanceof Error ? error.message : 'RUSTORE_EVENT_PROCESSING_FAILED');
      // Callback ingress already acknowledged RuStore. Keep retrying forever
      // with a capped delay so a long provider/config outage cannot silently
      // discard HOLD/GRACE/CANCELLED facts. attempts/last_error remain visible
      // to operations and allow alerting/manual inspection.
      await pool.query(
        `UPDATE payment_provider_events
         SET processing_status = 'pending', failed_at = NULL,
             processing_started_at = NULL,
             next_attempt_at = NOW() + ($2::text || ' seconds')::interval,
             last_error = $3
         WHERE id = $1`,
        [event.id, retryDelaySeconds(event.attempts), message.slice(0, 500)],
      );
      retried += 1;
    }
  }
  return { claimed: claimed.length, processed, retried, failed };
}
