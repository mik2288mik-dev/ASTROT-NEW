import { Capacitor, registerPlugin } from '@capacitor/core';
import type { PremiumPlanId } from '../lib/premiumPricing';
import { canUseRuStorePay } from '../lib/distributionChannel';
import { PREMIUM_ENTITLEMENT_STATES, type UserProfile } from '../types';
import type { PaymentEntitlementSnapshot, PaymentResult } from './paymentProvider';
import { apiFetch } from './apiClient';
import { isValidUserId } from '../lib/userId';

type RuStorePurchase = {
  productId: string;
  purchaseId?: string;
  invoiceId?: string;
  orderId?: string;
  productType?: string;
  status?: string;
  gracePeriodEnabled?: boolean;
};

export type RuStoreSubscriptionPeriod = {
  type: 'TrialPeriod' | 'PromoPeriod' | 'MainPeriod' | 'GracePeriod' | 'HoldPeriod' | string;
  duration: string;
  currency?: string;
  price?: number;
};

export type RuStoreSubscriptionInfo = {
  periods: RuStoreSubscriptionPeriod[];
};

export type RuStoreProduct = {
  productId: string;
  title?: string;
  amountLabel?: string;
  type?: string;
  subscriptionInfo?: RuStoreSubscriptionInfo;
};

type RuStorePayBridge = {
  getAvailability(): Promise<{ available: boolean; reason?: string }>;
  getProducts(options: { productIds: string[] }): Promise<{ products: RuStoreProduct[] }>;
  purchase(options: { productId: string; appUserId: string; orderId: string }): Promise<RuStorePurchase>;
  getPurchases(): Promise<{ purchases: RuStorePurchase[] }>;
  openSubscriptionManagement(): Promise<{ opened: boolean }>;
};

const PURCHASE_RECONCILIATION_DELAY_MS = 1_000;
const inFlightPayments = new Map<string, Promise<PaymentResult>>();

type PendingRuStorePurchase = Required<Pick<RuStorePurchase, 'productId' | 'purchaseId'>>
  & Pick<RuStorePurchase, 'orderId' | 'productType' | 'status'>;

const delay = (milliseconds: number) => new Promise<void>((resolve) => {
  globalThis.setTimeout(resolve, milliseconds);
});

const RuStorePay = registerPlugin<RuStorePayBridge>('RuStorePay');

const RUSTORE_PLAN_PRODUCT_IDS: Partial<Record<PremiumPlanId, string>> = {
  premium_month: process.env.NEXT_PUBLIC_RUSTORE_PRODUCT_PREMIUM_MONTH,
  premium_quarter: process.env.NEXT_PUBLIC_RUSTORE_PRODUCT_PREMIUM_QUARTER,
  premium_year: process.env.NEXT_PUBLIC_RUSTORE_PRODUCT_PREMIUM_YEAR,
};

function bridge(): RuStorePayBridge | null {
  if (!canUseRuStorePay() || Capacitor.getPlatform() !== 'android') return null;
  return RuStorePay;
}

function configuredPlanEntries(): Array<readonly [PremiumPlanId, string]> {
  return Object.entries(RUSTORE_PLAN_PRODUCT_IDS)
    .map(([planId, value]) => [planId as PremiumPlanId, String(value || '').trim()] as const)
    .filter(([, productId]) => productId && !productId.startsWith('RUSTORE_PRODUCT_'));
}

function isSubscriptionProduct(product: RuStoreProduct): boolean {
  return product.type === 'SUBSCRIPTION';
}

function hasMainSubscriptionPeriod(product: RuStoreProduct): boolean {
  return product.subscriptionInfo?.periods.some(
    (period) => period.type === 'MainPeriod' && Boolean(period.duration),
  ) === true;
}

function hasTrialPeriod(product: RuStoreProduct): boolean {
  return product.subscriptionInfo?.periods.some((period) => period.type === 'TrialPeriod') === true;
}

function hasPromoPeriod(product: RuStoreProduct): boolean {
  return product.subscriptionInfo?.periods.some((period) => period.type === 'PromoPeriod') === true;
}

function terminalPurchaseResult(purchase: RuStorePurchase): 'active' | 'cancelled' | 'failed' | null {
  const status = String(purchase.status || '').trim().toUpperCase();
  if (status === 'ACTIVE') return 'active';
  if (status === 'CANCELLED') return 'cancelled';
  if (['EXPIRED', 'REJECTED', 'TERMINATED', 'CLOSED'].includes(status)) return 'failed';
  return null;
}

type BackendValidationResult = PaymentResult | {
  status: 'inactive';
  entitlement: PaymentEntitlementSnapshot;
};

async function reconcilePurchaseResult(
  nativeBridge: RuStorePayBridge,
  purchase: RuStorePurchase,
): Promise<PaymentResult> {
  let current = purchase;
  for (;;) {
    const terminal = terminalPurchaseResult(current);
    if (terminal === 'cancelled') return { status: 'cancelled' };
    if (terminal === 'failed') {
      return {
        status: 'failed',
        reason: `RUSTORE_PURCHASE_${String(current.status || 'FAILED').toUpperCase()}`,
      };
    }
    if (!current.purchaseId) {
      return { status: 'failed', reason: 'RUSTORE_PURCHASE_STATUS_UNKNOWN' };
    }

    // A successful Pay SDK purchase result contains identifiers but no status.
    // Validate it immediately instead of waiting for getPurchases() to surface
    // ACTIVE; the Public API remains the only authority that can grant Premium.
    const validated = await validateWithBackend(current);
    if (validated.status === 'completed' || validated.status === 'failed') return validated;
    if (validated.status === 'inactive' && String(current.status || '').toUpperCase() === 'PAUSED') {
      return { status: 'failed', reason: 'RUSTORE_SUBSCRIPTION_PAUSED' };
    }

    await delay(PURCHASE_RECONCILIATION_DELAY_MS);
    try {
      const purchases = await nativeBridge.getPurchases();
      const next = purchases.purchases.find((candidate) => (
        candidate.purchaseId === purchase.purchaseId
        && candidate.productId === purchase.productId
        && candidate.productType === 'SUBSCRIPTION'
      ));
      if (next) current = { ...current, ...next };
    } catch {
      // Keep the checkout locked while RuStore is temporarily unreachable.
    }
  }
}

async function validateRestoredPurchase(purchase: RuStorePurchase): Promise<PaymentResult> {
  const terminal = terminalPurchaseResult(purchase);
  if (terminal === 'cancelled') return { status: 'cancelled' };
  if (terminal === 'failed') {
    return {
      status: 'failed',
      reason: `RUSTORE_PURCHASE_${String(purchase.status || 'FAILED').toUpperCase()}`,
    };
  }
  if (!purchase.purchaseId) {
    return { status: 'failed', reason: 'RUSTORE_PURCHASE_STATUS_UNKNOWN' };
  }
  const validated = await validateWithBackend(purchase);
  if (validated.status === 'inactive') {
    return {
      status: 'failed',
      reason: String(purchase.status || '').toUpperCase() === 'PAUSED'
        ? 'RUSTORE_SUBSCRIPTION_PAUSED'
        : 'RUSTORE_PREMIUM_NOT_CONFIRMED',
    };
  }
  return validated;
}

function pendingPurchaseStorageKey(userId: string, productId: string): string {
  return `lumia:rustore:pending:${encodeURIComponent(userId)}:${encodeURIComponent(productId)}`;
}

function readPendingPurchase(userId: string, productId: string): PendingRuStorePurchase | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(pendingPurchaseStorageKey(userId, productId));
    const value = raw ? JSON.parse(raw) as RuStorePurchase : null;
    if (!value?.purchaseId || value.productId !== productId) return null;
    return {
      productId,
      purchaseId: value.purchaseId,
      productType: 'SUBSCRIPTION',
      orderId: value.orderId,
      status: value.status,
    };
  } catch {
    return null;
  }
}

function writePendingPurchase(userId: string, purchase: RuStorePurchase): void {
  if (typeof window === 'undefined' || !purchase.purchaseId) return;
  try {
    window.localStorage.setItem(
      pendingPurchaseStorageKey(userId, purchase.productId),
      JSON.stringify(purchase),
    );
  } catch {
    // The in-memory promise still prevents duplicate checkout in this session.
  }
}

function clearPendingPurchase(userId: string, productId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(pendingPurchaseStorageKey(userId, productId));
  } catch {
    // A terminal provider result remains authoritative even if cleanup fails.
  }
}

const ENTITLEMENT_STATES = new Set<PaymentEntitlementSnapshot['state']>([
  ...PREMIUM_ENTITLEMENT_STATES,
]);

function parseBackendEntitlement(value: unknown): PaymentEntitlementSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const entitlement = value as Record<string, unknown>;
  const { state, isPremium, source, startsAt, endsAt, autoRenew, productId, period } = entitlement;
  if (typeof state !== 'string'
    || !ENTITLEMENT_STATES.has(state as PaymentEntitlementSnapshot['state'])
    || typeof isPremium !== 'boolean'
    || !(typeof source === 'string' || source === null)
    || !(typeof startsAt === 'string' || startsAt === null)
    || !(typeof endsAt === 'string' || endsAt === null)
    || !(typeof autoRenew === 'boolean' || autoRenew === null)
    || !(typeof productId === 'string' || productId === null)
    || !(typeof period === 'string' || period === null)) {
    return null;
  }
  return {
    state: state as PaymentEntitlementSnapshot['state'],
    isPremium,
    source,
    startsAt,
    endsAt,
    autoRenew,
    productId,
    period,
  };
}

export function getRuStoreProductId(planId: PremiumPlanId): string | null {
  const productId = String(RUSTORE_PLAN_PRODUCT_IDS[planId] || '').trim();
  return productId && !productId.startsWith('RUSTORE_PRODUCT_') ? productId : null;
}

export async function loadRuStoreProducts(): Promise<Partial<Record<PremiumPlanId, RuStoreProduct>>> {
  const nativeBridge = bridge();
  if (!nativeBridge) return {};
  const entries = configuredPlanEntries();
  if (!entries.length) return {};
  const result = await nativeBridge.getProducts({ productIds: entries.map(([, productId]) => productId) });
  const byId = new Map(
    result.products
      .filter((product) => isSubscriptionProduct(product)
        && hasMainSubscriptionPeriod(product)
        && !hasTrialPeriod(product)
        && !hasPromoPeriod(product))
      .map((product) => [product.productId, product]),
  );
  return Object.fromEntries(
    entries
      .map(([planId, productId]) => [planId, byId.get(productId)] as const)
      .filter((entry): entry is [PremiumPlanId, RuStoreProduct] => !!entry[1]),
  );
}

async function hasRecoveryIdentity(): Promise<boolean | null> {
  const response = await apiFetch('/api/auth/identities');
  if (!response.ok) return null;
  const payload = await response.json().catch(() => ({}));
  if (!Array.isArray(payload?.identities)) return null;
  return payload.identities.some((identity: any) => (
    ['vk', 'yandex', 'google', 'email'].includes(identity?.provider)
  ));
}

async function validateWithBackend(purchase: RuStorePurchase): Promise<BackendValidationResult> {
  if (!purchase.purchaseId) {
    return { status: 'failed', reason: 'RUSTORE_PURCHASE_STATUS_UNKNOWN' };
  }
  try {
    const response = await apiFetch('/api/payments/rustore/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'rustore',
        productId: purchase.productId,
        purchaseId: purchase.purchaseId,
        orderId: purchase.orderId,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const reason = String(body?.error || 'RUSTORE_SERVER_VALIDATION_FAILED');
      if ([
        'RUSTORE_PURCHASE_USER_MISMATCH',
        'RUSTORE_PURCHASE_OWNED_BY_ANOTHER_USER',
        'RUSTORE_PRODUCT_NOT_ALLOWED',
        'RECOVERY_IDENTITY_REQUIRED',
      ].includes(reason) || (response.status >= 400 && response.status < 500)) {
        return { status: 'failed', reason };
      }
      return { status: 'pending', reason: 'RUSTORE_SERVER_VALIDATION_PENDING' };
    }
    const entitlement = parseBackendEntitlement(body?.entitlement);
    if (!entitlement) return { status: 'failed', reason: 'RUSTORE_ENTITLEMENT_SNAPSHOT_INVALID' };
    if (body?.purchaseActive === true) {
      return entitlement.isPremium
        ? { status: 'completed', entitlement }
        : { status: 'failed', reason: 'RUSTORE_PREMIUM_NOT_CONFIRMED' };
    }
    if (body?.purchaseActive === false && entitlement.isPremium === false) {
      return { status: 'inactive', entitlement };
    }
    return { status: 'pending', reason: 'RUSTORE_PURCHASE_VALIDATION_PENDING' };
  } catch {
    return { status: 'pending', reason: 'RUSTORE_SERVER_VALIDATION_PENDING' };
  }
}

/** The native SDK returns an identifier only; Premium is granted exclusively by the backend. */
async function performRuStorePayment(profile: UserProfile, planId: PremiumPlanId): Promise<PaymentResult> {
  const nativeBridge = bridge();
  const productId = getRuStoreProductId(planId);
  if (!nativeBridge) return { status: 'unavailable', reason: 'RUSTORE_PAY_NOT_AVAILABLE' };
  if (!productId) return { status: 'unavailable', reason: 'RUSTORE_PRODUCT_NOT_CONFIGURED' };
  if (!isValidUserId(profile.id)) {
    return { status: 'unavailable', reason: 'RUSTORE_ACCOUNT_ID_REQUIRED' };
  }

  try {
    const recoveryIdentity = await hasRecoveryIdentity();
    if (recoveryIdentity === false) {
      return { status: 'unavailable', reason: 'RECOVERY_IDENTITY_REQUIRED' };
    }
    if (recoveryIdentity === null) {
      return { status: 'unavailable', reason: 'RECOVERY_IDENTITY_CHECK_FAILED' };
    }
    const availability = await nativeBridge.getAvailability();
    if (!availability.available) return { status: 'unavailable', reason: availability.reason || 'RUSTORE_NOT_AVAILABLE' };
    const products = await nativeBridge.getProducts({ productIds: [productId] });
    const product = products.products.find((candidate) => candidate.productId === productId);
    if (!product) {
      return { status: 'unavailable', reason: 'RUSTORE_PRODUCT_NOT_PUBLISHED' };
    }
    if (!isSubscriptionProduct(product)) {
      return { status: 'unavailable', reason: 'RUSTORE_PRODUCT_NOT_SUBSCRIPTION' };
    }
    if (hasTrialPeriod(product)) {
      return { status: 'unavailable', reason: 'RUSTORE_TRIAL_NOT_SUPPORTED' };
    }
    if (hasPromoPeriod(product)) {
      return { status: 'unavailable', reason: 'RUSTORE_PROMO_NOT_SUPPORTED' };
    }
    if (!hasMainSubscriptionPeriod(product)) {
      return { status: 'unavailable', reason: 'RUSTORE_SUBSCRIPTION_INFO_MISSING' };
    }
    const canonicalUserId = String(profile.id);
    const purchase = readPendingPurchase(canonicalUserId, productId)
      || await nativeBridge.purchase({
        productId,
        appUserId: canonicalUserId,
        orderId: crypto.randomUUID(),
      });
    if (purchase.productId !== productId || purchase.productType !== 'SUBSCRIPTION') {
      return { status: 'failed', reason: 'RUSTORE_PURCHASE_PRODUCT_TYPE_INVALID' };
    }
    writePendingPurchase(canonicalUserId, purchase);
    const result = await reconcilePurchaseResult(nativeBridge, purchase);
    if (!(result.status === 'failed' && result.reason === 'RECOVERY_IDENTITY_REQUIRED')) {
      clearPendingPurchase(canonicalUserId, productId);
    }
    return result;
  } catch (error: any) {
    const message = String(error?.message || error?.code || 'RUSTORE_PURCHASE_FAILED');
    return { status: 'failed', reason: message };
  }
}

export async function restoreRuStorePurchases(): Promise<PaymentResult[]> {
  const nativeBridge = bridge();
  if (!nativeBridge) return [{ status: 'unavailable', reason: 'RUSTORE_PAY_NOT_AVAILABLE' }];
  try {
    const result = await nativeBridge.getPurchases();
    const configuredProductIds = new Set(configuredPlanEntries().map(([, productId]) => productId));
    const subscriptions = result.purchases.filter(
      (purchase) => purchase.productType === 'SUBSCRIPTION' && configuredProductIds.has(purchase.productId),
    );
    const settled = await Promise.allSettled(
      subscriptions.map((purchase) => validateRestoredPurchase(purchase)),
    );
    return settled.map((entry) => entry.status === 'fulfilled'
      ? entry.value
      : { status: 'failed', reason: 'RUSTORE_SERVER_VALIDATION_FAILED' });
  } catch {
    return [{ status: 'failed', reason: 'RUSTORE_RESTORE_FAILED' }];
  }
}

export function requestRuStorePayment(profile: UserProfile, planId: PremiumPlanId): Promise<PaymentResult> {
  const productId = getRuStoreProductId(planId) || planId;
  const key = `${String(profile.id || '')}:${productId}`;
  const current = inFlightPayments.get(key);
  if (current) return current;
  const request = performRuStorePayment(profile, planId).finally(() => {
    if (inFlightPayments.get(key) === request) inFlightPayments.delete(key);
  });
  inFlightPayments.set(key, request);
  return request;
}

export async function openRuStoreSubscriptionManagement(): Promise<boolean> {
  const nativeBridge = bridge();
  if (!nativeBridge) return false;
  try {
    return (await nativeBridge.openSubscriptionManagement()).opened;
  } catch {
    return false;
  }
}
