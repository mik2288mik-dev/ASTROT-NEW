jest.mock('../lib/db', () => ({ getPool: jest.fn() }));
jest.mock('../lib/rustorePayments', () => {
  class RuStorePaymentError extends Error {
    constructor(readonly code: string) { super(code); }
  }
  return { RuStorePaymentError, fetchRuStoreInvoice: jest.fn() };
});

import { fetchRuStoreInvoice } from '../lib/rustorePayments';
import { checkRuStoreInvoice, generateGiftCode, redeemCode, validateOneTimePurchase } from '../lib/oneTimePurchases';
import { GIFT_CODE_ALPHABET, ONE_TIME_PRODUCTS, hasEsoAccess, isOneTimeProductId } from '../lib/oneTimeProducts';

const paid = (itemCode: string, appUserId = '42') => ({
  invoiceStatus: 'CONFIRMED', appUserId, purchaseId: 'p-1', order: { itemCode, amountCurrent: 9900 },
});

/** A tiny in-memory stand-in for the tables the purchase code touches. */
function fakePool() {
  const purchases = new Map<string, string>();
  const state = new Map<string, { eso: number | null; spreads: number }>();
  const gifts = new Map<string, { invoice: string; buyer: string; days: number; months: number; redeemedBy: string | null }>();
  const users = new Map<string, { premiumUntil: string | null }>([['42', { premiumUntil: null }], ['77', { premiumUntil: null }]]);
  const query = jest.fn(async (sql: string, params: any[] = []) => {
    const text = sql.replace(/\s+/g, ' ').trim();
    if (text.startsWith('CREATE TABLE') || text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [] };
    if (text.startsWith('INSERT INTO one_time_purchases')) {
      if (purchases.has(params[2])) return { rows: [] };
      purchases.set(params[2], params[0]);
      return { rows: [{ id: 1 }] };
    }
    if (text.startsWith('SELECT user_id FROM one_time_purchases')) return { rows: purchases.has(params[1]) ? [{ user_id: purchases.get(params[1]) }] : [] };
    if (text.startsWith('INSERT INTO user_product_state (user_id, eso_until)')) {
      const current = state.get(params[0]) || { eso: null, spreads: 0 };
      const base = Math.max(current.eso || 0, Date.now());
      state.set(params[0], { ...current, eso: base + params[1] * 86_400_000 });
      return { rows: [] };
    }
    if (text.startsWith('INSERT INTO user_product_state (user_id, spread_credits)')) {
      const current = state.get(params[0]) || { eso: null, spreads: 0 };
      state.set(params[0], { ...current, spreads: current.spreads + params[1] });
      return { rows: [] };
    }
    if (text.startsWith('INSERT INTO plus_gift_codes')) {
      if (gifts.has(params[0])) return { rows: [] };
      gifts.set(params[0], { days: params[1], months: params[2], buyer: params[3], invoice: params[4], redeemedBy: null });
      return { rows: [{ code: params[0] }] };
    }
    if (text.startsWith('SELECT code FROM plus_gift_codes WHERE invoice_id')) {
      const found = [...gifts.entries()].find(([, gift]) => gift.invoice === params[0]);
      return { rows: found ? [{ code: found[0] }] : [] };
    }
    if (text.startsWith('SELECT eso_until, spread_credits')) {
      const current = state.get(params[0]);
      return { rows: current ? [{ eso_until: current.eso ? new Date(current.eso) : null, spread_credits: current.spreads }] : [] };
    }
    if (text.startsWith('SELECT code, months, redeemed_at, created_at FROM plus_gift_codes')) {
      return { rows: [...gifts.entries()].filter(([, gift]) => gift.buyer === params[0]).map(([code, gift]) => ({ code, months: gift.months, redeemed_at: gift.redeemedBy ? new Date() : null, created_at: new Date() })) };
    }
    if (text.startsWith('SELECT code, days, months, redeemed_by FROM plus_gift_codes')) {
      const gift = gifts.get(params[0]);
      return { rows: gift ? [{ code: params[0], days: gift.days, months: gift.months, redeemed_by: gift.redeemedBy }] : [] };
    }
    if (text.startsWith('SELECT premium_until FROM users')) return { rows: users.has(params[0]) ? [{ premium_until: users.get(params[0])!.premiumUntil }] : [] };
    if (text.startsWith('UPDATE users SET premium_until')) { users.set(params[0], { premiumUntil: params[1] }); return { rows: [] }; }
    if (text.startsWith('INSERT INTO premium_entitlements')) return { rows: [] };
    if (text.startsWith('UPDATE plus_gift_codes SET redeemed_by')) { gifts.get(params[0])!.redeemedBy = params[1]; return { rows: [] }; }
    if (text.startsWith('SELECT code, type, value')) return { rows: [] };
    throw new Error(`unexpected SQL: ${text}`);
  });
  const client = { query, release: jest.fn() };
  return { pool: { query, connect: jest.fn(async () => client) } as any, users, gifts };
}

describe('one-time products', () => {
  it('sells only products whose feature exists, with what the console says', () => {
    expect(Object.keys(ONE_TIME_PRODUCTS).sort()).toEqual(['eso_year', 'gift_plus_12m', 'gift_plus_1m', 'gift_plus_3m', 'spread_one', 'tips_149']);
    expect(ONE_TIME_PRODUCTS.eso_year.consumable).toBe(false);
    expect(ONE_TIME_PRODUCTS.gift_plus_12m.priceRub).toBe(2999);
    expect(isOneTimeProductId('natal_full')).toBe(false);
    expect(hasEsoAccess({ esoUntil: new Date(Date.now() + 1000).toISOString(), spreadCredits: 0, giftCodes: [] })).toBe(true);
    expect(hasEsoAccess({ esoUntil: new Date(Date.now() - 1000).toISOString(), spreadCredits: 0, giftCodes: [] })).toBe(false);
  });

  it('accepts only a paid invoice for the same product and person', () => {
    expect(checkRuStoreInvoice(paid('spread_one'), { productId: 'spread_one', userId: '42' }).amountKopecks).toBe(9900);
    expect(() => checkRuStoreInvoice({ ...paid('spread_one'), invoiceStatus: 'PAID' }, { productId: 'spread_one', userId: '42' })).toThrow('RUSTORE_INVOICE_NOT_PAID');
    expect(() => checkRuStoreInvoice(paid('tips_149'), { productId: 'spread_one', userId: '42' })).toThrow('RUSTORE_PURCHASE_PRODUCT_MISMATCH');
    expect(() => checkRuStoreInvoice(paid('spread_one', '7'), { productId: 'spread_one', userId: '42' })).toThrow('RUSTORE_PURCHASE_USER_MISMATCH');
  });

  it('makes readable gift codes without look-alike letters', () => {
    const code = generateGiftCode();
    expect(code).toMatch(/^NEBO-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect([...code.replace(/NEBO|-/g, '')].every((char) => GIFT_CODE_ALPHABET.includes(char))).toBe(true);
  });

  it('gives a spread once per invoice even when the check is repeated', async () => {
    const { pool } = fakePool();
    (fetchRuStoreInvoice as jest.Mock).mockResolvedValue({ body: paid('spread_one'), timestamp: 'x' });
    const first = await validateOneTimePurchase({ userId: '42', productId: 'spread_one', invoiceId: '100', sandbox: true }, pool);
    const again = await validateOneTimePurchase({ userId: '42', productId: 'spread_one', invoiceId: '100', sandbox: true }, pool);
    expect(first.snapshot.spreadCredits).toBe(1);
    expect(again.alreadyApplied).toBe(true);
    expect(again.snapshot.spreadCredits).toBe(1);
  });

  it('refuses an invoice already used by another account', async () => {
    const { pool } = fakePool();
    (fetchRuStoreInvoice as jest.Mock).mockResolvedValue({ body: paid('spread_one', ''), timestamp: 'x' });
    await validateOneTimePurchase({ userId: '42', productId: 'spread_one', invoiceId: '200', sandbox: true }, pool);
    await expect(validateOneTimePurchase({ userId: '77', productId: 'spread_one', invoiceId: '200', sandbox: true }, pool)).rejects.toThrow('RUSTORE_PURCHASE_OWNED_BY_ANOTHER_USER');
  });

  it('turns a gift purchase into a code that a friend redeems once for Plus days', async () => {
    const { pool, users } = fakePool();
    (fetchRuStoreInvoice as jest.Mock).mockResolvedValue({ body: paid('gift_plus_3m'), timestamp: 'x' });
    const bought = await validateOneTimePurchase({ userId: '42', productId: 'gift_plus_3m', invoiceId: '300', sandbox: true }, pool);
    expect(bought.giftCode).toMatch(/^NEBO-/);
    const retried = await validateOneTimePurchase({ userId: '42', productId: 'gift_plus_3m', invoiceId: '300', sandbox: true }, pool);
    expect(retried.giftCode).toBe(bought.giftCode);

    const redeemed = await redeemCode('77', ` ${bought.giftCode!.toLowerCase()} `, pool);
    expect(redeemed.days).toBe(90);
    expect(Date.parse(users.get('77')!.premiumUntil!)).toBeGreaterThan(Date.now() + 89 * 86_400_000);
    await expect(redeemCode('77', bought.giftCode!, pool)).rejects.toThrow('CODE_ALREADY_USED');
    await expect(redeemCode('77', 'NOPE-CODE', pool)).rejects.toThrow('CODE_NOT_FOUND');
  });
});
