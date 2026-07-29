import crypto from 'crypto';
import { getPool } from './db';
import { getPremiumEntitlementState } from './contentArchitecture';

export type RuStoreValidationInput = {
  userId: string;
  productId?: string;
  purchaseId?: string;
  invoiceId?: string;
  sandbox?: boolean;
};

export class RuStorePaymentError extends Error {
  constructor(readonly code: string, message = code) {
    super(message);
    this.name = 'RuStorePaymentError';
  }
}

type RuStoreApiResponse = { code?: string; message?: string; body?: any };

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
    ? 'https://public-api.rustore.ru/public/sandbox'
    : 'https://public-api.rustore.ru/public';
}

async function ruStoreGet(path: string, sandbox: boolean): Promise<any> {
  const token = required('RUSTORE_PUBLIC_API_TOKEN');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`${apiRoot(sandbox)}${path}`, {
      headers: { 'Public-Token': token },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({})) as RuStoreApiResponse;
    if (!response.ok || payload.code !== 'OK' || !payload.body) {
      throw new RuStorePaymentError('RUSTORE_API_VALIDATION_FAILED', payload.message || `HTTP_${response.status}`);
    }
    return payload.body;
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

function subscriptionStatus(body: any): 'active' | 'paused' | 'expired' {
  const expiresAt = asDate(body?.expiryTimeMillis);
  if (!expiresAt || expiresAt.getTime() <= Date.now()) return 'expired';
  // RuStore uses a missing paymentState for a cancelled subscription after its
  // paid term. ACTIVE and trial subscriptions are the only statuses that grant.
  return body?.paymentState === 1 || body?.paymentState === 2 ? 'active' : 'paused';
}

async function upsertSubscription(input: RuStoreValidationInput, body: any, productId: string) {
  const purchaseId = String(input.purchaseId || '').trim();
  if (!purchaseId) throw new RuStorePaymentError('RUSTORE_PURCHASE_ID_REQUIRED');
  const expiresAt = asDate(body.expiryTimeMillis);
  const status = subscriptionStatus(body);
  const externalAccountId = String(body.externalAccountId || '').trim();
  if (externalAccountId && externalAccountId !== input.userId) {
    throw new RuStorePaymentError('RUSTORE_PURCHASE_USER_MISMATCH');
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT user_id FROM store_purchases
       WHERE provider = 'rustore' AND external_purchase_id = $1 FOR UPDATE`,
      [purchaseId],
    );
    if (existing.rows[0] && String(existing.rows[0].user_id) !== input.userId) {
      throw new RuStorePaymentError('RUSTORE_PURCHASE_OWNED_BY_ANOTHER_USER');
    }

    await client.query(
      `INSERT INTO store_purchases (
         provider, user_id, external_purchase_id, external_invoice_id, external_product_id,
         status, purchased_at, expires_at, last_validated_at, updated_at
       ) VALUES ('rustore', $1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (provider, external_purchase_id) WHERE external_purchase_id IS NOT NULL
       DO UPDATE SET
         external_invoice_id = COALESCE(EXCLUDED.external_invoice_id, store_purchases.external_invoice_id),
         external_product_id = EXCLUDED.external_product_id,
         status = EXCLUDED.status,
         expires_at = EXCLUDED.expires_at,
         last_validated_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP`,
      [input.userId, purchaseId, input.invoiceId || null, productId, status, expiresAt?.toISOString() || null],
    );

    if (status === 'active' && expiresAt) {
      await client.query(
        `INSERT INTO premium_entitlements (user_id, tier_name, status, source, starts_at, ends_at, metadata)
         VALUES ($1, 'premium', 'active', 'rustore', CURRENT_TIMESTAMP, $2, $3::jsonb)
         ON CONFLICT (user_id, tier_name, ends_at, source) DO UPDATE
           SET status = 'active', updated_at = CURRENT_TIMESTAMP`,
        [input.userId, expiresAt.toISOString(), JSON.stringify({ provider: 'rustore', purchaseId, productId })],
      );
    } else {
      await client.query(
        `UPDATE premium_entitlements
         SET status = CASE WHEN $2 = 'paused' THEN 'cancelled' ELSE 'expired' END,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1
           AND source = 'rustore'
           AND (
             metadata->>'purchaseId' = $3
             OR metadata->>'productId' = $4
           )`,
        [input.userId, status, purchaseId, productId],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  return { status, expiresAt: expiresAt?.toISOString() || null };
}

/** Validates a RuStore Pay SDK subscription at RuStore before changing Premium. */
export async function validateRuStorePurchase(input: RuStoreValidationInput) {
  const packageName = required('RUSTORE_PACKAGE_NAME');
  const productId = String(input.productId || '').trim();
  validateProductId(productId);
  const purchaseId = String(input.purchaseId || '').trim();
  if (!purchaseId) throw new RuStorePaymentError('RUSTORE_PURCHASE_ID_REQUIRED');

  const body = await ruStoreGet(
    `/v4/subscription/${encodeURIComponent(packageName)}/${encodeURIComponent(productId)}/${encodeURIComponent(purchaseId)}`,
    input.sandbox === true,
  );
  const result = await upsertSubscription(input, body, productId);
  const entitlement = await getPremiumEntitlementState(input.userId);
  return { ...result, entitlement };
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
  const status = String(data.status_new || data.statusNew || data.status || '').toLowerCase() || null;
  const sandbox = data.sandbox === true
    || payload.sandbox === true
    || String(payload.notification_type || '').endsWith('_SANDBOX');
  const pool = getPool();
  const inserted = await pool.query(
    `INSERT INTO payment_provider_events (
       provider, external_event_id, event_type, external_purchase_id, status,
       processing_status, next_attempt_at, event_payload, sandbox
     )
     VALUES ('rustore', $1, $2, $3, $4, 'pending', CURRENT_TIMESTAMP, $5::jsonb, $6)
     ON CONFLICT (provider, external_event_id) DO NOTHING RETURNING id`,
    [
      eventId,
      String(payload.notification_type || 'unknown'),
      purchaseId || null,
      status,
      JSON.stringify({
        notificationType: String(payload.notification_type || 'unknown'),
        purchaseId: purchaseId || null,
        status,
      }),
      sandbox,
    ],
  );
  if (!inserted.rowCount) return { duplicate: true };

  // Connection tests have no purchase and must be acknowledged without creating entitlement.
  if (!purchaseId) {
    await pool.query(
      `UPDATE payment_provider_events
       SET processed_at = CURRENT_TIMESTAMP, processing_status = 'processed'
       WHERE id = $1`,
      [inserted.rows[0].id],
    );
    return { duplicate: false, test: true };
  }

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
    const rows = await client.query(
      `SELECT id, external_purchase_id, sandbox, attempts
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
         SET processing_status = 'processing', attempts = attempts + 1
         WHERE id = $1`,
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
        throw new RuStorePaymentError('RUSTORE_PURCHASE_NOT_LINKED');
      }
      const row = record.rows[0];
      await validateRuStorePurchase({
        userId: String(row.user_id),
        productId: String(row.external_product_id),
        purchaseId: String(event.external_purchase_id),
        invoiceId: row.external_invoice_id || undefined,
        sandbox: event.sandbox === true,
      });
      await pool.query(
        `UPDATE payment_provider_events
         SET processing_status = 'processed', processed_at = CURRENT_TIMESTAMP,
             last_error = NULL
         WHERE id = $1`,
        [event.id],
      );
      processed += 1;
    } catch (error) {
      const message = error instanceof RuStorePaymentError
        ? error.code
        : (error instanceof Error ? error.message : 'RUSTORE_EVENT_PROCESSING_FAILED');
      if (event.attempts >= 10) {
        await pool.query(
          `UPDATE payment_provider_events
           SET processing_status = 'failed', failed_at = CURRENT_TIMESTAMP,
               last_error = $2
           WHERE id = $1`,
          [event.id, message.slice(0, 500)],
        );
        failed += 1;
      } else {
        await pool.query(
          `UPDATE payment_provider_events
           SET processing_status = 'pending',
               next_attempt_at = NOW() + ($2::text || ' seconds')::interval,
               last_error = $3
           WHERE id = $1`,
          [event.id, retryDelaySeconds(event.attempts), message.slice(0, 500)],
        );
        retried += 1;
      }
    }
  }
  return { claimed: claimed.length, processed, retried, failed };
}
