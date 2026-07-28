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
         WHERE user_id = $1 AND source = 'rustore' AND metadata->>'purchaseId' = $3`,
        [input.userId, status, purchaseId],
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

/** Stores each notification first; retries with the same id are safe. */
export async function processRuStoreCallback(callback: RuStoreCallback) {
  const eventId = String(callback.id || '').trim();
  if (!eventId || !callback.payload) throw new RuStorePaymentError('RUSTORE_CALLBACK_INVALID');
  const payload = decryptRuStoreCallback(callback.payload);
  const appId = required('RUSTORE_CONSOLE_APP_ID');
  if (String(payload.app_id) !== appId) throw new RuStorePaymentError('RUSTORE_CALLBACK_APP_MISMATCH');
  const data = typeof payload.data === 'string' ? JSON.parse(payload.data) : payload.data || {};
  const purchaseId = String(data.purchase_id || '').trim();
  const status = String(data.status_new || '').toLowerCase() || null;
  const pool = getPool();
  const inserted = await pool.query(
    `INSERT INTO payment_provider_events (provider, external_event_id, event_type, external_purchase_id, status)
     VALUES ('rustore', $1, $2, $3, $4)
     ON CONFLICT (provider, external_event_id) DO NOTHING RETURNING id`,
    [eventId, String(payload.notification_type || 'unknown'), purchaseId || null, status],
  );
  if (!inserted.rowCount) return { duplicate: true };

  // Connection tests have no purchase and must be acknowledged without creating entitlement.
  if (!purchaseId) {
    await pool.query('UPDATE payment_provider_events SET processed_at = CURRENT_TIMESTAMP WHERE id = $1', [inserted.rows[0].id]);
    return { duplicate: false, test: true };
  }

  const record = await pool.query(
    `SELECT user_id, external_product_id, external_invoice_id FROM store_purchases
     WHERE provider = 'rustore' AND external_purchase_id = $1 LIMIT 1`,
    [purchaseId],
  );
  if (!record.rows[0]) {
    // Never issue Premium from a callback alone. Client/server validation links a purchase to a user first.
    await pool.query('UPDATE payment_provider_events SET processed_at = CURRENT_TIMESTAMP WHERE id = $1', [inserted.rows[0].id]);
    return { duplicate: false, pendingValidation: true };
  }
  const row = record.rows[0];
  await validateRuStorePurchase({
    userId: String(row.user_id),
    productId: String(row.external_product_id),
    purchaseId,
    invoiceId: row.external_invoice_id || undefined,
    sandbox: String(payload.notification_type || '').endsWith('_SANDBOX'),
  });
  await pool.query('UPDATE payment_provider_events SET processed_at = CURRENT_TIMESTAMP WHERE id = $1', [inserted.rows[0].id]);
  return { duplicate: false, processed: true };
}
