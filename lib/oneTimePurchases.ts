import crypto from 'crypto';
import type { Pool, PoolClient } from 'pg';
import { getPool } from './db';
import { fetchRuStoreInvoice, RuStorePaymentError } from './rustorePayments';
import {
  GIFT_CODE_ALPHABET,
  ONE_TIME_PRODUCTS,
  isOneTimeProductId,
  normalizeRedeemCode,
  type OneTimeProductId,
  type PurchasesSnapshot,
} from './oneTimeProducts';

const DAY_MS = 86_400_000;

export const ONE_TIME_PURCHASES_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS one_time_purchases (
    id BIGSERIAL PRIMARY KEY,
    provider TEXT NOT NULL DEFAULT 'rustore',
    user_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    invoice_id TEXT NOT NULL,
    purchase_id TEXT,
    amount_kopecks INTEGER,
    sandbox BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, invoice_id)
  );
  CREATE INDEX IF NOT EXISTS one_time_purchases_user_idx ON one_time_purchases (user_id, product_id);
  CREATE TABLE IF NOT EXISTS user_product_state (
    user_id TEXT PRIMARY KEY,
    eso_until TIMESTAMPTZ,
    spread_credits INTEGER NOT NULL DEFAULT 0 CHECK (spread_credits >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS plus_gift_codes (
    code TEXT PRIMARY KEY,
    days INTEGER NOT NULL,
    months INTEGER NOT NULL,
    buyer_user_id TEXT NOT NULL,
    invoice_id TEXT NOT NULL UNIQUE,
    redeemed_by TEXT,
    redeemed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS plus_gift_codes_buyer_idx ON plus_gift_codes (buyer_user_id, created_at DESC);
`;

let schemaReady: Promise<void> | null = null;

export function ensureOneTimePurchasesSchema(pool: Pool = getPool()): Promise<void> {
  if (!schemaReady) {
    schemaReady = pool.query(ONE_TIME_PURCHASES_SCHEMA_SQL).then(() => undefined);
    schemaReady.catch(() => { schemaReady = null; });
  }
  return schemaReady;
}

export function generateGiftCode(random: (size: number) => Buffer = crypto.randomBytes): string {
  const bytes = random(8);
  const chars = Array.from(bytes, (byte) => GIFT_CODE_ALPHABET[byte % GIFT_CODE_ALPHABET.length]).join('');
  return `NEBO-${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
}

type InvoiceCheck = { productId: OneTimeProductId; purchaseId: string | null; amountKopecks: number | null };

/** The invoice must be paid in full, for this product and this person. */
export function checkRuStoreInvoice(body: any, expected: { productId: OneTimeProductId; userId: string }): InvoiceCheck {
  const status = String(body?.invoiceStatus || '').toUpperCase();
  if (status !== 'CONFIRMED') throw new RuStorePaymentError('RUSTORE_INVOICE_NOT_PAID', status || 'UNKNOWN');
  const itemCode = String(body?.order?.itemCode || '').trim();
  if (itemCode !== expected.productId) throw new RuStorePaymentError('RUSTORE_PURCHASE_PRODUCT_MISMATCH');
  const appUserId = body?.appUserId == null ? '' : String(body.appUserId).trim();
  if (appUserId && appUserId !== expected.userId) throw new RuStorePaymentError('RUSTORE_PURCHASE_USER_MISMATCH');
  const amount = Number(body?.order?.amountCurrent);
  return {
    productId: expected.productId,
    purchaseId: body?.purchaseId ? String(body.purchaseId) : null,
    amountKopecks: Number.isFinite(amount) ? Math.round(amount) : null,
  };
}

async function grantPremiumDays(client: PoolClient, userId: string, days: number, source: string, metadata: Record<string, unknown>) {
  const current = await client.query('SELECT premium_until FROM users WHERE id = $1 FOR UPDATE', [userId]);
  if (!current.rows[0]) throw new RuStorePaymentError('USER_NOT_FOUND');
  const existing = current.rows[0].premium_until ? new Date(current.rows[0].premium_until).getTime() : 0;
  const base = Math.max(existing, Date.now());
  const endsAt = new Date(base + days * DAY_MS).toISOString();
  await client.query('UPDATE users SET premium_until = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [userId, endsAt]);
  await client.query(
    `INSERT INTO premium_entitlements (user_id, tier_name, status, entitlement_state, source, starts_at, ends_at, metadata)
     VALUES ($1, 'premium', 'active', 'gift', $2, CURRENT_TIMESTAMP, $3, $4::jsonb)
     ON CONFLICT (user_id, tier_name, ends_at, source) DO UPDATE
       SET status = 'active', entitlement_state = 'gift', metadata = EXCLUDED.metadata, updated_at = CURRENT_TIMESTAMP`,
    [userId, source, endsAt, JSON.stringify(metadata)],
  );
  return endsAt;
}

export async function readPurchasesSnapshot(userId: string, pool: Pool = getPool()): Promise<PurchasesSnapshot> {
  await ensureOneTimePurchasesSchema(pool);
  const [state, codes] = await Promise.all([
    pool.query('SELECT eso_until, spread_credits FROM user_product_state WHERE user_id = $1', [userId]),
    pool.query('SELECT code, months, redeemed_at, created_at FROM plus_gift_codes WHERE buyer_user_id = $1 ORDER BY created_at DESC LIMIT 50', [userId]),
  ]);
  const row = state.rows[0];
  return {
    esoUntil: row?.eso_until ? new Date(row.eso_until).toISOString() : null,
    spreadCredits: Number(row?.spread_credits || 0),
    giftCodes: codes.rows.map((code: any) => ({
      code: String(code.code),
      months: Number(code.months),
      redeemed: Boolean(code.redeemed_at),
      createdAt: new Date(code.created_at).toISOString(),
    })),
  };
}

/**
 * Checks a one-time RuStore purchase and gives what it buys, exactly once per invoice.
 * A repeated call for the same invoice (retry after a lost response) returns the same result without granting again.
 */
export async function validateOneTimePurchase(input: {
  userId: string;
  productId: string;
  invoiceId: string;
  sandbox: boolean;
}, pool: Pool = getPool()): Promise<{ snapshot: PurchasesSnapshot; giftCode: string | null; alreadyApplied: boolean }> {
  if (!isOneTimeProductId(input.productId)) throw new RuStorePaymentError('RUSTORE_PRODUCT_NOT_ALLOWED');
  const invoiceId = String(input.invoiceId || '').trim();
  const response = await fetchRuStoreInvoice(invoiceId, input.sandbox);
  const checked = checkRuStoreInvoice(response.body, { productId: input.productId, userId: input.userId });
  const product = ONE_TIME_PRODUCTS[checked.productId];

  await ensureOneTimePurchasesSchema(pool);
  const client = await pool.connect();
  let giftCode: string | null = null;
  let alreadyApplied = false;
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO one_time_purchases (provider, user_id, product_id, invoice_id, purchase_id, amount_kopecks, sandbox)
       VALUES ('rustore', $1, $2, $3, $4, $5, $6)
       ON CONFLICT (provider, invoice_id) DO NOTHING
       RETURNING id`,
      [input.userId, product.id, invoiceId, checked.purchaseId, checked.amountKopecks, input.sandbox],
    );
    if (!inserted.rows[0]) {
      const owner = await client.query('SELECT user_id FROM one_time_purchases WHERE provider = $1 AND invoice_id = $2', ['rustore', invoiceId]);
      if (owner.rows[0] && String(owner.rows[0].user_id) !== input.userId) {
        throw new RuStorePaymentError('RUSTORE_PURCHASE_OWNED_BY_ANOTHER_USER');
      }
      alreadyApplied = true;
      const existingCode = await client.query('SELECT code FROM plus_gift_codes WHERE invoice_id = $1', [invoiceId]);
      giftCode = existingCode.rows[0]?.code ?? null;
    } else {
      const grant = product.grant;
      if (grant.kind === 'eso_days') {
        await client.query(
          `INSERT INTO user_product_state (user_id, eso_until) VALUES ($1, NOW() + make_interval(days => $2))
           ON CONFLICT (user_id) DO UPDATE
             SET eso_until = GREATEST(COALESCE(user_product_state.eso_until, NOW()), NOW()) + make_interval(days => $2),
                 updated_at = NOW()`,
          [input.userId, grant.days],
        );
      } else if (grant.kind === 'credit') {
        await client.query(
          `INSERT INTO user_product_state (user_id, spread_credits) VALUES ($1, $2)
           ON CONFLICT (user_id) DO UPDATE SET spread_credits = user_product_state.spread_credits + $2, updated_at = NOW()`,
          [input.userId, grant.amount],
        );
      } else if (grant.kind === 'gift_code') {
        for (let attempt = 0; attempt < 5 && !giftCode; attempt += 1) {
          const candidate = generateGiftCode();
          const created = await client.query(
            `INSERT INTO plus_gift_codes (code, days, months, buyer_user_id, invoice_id)
             VALUES ($1, $2, $3, $4, $5) ON CONFLICT (code) DO NOTHING RETURNING code`,
            [candidate, grant.days, grant.months, input.userId, invoiceId],
          );
          giftCode = created.rows[0]?.code ?? null;
        }
        if (!giftCode) throw new RuStorePaymentError('GIFT_CODE_GENERATION_FAILED');
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  return { snapshot: await readPurchasesSnapshot(input.userId, pool), giftCode, alreadyApplied };
}

/** Uses one bought spread. Returns false when there is none left. */
export async function consumeSpreadCredit(userId: string, pool: Pool = getPool()): Promise<boolean> {
  await ensureOneTimePurchasesSchema(pool);
  const result = await pool.query(
    `UPDATE user_product_state SET spread_credits = spread_credits - 1, updated_at = NOW()
     WHERE user_id = $1 AND spread_credits > 0 RETURNING spread_credits`,
    [userId],
  );
  return Boolean(result.rows[0]);
}

export class RedeemError extends Error {
  constructor(readonly code: 'CODE_NOT_FOUND' | 'CODE_ALREADY_USED' | 'CODE_EXPIRED' | 'CODE_LIMIT_REACHED') {
    super(code);
    this.name = 'RedeemError';
  }
}

/**
 * «Ввести код»: a Plus gift code bought by someone, or a promo code made in the admin panel (type premium_days).
 */
export async function redeemCode(userId: string, rawCode: string, pool: Pool = getPool()): Promise<{ days: number; premiumUntil: string }> {
  const code = normalizeRedeemCode(rawCode);
  if (!/^[A-Z0-9_-]{3,40}$/.test(code)) throw new RedeemError('CODE_NOT_FOUND');
  await ensureOneTimePurchasesSchema(pool);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const gift = await client.query('SELECT code, days, months, redeemed_by FROM plus_gift_codes WHERE code = $1 FOR UPDATE', [code]);
    if (gift.rows[0]) {
      if (gift.rows[0].redeemed_by) throw new RedeemError('CODE_ALREADY_USED');
      const days = Number(gift.rows[0].days);
      const premiumUntil = await grantPremiumDays(client, userId, days, 'gift_code', { code, months: Number(gift.rows[0].months) });
      await client.query('UPDATE plus_gift_codes SET redeemed_by = $2, redeemed_at = NOW() WHERE code = $1', [code, userId]);
      await client.query('COMMIT');
      return { days, premiumUntil };
    }

    const promo = await client.query(
      `SELECT code, type, value, max_uses, used_count, status, starts_at, expires_at FROM promo_codes WHERE code = $1 FOR UPDATE`,
      [code],
    );
    const row = promo.rows[0];
    if (!row || row.status !== 'active' || row.type !== 'premium_days') throw new RedeemError('CODE_NOT_FOUND');
    const now = Date.now();
    if ((row.starts_at && new Date(row.starts_at).getTime() > now) || (row.expires_at && new Date(row.expires_at).getTime() <= now)) {
      throw new RedeemError('CODE_EXPIRED');
    }
    if (Number(row.max_uses) > 0 && Number(row.used_count) >= Number(row.max_uses)) throw new RedeemError('CODE_LIMIT_REACHED');
    const used = await client.query('SELECT 1 FROM promo_redemptions WHERE code = $1 AND user_id = $2 LIMIT 1', [code, userId]);
    if (used.rows[0]) throw new RedeemError('CODE_ALREADY_USED');
    const days = Math.max(1, Math.min(Number(row.value) || 30, 3650));
    const premiumUntil = await grantPremiumDays(client, userId, days, 'promo_code', { code });
    await client.query('UPDATE promo_codes SET used_count = used_count + 1 WHERE code = $1', [code]);
    await client.query('INSERT INTO promo_redemptions (code, user_id) VALUES ($1, $2)', [code, userId]);
    await client.query('COMMIT');
    return { days, premiumUntil };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
