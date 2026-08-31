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
const PURCHASE_RECONCILIATION_WINDOW_MS = 30_000;
const PURCHASE_VALIDATION_TIMEOUT_MS = 10_000;
const CHECKOUT_ATTEMPT_TTL_MS = 10 * 60_000;
const inFlightPayments = new Map<string, {
  source: Promise<PaymentResult>;
  startedAt: number;
}>();

const TERMINAL_BACKEND_VALIDATION_REASONS = new Set([
  'RECOVERY_IDENTITY_REQUIRED',
  'RUSTORE_PURCHASE_ID_REQUIRED',
  'RUSTORE_PURCHASE_PRODUCT_MISMATCH',
  'RUSTORE_PURCHASE_USER_MISMATCH',
  'RUSTORE_PURCHASE_OWNED_BY_ANOTHER_USER',
]);

const SDK_TERMINAL_PURCHASE_FAILURE_REASONS = new Set([
  'RUSTORE_PURCHASE_EXPIRED',
  'RUSTORE_PURCHASE_REJECTED',
  'RUSTORE_PURCHASE_TERMINATED',
  'RUSTORE_PURCHASE_CLOSED',
]);

type PendingRuStorePurchase = Required<Pick<RuStorePurchase, 'productId' | 'purchaseId'>>
  & Pick<RuStorePurchase, 'orderId' | 'productType' | 'status'>;

type PendingRuStoreCheckoutAttempt = {
  orderId: string;
  productId: string;
  startedAt: number;
};

const delay = (milliseconds: number) => new Promise<void>((resolve) => {
  globalThis.setTimeout(resolve, milliseconds);
});

function withinTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (timeoutMs <= 0) return Promise.reject(new Error('RUSTORE_RECONCILIATION_DEADLINE'));
  return new Promise<T>((resolve, reject) => {
    const timer = globalThis.setTimeout(
      () => reject(new Error('RUSTORE_RECONCILIATION_DEADLINE')),
      timeoutMs,
    );
    promise.then(
      (value) => {
        globalThis.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        globalThis.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

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
  const deadline = Date.now() + PURCHASE_RECONCILIATION_WINDOW_MS;
  for (;;) {
    const validationTimeLeft = deadline - Date.now();
    if (validationTimeLeft <= 0) {
      return { status: 'pending', reason: 'RUSTORE_PURCHASE_VALIDATION_PENDING' };
    }
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
    let validated: BackendValidationResult;
    try {
      validated = await withinTimeout(
        validateWithBackend(
          current,
          Math.min(PURCHASE_VALIDATION_TIMEOUT_MS, validationTimeLeft),
        ),
        validationTimeLeft,
      );
    } catch {
      return { status: 'pending', reason: 'RUSTORE_PURCHASE_VALIDATION_PENDING' };
    }
    if (validated.status === 'completed' || validated.status === 'failed') return validated;
    if (validated.status === 'inactive' && String(current.status || '').toUpperCase() === 'PAUSED') {
      return { status: 'failed', reason: 'RUSTORE_SUBSCRIPTION_PAUSED' };
    }

    const delayTimeLeft = deadline - Date.now();
    if (delayTimeLeft <= 0) {
      return { status: 'pending', reason: 'RUSTORE_PURCHASE_VALIDATION_PENDING' };
    }
    await delay(Math.min(PURCHASE_RECONCILIATION_DELAY_MS, delayTimeLeft));
    const sdkTimeLeft = deadline - Date.now();
    if (sdkTimeLeft <= 0) {
      return { status: 'pending', reason: 'RUSTORE_PURCHASE_VALIDATION_PENDING' };
    }
    try {
      const purchases = await withinTimeout(nativeBridge.getPurchases(), sdkTimeLeft);
      const next = purchases.purchases.find((candidate) => (
        candidate.purchaseId === purchase.purchaseId
        && candidate.productId === purchase.productId
        && candidate.productType === 'SUBSCRIPTION'
      ));
      if (next) current = { ...current, ...next };
    } catch {
      if (Date.now() >= deadline) {
        return { status: 'pending', reason: 'RUSTORE_PURCHASE_VALIDATION_PENDING' };
      }
      // Keep the checkout locked during the bounded reconciliation window.
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

function pendingCheckoutStorageKey(userId: string): string {
  return `lumia:rustore:checkout:${encodeURIComponent(userId)}:premium`;
}

function readPendingCheckoutAttempt(userId: string): PendingRuStoreCheckoutAttempt | null {
  if (typeof window === 'undefined') return null;
  const key = pendingCheckoutStorageKey(userId);
  try {
    const raw = window.localStorage.getItem(key);
    const value = raw ? JSON.parse(raw) as PendingRuStoreCheckoutAttempt : null;
    const ageMs = Date.now() - Number(value?.startedAt);
    if (!value?.orderId || !value.productId
      || !Number.isFinite(ageMs) || ageMs < 0 || ageMs > CHECKOUT_ATTEMPT_TTL_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function writePendingCheckoutAttempt(
  userId: string,
  attempt: PendingRuStoreCheckoutAttempt,
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      pendingCheckoutStorageKey(userId),
      JSON.stringify(attempt),
    );
  } catch {
    // The in-memory request still blocks a duplicate checkout in this session.
  }
}

function clearPendingCheckoutAttempt(userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(pendingCheckoutStorageKey(userId));
  } catch {
    // A recovered or terminal SDK result remains authoritative.
  }
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

export const RUSTORE_CATALOG_TIMEOUT_MS = 9_000;
export const RUSTORE_CHECKOUT_PREFLIGHT_TIMEOUT_MS = 10_000;
export const RUSTORE_PURCHASE_RESULT_TIMEOUT_MS = 60_000;
export const RUSTORE_RESTORE_TIMEOUT_MS = 10_000;

async function withBoundedTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorCode: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorCode)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

export async function loadRuStoreProducts(options?: {
  timeoutMs?: number;
}): Promise<Partial<Record<PremiumPlanId, RuStoreProduct>>> {
  const nativeBridge = bridge();
  if (!nativeBridge) return {};
  const entries = configuredPlanEntries();
  if (!entries.length) return {};
  const timeoutMs = options?.timeoutMs ?? RUSTORE_CATALOG_TIMEOUT_MS;
  const result = await withBoundedTimeout(
    nativeBridge.getProducts({ productIds: entries.map(([, productId]) => productId) }),
    timeoutMs,
    'RUSTORE_CATALOG_TIMEOUT',
  );
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

async function validateWithBackend(
  purchase: RuStorePurchase,
  timeoutMs = PURCHASE_VALIDATION_TIMEOUT_MS,
): Promise<BackendValidationResult> {
  if (!purchase.purchaseId) {
    return { status: 'failed', reason: 'RUSTORE_PURCHASE_STATUS_UNKNOWN' };
  }
  try {
    const response = await apiFetch(
      '/api/payments/rustore/validate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'rustore',
          productId: purchase.productId,
          purchaseId: purchase.purchaseId,
          orderId: purchase.orderId,
        }),
      },
      Math.max(1, timeoutMs),
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const reason = String(body?.error || 'RUSTORE_SERVER_VALIDATION_FAILED');
      if (TERMINAL_BACKEND_VALIDATION_REASONS.has(reason)) {
        return { status: 'failed', reason };
      }
      return { status: 'pending', reason };
    }
    const entitlement = parseBackendEntitlement(body?.entitlement);
    if (!entitlement) return { status: 'pending', reason: 'RUSTORE_ENTITLEMENT_SNAPSHOT_INVALID' };
    if (body?.purchaseActive === true) {
      return entitlement.isPremium
        ? { status: 'completed', entitlement }
        : { status: 'pending', reason: 'RUSTORE_PREMIUM_NOT_CONFIRMED' };
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
  const requestedProductId = getRuStoreProductId(planId);
  if (!nativeBridge) return { status: 'unavailable', reason: 'RUSTORE_PAY_NOT_AVAILABLE' };
  if (!requestedProductId) return { status: 'unavailable', reason: 'RUSTORE_PRODUCT_NOT_CONFIGURED' };
  if (!isValidUserId(profile.id)) {
    return { status: 'unavailable', reason: 'RUSTORE_ACCOUNT_ID_REQUIRED' };
  }

  try {
    const recoveryIdentity = await withBoundedTimeout(
      hasRecoveryIdentity(),
      RUSTORE_CHECKOUT_PREFLIGHT_TIMEOUT_MS,
      'RUSTORE_IDENTITY_CHECK_TIMEOUT',
    );
    if (recoveryIdentity === false) {
      return { status: 'unavailable', reason: 'RECOVERY_IDENTITY_REQUIRED' };
    }
    if (recoveryIdentity === null) {
      return { status: 'unavailable', reason: 'RECOVERY_IDENTITY_CHECK_FAILED' };
    }
    const availability = await withBoundedTimeout(
      nativeBridge.getAvailability(),
      RUSTORE_CHECKOUT_PREFLIGHT_TIMEOUT_MS,
      'RUSTORE_AVAILABILITY_TIMEOUT',
    );
    if (!availability.available) return { status: 'unavailable', reason: availability.reason || 'RUSTORE_NOT_AVAILABLE' };
    const canonicalUserId = String(profile.id);
    const configuredProductIds = new Set(configuredPlanEntries().map(([, configuredId]) => configuredId));
    let pendingAttempt = readPendingCheckoutAttempt(canonicalUserId);
    if (pendingAttempt && !configuredProductIds.has(pendingAttempt.productId)) {
      clearPendingCheckoutAttempt(canonicalUserId);
      pendingAttempt = null;
    }
    const productId = pendingAttempt?.productId || requestedProductId;
    const products = await withBoundedTimeout(
      nativeBridge.getProducts({ productIds: [productId] }),
      RUSTORE_CHECKOUT_PREFLIGHT_TIMEOUT_MS,
      'RUSTORE_PRODUCT_LOOKUP_TIMEOUT',
    );
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
    let purchase: RuStorePurchase | null | undefined = readPendingPurchase(canonicalUserId, productId);
    if (!purchase) {
      if (pendingAttempt) {
        try {
          const recovered = await withBoundedTimeout(
            nativeBridge.getPurchases(),
            RUSTORE_RESTORE_TIMEOUT_MS,
            'RUSTORE_RESTORE_TIMEOUT',
          );
          purchase = recovered.purchases.find((candidate) => (
            candidate.productId === productId
            && candidate.productType === 'SUBSCRIPTION'
          ));
        } catch {
          return { status: 'pending', reason: 'RUSTORE_PURCHASE_RESULT_PENDING' };
        }
        if (!purchase) {
          return { status: 'pending', reason: 'RUSTORE_PURCHASE_RESULT_PENDING' };
        }
        clearPendingCheckoutAttempt(canonicalUserId);
      } else {
        const orderId = crypto.randomUUID();
        writePendingCheckoutAttempt(canonicalUserId, {
          orderId,
          productId,
          startedAt: Date.now(),
        });
        try {
          purchase = await nativeBridge.purchase({ productId, appUserId: canonicalUserId, orderId });
        } catch (error) {
          clearPendingCheckoutAttempt(canonicalUserId);
          throw error;
        }
        clearPendingCheckoutAttempt(canonicalUserId);
      }
    }
    if (!purchase) {
      return { status: 'failed', reason: 'RUSTORE_PURCHASE_STATUS_UNKNOWN' };
    }
    if (purchase.productId !== productId || purchase.productType !== 'SUBSCRIPTION') {
      return { status: 'failed', reason: 'RUSTORE_PURCHASE_PRODUCT_TYPE_INVALID' };
    }
    writePendingPurchase(canonicalUserId, purchase);
    const result = await reconcilePurchaseResult(nativeBridge, purchase);
    if (result.status === 'completed'
      || result.status === 'cancelled'
      || (result.status === 'failed' && SDK_TERMINAL_PURCHASE_FAILURE_REASONS.has(result.reason))) {
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
    const result = await withBoundedTimeout(
      nativeBridge.getPurchases(),
      RUSTORE_RESTORE_TIMEOUT_MS,
      'RUSTORE_RESTORE_TIMEOUT',
    );
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
  } catch (error: any) {
    const reason = String(error?.message || error?.code || 'RUSTORE_RESTORE_FAILED');
    return [{
      status: 'failed',
      reason: reason === 'RUSTORE_RESTORE_TIMEOUT' ? reason : 'RUSTORE_RESTORE_FAILED',
    }];
  }
}

export function requestRuStorePayment(profile: UserProfile, planId: PremiumPlanId): Promise<PaymentResult> {
  const key = `rustore:${String(profile.id || '')}:premium`;
  const current = inFlightPayments.get(key);
  const observe = (entry: { source: Promise<PaymentResult>; startedAt: number }) => {
    const remainingMs = RUSTORE_PURCHASE_RESULT_TIMEOUT_MS - (Date.now() - entry.startedAt);
    if (remainingMs <= 0) {
      return Promise.resolve<PaymentResult>({
        status: 'pending',
        reason: 'RUSTORE_PURCHASE_RESULT_PENDING',
      });
    }
    return withBoundedTimeout(
      entry.source,
      remainingMs,
      'RUSTORE_PURCHASE_RESULT_TIMEOUT',
    ).catch((error: any): PaymentResult => {
      const reason = String(error?.message || error?.code || 'RUSTORE_PURCHASE_FAILED');
      return reason === 'RUSTORE_PURCHASE_RESULT_TIMEOUT'
        ? { status: 'pending', reason: 'RUSTORE_PURCHASE_RESULT_PENDING' }
        : { status: 'failed', reason };
    });
  };
  if (current) return observe(current);

  const startedAt = Date.now();
  const source = performRuStorePayment(profile, planId).finally(() => {
    if (inFlightPayments.get(key)?.source === source) inFlightPayments.delete(key);
  });
  const entry = { source, startedAt };
  inFlightPayments.set(key, entry);
  return observe(entry);
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
