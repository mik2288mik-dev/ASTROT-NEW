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
export const RUSTORE_RESULT_HANDOFF_TTL_MS = 10 * 60_000;
const inFlightPayments = new Map<string, {
  source: Promise<PaymentResult>;
  startedAt: number;
}>();
const inFlightRestores = new Map<string, Promise<PaymentResult[]>>();
const settledPaymentResultHandoffs = new Map<string, {
  result: Extract<PaymentResult, { status: 'completed' | 'inactive' }>;
  settledAt: number;
}>();
let inFlightSubscriptionManagement: Promise<boolean> | null = null;

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

const pendingCheckoutAttempts = new Map<string, PendingRuStoreCheckoutAttempt>();
const pendingPurchases = new Map<string, PendingRuStorePurchase>();

function paymentOperationKey(userId: string): string {
  return `rustore:${userId}:premium`;
}

function readSettledPaymentResultHandoff(
  key: string,
): Extract<PaymentResult, { status: 'completed' | 'inactive' }> | null {
  const handoff = settledPaymentResultHandoffs.get(key);
  if (!handoff) return null;
  const ageMs = Date.now() - handoff.settledAt;
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > RUSTORE_RESULT_HANDOFF_TTL_MS) {
    settledPaymentResultHandoffs.delete(key);
    return null;
  }
  return handoff.result;
}

function rememberSettledPaymentResultHandoff(key: string, result: PaymentResult): void {
  if (result.status !== 'completed' && result.status !== 'inactive') return;
  settledPaymentResultHandoffs.set(key, { result, settledAt: Date.now() });
}

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

type BackendValidationResult = PaymentResult;

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
      return {
        ...validated,
        reason: 'RUSTORE_SUBSCRIPTION_PAUSED',
      };
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
      ...validated,
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

function isCurrentCheckoutAttempt(value: PendingRuStoreCheckoutAttempt | null): value is PendingRuStoreCheckoutAttempt {
  const ageMs = Date.now() - Number(value?.startedAt);
  return Boolean(value && value.orderId && value.productId
    && Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= CHECKOUT_ATTEMPT_TTL_MS);
}

function readPendingCheckoutAttempt(userId: string): PendingRuStoreCheckoutAttempt | null {
  const key = pendingCheckoutStorageKey(userId);
  let value = pendingCheckoutAttempts.get(key) || null;
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) value = JSON.parse(raw) as PendingRuStoreCheckoutAttempt;
    } catch {
      // Keep the in-memory marker when durable storage is unavailable.
    }
  }
  if (!isCurrentCheckoutAttempt(value)) {
    pendingCheckoutAttempts.delete(key);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // The invalid in-memory marker has still been discarded.
      }
    }
    return null;
  }
  pendingCheckoutAttempts.set(key, value);
  return value;
}

function writePendingCheckoutAttempt(
  userId: string,
  attempt: PendingRuStoreCheckoutAttempt,
): void {
  const key = pendingCheckoutStorageKey(userId);
  pendingCheckoutAttempts.set(key, attempt);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify(attempt),
    );
  } catch {
    // The in-memory request still blocks a duplicate checkout in this session.
  }
}

function clearPendingCheckoutAttempt(userId: string): void {
  const key = pendingCheckoutStorageKey(userId);
  pendingCheckoutAttempts.delete(key);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // A recovered or terminal SDK result remains authoritative.
  }
}

function readPendingPurchase(userId: string, productId: string): PendingRuStorePurchase | null {
  const key = pendingPurchaseStorageKey(userId, productId);
  let pending = pendingPurchases.get(key) || null;
  if (!pending && typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(key);
      const value = raw ? JSON.parse(raw) as RuStorePurchase : null;
      if (value?.purchaseId && value.productId === productId) {
        pending = {
          productId,
          purchaseId: value.purchaseId,
          productType: 'SUBSCRIPTION',
          orderId: value.orderId,
          status: value.status,
        };
      }
    } catch {
      // Keep the in-memory marker when durable storage is unavailable.
    }
  }
  if (pending) pendingPurchases.set(key, pending);
  return pending;
}

function writePendingPurchase(userId: string, purchase: RuStorePurchase): void {
  if (!purchase.purchaseId) return;
  const key = pendingPurchaseStorageKey(userId, purchase.productId);
  const pending: PendingRuStorePurchase = {
    productId: purchase.productId,
    purchaseId: purchase.purchaseId,
    productType: 'SUBSCRIPTION',
    orderId: purchase.orderId,
    status: purchase.status,
  };
  pendingPurchases.set(key, pending);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(pending));
  } catch {
    // The in-memory purchase marker still prevents a duplicate checkout.
  }
}

function clearPendingPurchase(userId: string, productId: string): void {
  const key = pendingPurchaseStorageKey(userId, productId);
  pendingPurchases.delete(key);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
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
export const RUSTORE_MANAGEMENT_TIMEOUT_MS = 10_000;
const RUSTORE_RESTORE_VALIDATION_TIMEOUT_MS = PURCHASE_VALIDATION_TIMEOUT_MS;

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
      return {
        status: 'inactive',
        reason: 'RUSTORE_PREMIUM_NOT_CONFIRMED',
        entitlement,
      };
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
    const configuredProductIdList = configuredPlanEntries().map(([, configuredId]) => configuredId);
    const configuredProductIds = new Set(configuredProductIdList);
    let pendingAttempt = readPendingCheckoutAttempt(canonicalUserId);
    if (pendingAttempt && !configuredProductIds.has(pendingAttempt.productId)) {
      clearPendingCheckoutAttempt(canonicalUserId);
      pendingAttempt = null;
    }
    // A provider-confirmed purchase can remain unresolved after its checkout
    // marker is cleared. Reconcile that durable purchase before honoring a plan
    // change, otherwise month -> year can open a second order.
    const durablePendingPurchase = configuredProductIdList
      .map((configuredProductId) => readPendingPurchase(canonicalUserId, configuredProductId))
      .find((candidate): candidate is PendingRuStorePurchase => candidate !== null) || null;
    const productId = pendingAttempt?.productId
      || durablePendingPurchase?.productId
      || requestedProductId;
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
    let purchase: RuStorePurchase | null | undefined = durablePendingPurchase?.productId === productId
      ? durablePendingPurchase
      : readPendingPurchase(canonicalUserId, productId);
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
            && candidate.orderId === pendingAttempt.orderId
            && (
              Boolean(candidate.purchaseId)
              || terminalPurchaseResult(candidate) === 'cancelled'
              || terminalPurchaseResult(candidate) === 'failed'
            )
          ));
        } catch {
          return { status: 'pending', reason: 'RUSTORE_PURCHASE_RESULT_PENDING' };
        }
        if (!purchase) {
          return { status: 'pending', reason: 'RUSTORE_PURCHASE_RESULT_PENDING' };
        }
      } else {
        const orderId = crypto.randomUUID();
        writePendingCheckoutAttempt(canonicalUserId, {
          orderId,
          productId,
          startedAt: Date.now(),
        });
        try {
          purchase = await withBoundedTimeout(
            nativeBridge.purchase({ productId, appUserId: canonicalUserId, orderId }),
            RUSTORE_PURCHASE_RESULT_TIMEOUT_MS,
            'RUSTORE_PURCHASE_RESULT_TIMEOUT',
          );
        } catch (error) {
          const reason = String((error as any)?.message || (error as any)?.code || 'RUSTORE_PURCHASE_FAILED');
          if (reason === 'RUSTORE_PURCHASE_RESULT_TIMEOUT') {
            // The SDK may still complete after the JavaScript call times out. Keep
            // the durable checkout marker so the next request recovers the order
            // through getPurchases() instead of creating a duplicate checkout.
            return { status: 'pending', reason: 'RUSTORE_PURCHASE_RESULT_PENDING' };
          }
          clearPendingCheckoutAttempt(canonicalUserId);
          throw error;
        }
      }
    }
    if (!purchase) {
      return { status: 'pending', reason: 'RUSTORE_PURCHASE_RESULT_PENDING' };
    }
    if (purchase.productId !== productId || purchase.productType !== 'SUBSCRIPTION') {
      clearPendingCheckoutAttempt(canonicalUserId);
      return { status: 'failed', reason: 'RUSTORE_PURCHASE_PRODUCT_TYPE_INVALID' };
    }
    if (!purchase.purchaseId) {
      const terminal = terminalPurchaseResult(purchase);
      if (terminal === 'cancelled' || terminal === 'failed') {
        clearPendingCheckoutAttempt(canonicalUserId);
        return reconcilePurchaseResult(nativeBridge, purchase);
      }
      return { status: 'pending', reason: 'RUSTORE_PURCHASE_RESULT_PENDING' };
    }
    writePendingPurchase(canonicalUserId, purchase);
    clearPendingCheckoutAttempt(canonicalUserId);
    const result = await reconcilePurchaseResult(nativeBridge, purchase);
    if (result.status === 'completed'
      || result.status === 'inactive'
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

async function performRuStoreRestore(userId: string): Promise<PaymentResult[]> {
  const nativeBridge = bridge();
  if (!nativeBridge) return [{ status: 'unavailable', reason: 'RUSTORE_PAY_NOT_AVAILABLE' }];
  const configuredProductIdList = configuredPlanEntries().map(([, productId]) => productId);
  const configuredProductIds = new Set(configuredProductIdList);
  const durablePendingPurchases = configuredProductIdList
    .map((productId) => readPendingPurchase(userId, productId))
    .filter((purchase): purchase is PendingRuStorePurchase => purchase !== null);

  let nativePurchases: RuStorePurchase[];
  try {
    const result = await withBoundedTimeout(
      nativeBridge.getPurchases(),
      RUSTORE_RESTORE_TIMEOUT_MS,
      'RUSTORE_RESTORE_TIMEOUT',
    );
    nativePurchases = result.purchases;
  } catch (error: any) {
    if (!durablePendingPurchases.length) {
      const reason = String(error?.message || error?.code || 'RUSTORE_RESTORE_FAILED');
      return [{
        status: 'failed',
        reason: reason === 'RUSTORE_RESTORE_TIMEOUT' ? reason : 'RUSTORE_RESTORE_FAILED',
      }];
    }
    // The SDK list can lag or fail while a provider-confirmed purchase id is
    // already durable. Backend validation remains authoritative for recovery.
    nativePurchases = [];
  }

  try {
    const subscriptions = nativePurchases.filter(
      (purchase) => purchase.productType === 'SUBSCRIPTION' && configuredProductIds.has(purchase.productId),
    );
    durablePendingPurchases.forEach((pendingPurchase) => {
      const alreadyReturnedByRuStore = subscriptions.some((purchase) => (
        purchase.productId === pendingPurchase.productId
        && purchase.purchaseId === pendingPurchase.purchaseId
      ));
      if (!alreadyReturnedByRuStore) subscriptions.push(pendingPurchase);
    });
    const durablePendingIds = new Set(durablePendingPurchases.map(
      (purchase) => `${purchase.productId}:${purchase.purchaseId}`,
    ));
    const settled = await Promise.allSettled(
      subscriptions.map(async (purchase) => {
        try {
          const validation = await withBoundedTimeout(
            validateRestoredPurchase(purchase),
            RUSTORE_RESTORE_VALIDATION_TIMEOUT_MS,
            'RUSTORE_RESTORE_VALIDATION_TIMEOUT',
          );
          if (durablePendingIds.has(`${purchase.productId}:${purchase.purchaseId}`)
            && (validation.status === 'completed'
              || validation.status === 'inactive'
              || validation.status === 'cancelled'
              || (validation.status === 'failed' && SDK_TERMINAL_PURCHASE_FAILURE_REASONS.has(validation.reason)))) {
            clearPendingPurchase(userId, purchase.productId);
          }
          return validation;
        } catch (error: any) {
          const reason = String(error?.message || error?.code || 'RUSTORE_SERVER_VALIDATION_FAILED');
          if (reason === 'RUSTORE_RESTORE_VALIDATION_TIMEOUT') {
            return { status: 'pending', reason: 'RUSTORE_SERVER_VALIDATION_PENDING' } as PaymentResult;
          }
          throw error;
        }
      }),
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

export function restoreRuStorePurchases(userId: string): Promise<PaymentResult[]> {
  if (!isValidUserId(userId)) {
    return Promise.resolve([{ status: 'unavailable', reason: 'RUSTORE_ACCOUNT_ID_REQUIRED' }]);
  }
  const canonicalUserId = String(userId).trim();
  const operationKey = paymentOperationKey(canonicalUserId);
  const activePayment = inFlightPayments.get(operationKey);
  if (activePayment) {
    return observeInFlightPayment(operationKey, activePayment)
      .then((result) => [result]);
  }
  const settledHandoff = readSettledPaymentResultHandoff(operationKey);
  if (settledHandoff) return Promise.resolve([settledHandoff]);
  const current = inFlightRestores.get(canonicalUserId);
  if (current) return current;
  const source = performRuStoreRestore(canonicalUserId).finally(() => {
    if (inFlightRestores.get(canonicalUserId) === source) inFlightRestores.delete(canonicalUserId);
  });
  inFlightRestores.set(canonicalUserId, source);
  return source;
}

function observeInFlightPayment(
  key: string,
  entry: { source: Promise<PaymentResult>; startedAt: number },
): Promise<PaymentResult> {
  const releaseExpiredEntry = () => {
    if (inFlightPayments.get(key)?.source === entry.source) inFlightPayments.delete(key);
  };
  const remainingMs = RUSTORE_PURCHASE_RESULT_TIMEOUT_MS - (Date.now() - entry.startedAt);
  if (remainingMs <= 0) {
    releaseExpiredEntry();
    return Promise.resolve({
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
    if (reason === 'RUSTORE_PURCHASE_RESULT_TIMEOUT') {
      releaseExpiredEntry();
      return { status: 'pending', reason: 'RUSTORE_PURCHASE_RESULT_PENDING' };
    }
    return { status: 'failed', reason };
  });
}

function paymentResultFromRestore(results: PaymentResult[]): PaymentResult | null {
  return results.find((result) => result.status === 'completed')
    || results.find((result) => result.status === 'inactive')
    || results.find((result) => result.status === 'pending')
    || results[0]
    || null;
}

export function requestRuStorePayment(profile: UserProfile, planId: PremiumPlanId): Promise<PaymentResult> {
  const canonicalUserId = isValidUserId(profile.id) ? String(profile.id).trim() : '';
  const key = paymentOperationKey(canonicalUserId);
  const current = inFlightPayments.get(key);
  if (current) return observeInFlightPayment(key, current);
  const settledHandoff = canonicalUserId ? readSettledPaymentResultHandoff(key) : null;
  if (settledHandoff) return Promise.resolve(settledHandoff);

  const startedAt = Date.now();
  const source = (async () => {
    const activeRestore = canonicalUserId ? inFlightRestores.get(canonicalUserId) : null;
    if (activeRestore) {
      const restored = paymentResultFromRestore(await activeRestore);
      // A restore that observed any purchase state is authoritative for this
      // tap. Only a completed empty restore may proceed to a new checkout.
      if (restored) return restored;
    }
    return performRuStorePayment(profile, planId);
  })().then((result) => {
    rememberSettledPaymentResultHandoff(key, result);
    return result;
  }).finally(() => {
    if (inFlightPayments.get(key)?.source === source) inFlightPayments.delete(key);
  });
  const entry = { source, startedAt };
  inFlightPayments.set(key, entry);
  return observeInFlightPayment(key, entry);
}

export function openRuStoreSubscriptionManagement(): Promise<boolean> {
  const nativeBridge = bridge();
  if (!nativeBridge) return Promise.resolve(false);
  if (inFlightSubscriptionManagement) return inFlightSubscriptionManagement;

  const source = withBoundedTimeout(
    Promise.resolve().then(() => nativeBridge.openSubscriptionManagement()),
    RUSTORE_MANAGEMENT_TIMEOUT_MS,
    'RUSTORE_SUBSCRIPTION_MANAGEMENT_TIMEOUT',
  )
    .then((result) => result.opened)
    .catch(() => false)
    .finally(() => {
      if (inFlightSubscriptionManagement === source) inFlightSubscriptionManagement = null;
    });
  inFlightSubscriptionManagement = source;
  return source;
}
