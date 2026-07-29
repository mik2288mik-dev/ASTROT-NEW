import { Capacitor, registerPlugin } from '@capacitor/core';
import type { PremiumPlanId } from '../lib/premiumPricing';
import { canUseRuStorePay } from '../lib/distributionChannel';
import type { UserProfile } from '../types';
import type { PaymentResult } from './paymentProvider';
import { apiFetch } from './apiClient';

type RuStorePurchase = {
  productId: string;
  purchaseId?: string;
  invoiceId?: string;
  orderId?: string;
  productType?: string;
};

type RuStorePayBridge = {
  getAvailability(): Promise<{ available: boolean; reason?: string }>;
  getProducts(options: { productIds: string[] }): Promise<{ products: Array<{ productId: string; title?: string; amountLabel?: string; type?: string }> }>;
  purchase(options: { productId: string; appUserId: string; orderId: string }): Promise<RuStorePurchase>;
  getPurchases(): Promise<{ purchases: RuStorePurchase[] }>;
};

const RuStorePay = registerPlugin<RuStorePayBridge>('RuStorePay');
export type RuStoreProduct = {
  productId: string;
  title?: string;
  amountLabel?: string;
  type?: string;
};

const RUSTORE_PLAN_PRODUCT_IDS: Partial<Record<PremiumPlanId, string>> = {
  premium_month: process.env.NEXT_PUBLIC_RUSTORE_PRODUCT_PREMIUM_MONTH,
  premium_quarter: process.env.NEXT_PUBLIC_RUSTORE_PRODUCT_PREMIUM_QUARTER,
  premium_year: process.env.NEXT_PUBLIC_RUSTORE_PRODUCT_PREMIUM_YEAR,
};

function bridge(): RuStorePayBridge | null {
  if (!canUseRuStorePay() || Capacitor.getPlatform() !== 'android') return null;
  return RuStorePay;
}

export function getRuStoreProductId(planId: PremiumPlanId): string | null {
  const productId = String(RUSTORE_PLAN_PRODUCT_IDS[planId] || '').trim();
  return productId && !productId.startsWith('RUSTORE_PRODUCT_') ? productId : null;
}

export async function loadRuStoreProducts(): Promise<Partial<Record<PremiumPlanId, RuStoreProduct>>> {
  const nativeBridge = bridge();
  if (!nativeBridge) return {};
  const entries = Object.entries(RUSTORE_PLAN_PRODUCT_IDS)
    .map(([planId, value]) => [planId as PremiumPlanId, String(value || '').trim()] as const)
    .filter(([, productId]) => productId && !productId.startsWith('RUSTORE_PRODUCT_'));
  if (!entries.length) return {};
  const result = await nativeBridge.getProducts({ productIds: entries.map(([, productId]) => productId) });
  const byId = new Map(result.products.map((product) => [product.productId, product]));
  return Object.fromEntries(
    entries
      .map(([planId, productId]) => [planId, byId.get(productId)] as const)
      .filter((entry): entry is [PremiumPlanId, RuStoreProduct] => !!entry[1]),
  );
}

async function hasRecoveryIdentity(): Promise<boolean> {
  const response = await apiFetch('/api/auth/identities');
  if (!response.ok) return false;
  const payload = await response.json().catch(() => ({}));
  return Array.isArray(payload?.identities)
    && payload.identities.some((identity: any) => ['vk', 'yandex', 'google', 'email'].includes(identity?.provider));
}

async function validateWithBackend(purchase: RuStorePurchase): Promise<PaymentResult> {
  const response = await apiFetch('/api/payments/rustore/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'rustore',
      productId: purchase.productId,
      purchaseId: purchase.purchaseId,
      invoiceId: purchase.invoiceId,
      orderId: purchase.orderId,
    }),
  });
  if (!response.ok) return { status: 'failed', reason: 'RUSTORE_SERVER_VALIDATION_FAILED' };
  const body = await response.json().catch(() => ({}));
  return body?.entitlement?.isPremium ? { status: 'completed' } : { status: 'failed', reason: 'RUSTORE_PREMIUM_NOT_CONFIRMED' };
}

/** The native SDK returns an identifier only; Premium is granted exclusively by the backend. */
export async function requestRuStorePayment(profile: UserProfile, planId: PremiumPlanId): Promise<PaymentResult> {
  const nativeBridge = bridge();
  const productId = getRuStoreProductId(planId);
  if (!nativeBridge) return { status: 'unavailable', reason: 'RUSTORE_PAY_NOT_AVAILABLE' };
  if (!productId) return { status: 'unavailable', reason: 'RUSTORE_PRODUCT_NOT_CONFIGURED' };

  try {
    if (!(await hasRecoveryIdentity())) {
      return { status: 'unavailable', reason: 'RECOVERY_IDENTITY_REQUIRED' };
    }
    const availability = await nativeBridge.getAvailability();
    if (!availability.available) return { status: 'unavailable', reason: availability.reason || 'RUSTORE_NOT_AVAILABLE' };
    const products = await nativeBridge.getProducts({ productIds: [productId] });
    if (!products.products.some((product) => product.productId === productId)) {
      return { status: 'unavailable', reason: 'RUSTORE_PRODUCT_NOT_PUBLISHED' };
    }
    const purchase = await nativeBridge.purchase({
      productId,
      appUserId: String(profile.id),
      orderId: crypto.randomUUID(),
    });
    return validateWithBackend(purchase);
  } catch (error: any) {
    const message = String(error?.message || error?.code || 'RUSTORE_PURCHASE_FAILED');
    return /cancel/i.test(message)
      ? { status: 'cancelled' }
      : { status: 'failed', reason: message };
  }
}

export async function restoreRuStorePurchases(): Promise<PaymentResult[]> {
  const nativeBridge = bridge();
  if (!nativeBridge) return [{ status: 'unavailable', reason: 'RUSTORE_PAY_NOT_AVAILABLE' }];
  const result = await nativeBridge.getPurchases();
  return Promise.all(result.purchases.map(validateWithBackend));
}
