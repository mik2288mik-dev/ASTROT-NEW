import { Capacitor, registerPlugin } from '@capacitor/core';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { canUseRuStorePay } from '../lib/distributionChannel';
import { EMPTY_PURCHASES, type OneTimeProductId, type PurchasesSnapshot } from '../lib/oneTimeProducts';
import { apiFetch } from './apiClient';

type NativeProductPurchase = {
  productId: string;
  orderId?: string;
  purchaseId?: string;
  invoiceId?: string;
  productType?: string;
  status?: string;
};

type OneTimeBridge = {
  getAvailability(): Promise<{ available: boolean; reason?: string }>;
  purchaseProduct(options: { productId: string; appUserId: string; orderId: string }): Promise<NativeProductPurchase>;
  acknowledgePurchase(options: { purchaseId: string }): Promise<{ state: string }>;
  getPurchases(): Promise<{ purchases: NativeProductPurchase[] }>;
};

const RuStorePay = registerPlugin<OneTimeBridge>('RuStorePay');

function bridge(): OneTimeBridge | null {
  if (!canUseRuStorePay() || Capacitor.getPlatform() !== 'android') return null;
  return RuStorePay;
}

export function canBuyOneTimeProducts(): boolean {
  return bridge() !== null;
}

export type OneTimePurchaseResult =
  | { status: 'completed'; snapshot: PurchasesSnapshot; giftCode: string | null }
  | { status: 'cancelled' }
  | { status: 'pending'; reason: string }
  | { status: 'unavailable' | 'failed'; reason: string };

// ───────────── what the person owns ─────────────

let snapshot: PurchasesSnapshot = EMPTY_PURCHASES;
let loadedFor: string | null = null;
const listeners = new Set<() => void>();

function setSnapshot(next: PurchasesSnapshot, userId: string) {
  snapshot = next;
  loadedFor = userId;
  listeners.forEach((listener) => listener());
}

export async function refreshPurchases(userId: string): Promise<PurchasesSnapshot> {
  const response = await apiFetch('/api/me/purchases', { method: 'GET' }, 10_000);
  if (!response.ok) throw new Error('PURCHASES_UNAVAILABLE');
  const body = await response.json() as PurchasesSnapshot;
  setSnapshot({ ...EMPTY_PURCHASES, ...body }, userId);
  return snapshot;
}

/** The person's one-time purchases, loaded once per account and kept fresh after each buy. */
export function usePurchases(userId: string | undefined): [PurchasesSnapshot, () => void] {
  const subscribe = useCallback((notify: () => void) => { listeners.add(notify); return () => { listeners.delete(notify); }; }, []);
  const current = useSyncExternalStore(subscribe, () => (loadedFor === userId ? snapshot : EMPTY_PURCHASES), () => EMPTY_PURCHASES);
  const reload = useCallback(() => { if (userId) void refreshPurchases(userId).catch(() => undefined); }, [userId]);
  useEffect(() => { if (userId && loadedFor !== userId) reload(); }, [userId, reload]);
  return [current, reload];
}

/** Spends one bought spread on the server. */
export async function spendSpreadCredit(userId: string): Promise<boolean> {
  const response = await apiFetch('/api/me/purchases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'use_spread' }),
  }, 10_000);
  if (!response.ok) return false;
  setSnapshot({ ...EMPTY_PURCHASES, ...(await response.json()) }, userId);
  return true;
}

// ───────────── purchases that did not finish ─────────────

type PendingPurchase = { productId: OneTimeProductId; orderId: string; invoiceId?: string; purchaseId?: string; startedAt: number };

const pendingKey = (userId: string) => `nebo.onetime.pending.v1:${userId}`;
const PENDING_TTL_MS = 3 * 24 * 60 * 60_000;

function readPending(userId: string): PendingPurchase[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(pendingKey(userId)) || '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => item && item.orderId && Date.now() - Number(item.startedAt) < PENDING_TTL_MS) : [];
  } catch {
    return [];
  }
}

function writePending(userId: string, items: PendingPurchase[]) {
  try { window.localStorage.setItem(pendingKey(userId), JSON.stringify(items)); } catch { /* storage may be unavailable */ }
}

function upsertPending(userId: string, item: PendingPurchase) {
  writePending(userId, [...readPending(userId).filter((other) => other.orderId !== item.orderId), item]);
}

function dropPending(userId: string, orderId: string) {
  writePending(userId, readPending(userId).filter((item) => item.orderId !== orderId));
}

const TERMINAL_ERRORS = new Set([
  'RUSTORE_PRODUCT_NOT_ALLOWED', 'RUSTORE_INVOICE_ID_REQUIRED', 'RUSTORE_PURCHASE_PRODUCT_MISMATCH',
  'RUSTORE_PURCHASE_USER_MISMATCH', 'RUSTORE_PURCHASE_OWNED_BY_ANOTHER_USER', 'RECOVERY_IDENTITY_REQUIRED',
]);

async function validate(userId: string, item: PendingPurchase): Promise<OneTimePurchaseResult> {
  if (!item.invoiceId) return { status: 'pending', reason: 'RUSTORE_INVOICE_PENDING' };
  try {
    const response = await apiFetch('/api/payments/rustore/product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: item.productId, invoiceId: item.invoiceId }),
    }, 15_000);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const reason = String(body?.error || 'PRODUCT_VALIDATION_FAILED');
      if (TERMINAL_ERRORS.has(reason)) {
        dropPending(userId, item.orderId);
        return { status: 'failed', reason };
      }
      return { status: 'pending', reason };
    }
    dropPending(userId, item.orderId);
    setSnapshot({ ...EMPTY_PURCHASES, ...body.snapshot }, userId);
    if (item.purchaseId) void bridge()?.acknowledgePurchase({ purchaseId: item.purchaseId }).catch(() => undefined);
    return { status: 'completed', snapshot: body.snapshot, giftCode: body.giftCode ?? null };
  } catch {
    return { status: 'pending', reason: 'NETWORK' };
  }
}

/** Finishes purchases that were paid but not delivered (the app closed, the network dropped). */
export async function resumePendingPurchases(userId: string): Promise<OneTimePurchaseResult[]> {
  const pending = readPending(userId);
  if (!pending.length) return [];
  const native = bridge();
  let known: NativeProductPurchase[] = [];
  if (native && pending.some((item) => !item.invoiceId)) {
    known = await native.getPurchases().then((result) => result.purchases).catch(() => []);
  }
  const results: OneTimePurchaseResult[] = [];
  for (const item of pending) {
    let current = item;
    if (!current.invoiceId) {
      const found = known.find((purchase) => purchase.orderId === item.orderId && purchase.invoiceId);
      if (!found) continue;
      current = { ...item, invoiceId: String(found.invoiceId), purchaseId: found.purchaseId };
      upsertPending(userId, current);
    }
    results.push(await validate(userId, current));
  }
  return results;
}

/** Buys a one-time product through RuStore and delivers it after our server checks the payment. */
export async function buyOneTimeProduct(userId: string, productId: OneTimeProductId): Promise<OneTimePurchaseResult> {
  const native = bridge();
  if (!native || !userId) return { status: 'unavailable', reason: 'RUSTORE_ONLY' };
  const availability = await native.getAvailability().catch(() => ({ available: false, reason: 'RUSTORE_NOT_AVAILABLE' }));
  if (!availability.available) return { status: 'unavailable', reason: availability.reason || 'RUSTORE_NOT_AVAILABLE' };

  const orderId = crypto.randomUUID();
  upsertPending(userId, { productId, orderId, startedAt: Date.now() });
  let result: NativeProductPurchase;
  try {
    result = await native.purchaseProduct({ productId, appUserId: userId, orderId });
  } catch (error) {
    // The payment sheet may still finish; the pending order is resolved later from getPurchases().
    return { status: 'pending', reason: String((error as { message?: string })?.message || 'RUSTORE_PURCHASE_FAILED') };
  }
  if (result.status === 'CANCELLED' || !result.invoiceId) {
    dropPending(userId, orderId);
    return { status: 'cancelled' };
  }
  const item: PendingPurchase = { productId, orderId, invoiceId: String(result.invoiceId), purchaseId: result.purchaseId, startedAt: Date.now() };
  upsertPending(userId, item);
  return validate(userId, item);
}

/** «Ввести код»: a Plus gift code or a promo code. */
export async function redeemPlusCode(code: string): Promise<{ ok: true; days: number } | { ok: false; reason: string }> {
  try {
    const response = await apiFetch('/api/me/redeem-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    }, 15_000);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, reason: String(body?.error || 'REDEEM_FAILED') };
    return { ok: true, days: Number(body.days) || 0 };
  } catch {
    return { ok: false, reason: 'NETWORK' };
  }
}
