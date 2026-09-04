import { UserProfile } from '../types';
import { PREMIUM_PLANS, type PremiumPlanId } from '../lib/premiumPricing';
import { canUseTelegramStars } from '../lib/distributionChannel';
import { getExplicitTelegramInitDataHeaders } from './sessionService';
import { apiFetch, isNativeAppRuntime } from './apiClient';

type PaymentPlanView = {
  days: number;
  stars: number;
};

export const TELEGRAM_PAYMENT_CALLBACK_TIMEOUT_MS = 120_000;
export const TELEGRAM_PAYMENT_PENDING_TTL_MS = 10 * 60_000;

export type TelegramStarsPaymentOutcome = 'paid' | 'cancelled' | 'pending';

type StoredInvoiceState = {
  status: 'pending' | 'paid';
  expiresAt: number;
};

const TELEGRAM_PAYMENT_STORAGE_PREFIX = 'nebo:telegram-stars-invoice:v1:';
const inFlightStarsPayments = new Map<string, Promise<TelegramStarsPaymentOutcome>>();
const storedInvoiceStates = new Map<string, StoredInvoiceState>();

function paymentKey(userId: string): string {
  return `telegram:${userId}:premium`;
}

function paymentStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

function clearStoredInvoiceState(key: string): void {
  storedInvoiceStates.delete(key);
  try {
    paymentStorage()?.removeItem(`${TELEGRAM_PAYMENT_STORAGE_PREFIX}${encodeURIComponent(key)}`);
  } catch {
    // A stale durable marker can only conservatively delay another invoice until expiry.
  }
}

function writeStoredInvoiceState(key: string, status: StoredInvoiceState['status']): void {
  const state = { status, expiresAt: Date.now() + TELEGRAM_PAYMENT_PENDING_TTL_MS };
  storedInvoiceStates.set(key, state);
  try {
    paymentStorage()?.setItem(
      `${TELEGRAM_PAYMENT_STORAGE_PREFIX}${encodeURIComponent(key)}`,
      JSON.stringify(state),
    );
  } catch {
    // Storage can be disabled; the in-memory marker still deduplicates this session.
  }
}

function readStoredInvoiceState(key: string): StoredInvoiceState | null {
  const now = Date.now();
  const memoryState = storedInvoiceStates.get(key);
  const activeMemoryState = memoryState && memoryState.expiresAt > now ? memoryState : null;
  if (memoryState && !activeMemoryState) storedInvoiceStates.delete(key);
  if (activeMemoryState?.status === 'paid') return activeMemoryState;

  try {
    const storage = paymentStorage();
    const storageKey = `${TELEGRAM_PAYMENT_STORAGE_PREFIX}${encodeURIComponent(key)}`;
    const raw = storage?.getItem(storageKey);
    if (!raw) return activeMemoryState;
    const parsed = JSON.parse(raw) as Partial<StoredInvoiceState>;
    if ((parsed.status !== 'pending' && parsed.status !== 'paid')
      || typeof parsed.expiresAt !== 'number'
      || parsed.expiresAt <= now) {
      storage?.removeItem(storageKey);
      return activeMemoryState;
    }
    const state = { status: parsed.status, expiresAt: parsed.expiresAt };
    if (activeMemoryState && state.status !== 'paid') return activeMemoryState;
    storedInvoiceStates.set(key, state);
    return state;
  } catch {
    return activeMemoryState;
  }
}

function waitForTelegramCallback<Result>(
  subscribe: (finish: (result: Result) => void) => void,
  timeoutResult: Result,
  onTimeout?: () => void,
  onSubscribeError?: () => void,
  subscribeErrorResult: Result = timeoutResult,
): Promise<Result> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: Result) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timeout);
      resolve(result);
    };
    const timeout = globalThis.setTimeout(() => {
      try {
        onTimeout?.();
      } catch {
        // Cleanup must never prevent the payment result from settling.
      } finally {
        finish(timeoutResult);
      }
    }, TELEGRAM_PAYMENT_CALLBACK_TIMEOUT_MS);
    try {
      subscribe(finish);
    } catch {
      try {
        onSubscribeError?.();
      } catch {
        // Cleanup must never prevent the payment result from settling.
      } finally {
        finish(subscribeErrorResult);
      }
    }
  });
}

function paymentCopy(plan: PaymentPlanView) {
  const periodRu = plan.days >= 365 ? 'год' : plan.days >= 90 ? '3 месяца' : plan.days >= 30 ? 'месяц' : `${plan.days} дней`;
  const periodEn = plan.days >= 365 ? '1 year' : plan.days >= 90 ? '3 months' : plan.days >= 30 ? '1 month' : `${plan.days} days`;
  return {
    titleRu: `NEBO Premium · ${periodRu}`,
    descRu: `Полный доступ на ${periodRu} за ${plan.stars} Stars`,
    titleEn: `NEBO Premium · ${periodEn}`,
    descEn: `Full access for ${periodEn} for ${plan.stars} Stars`,
  };
}

/**
 * Request Premium payment via Telegram Stars for a given plan.
 * - With BOT_TOKEN: creates real invoice, opens via openInvoice
 * - Without BOT_TOKEN: sim mode with showPopup + activate API
 */
async function performStarsPayment(
  profile: UserProfile,
  planId: PremiumPlanId,
  key: string,
): Promise<TelegramStarsPaymentOutcome> {
  // Store builds must not even request a Telegram invoice. The build channel is
  // explicit, so a WebView user-agent cannot accidentally enable Stars.
  if (isNativeAppRuntime() || !canUseTelegramStars()) return 'cancelled';
  const userId = profile.id;
  if (!userId) {
    console.warn('[TelegramService] No user id');
    return 'cancelled';
  }

  const tg = (window as any).Telegram?.WebApp;

  try {
    const res = await apiFetch('/api/telegram/create-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getExplicitTelegramInitDataHeaders() },
      body: JSON.stringify({ userId, type: planId }),
    });
    const data = await res.json();

    if (data.invoiceUrl && tg?.openInvoice) {
      writeStoredInvoiceState(key, 'pending');
      return waitForTelegramCallback<TelegramStarsPaymentOutcome>((finish) => {
        tg.openInvoice(data.invoiceUrl, (status: string) => {
          if (status === 'paid') {
            writeStoredInvoiceState(key, 'paid');
            finish('paid');
            return;
          }
          if (status === 'pending') {
            writeStoredInvoiceState(key, 'pending');
            finish('pending');
            return;
          }
          clearStoredInvoiceState(key);
          finish('cancelled');
        });
      }, 'pending', undefined, () => clearStoredInvoiceState(key), 'cancelled');
    }

    if (data.simMode) {
      const plan = data.plan && typeof data.plan === 'object'
        ? data.plan as PaymentPlanView
        : (PREMIUM_PLANS[planId] || PREMIUM_PLANS.premium_week);
      const copy = paymentCopy(plan);
      return simPaymentFlow(tg, profile, copy.titleRu, copy.descRu, copy.titleEn, copy.descEn, userId, planId, plan.stars);
    }

    console.warn('[TelegramService] No invoice URL and not sim mode');
    return 'cancelled';
  } catch (err: any) {
    console.error('[TelegramService] Payment error:', err?.message);
    clearStoredInvoiceState(key);
    return 'cancelled';
  }
}

export function requestStarsPayment(
  profile: UserProfile,
  planId: PremiumPlanId = 'premium_week',
): Promise<TelegramStarsPaymentOutcome> {
  const key = paymentKey(String(profile.id || ''));
  const current = inFlightStarsPayments.get(key);
  if (current) return current;
  const storedState = readStoredInvoiceState(key);
  if (storedState) return Promise.resolve(storedState.status === 'paid' ? 'paid' : 'pending');
  const source = performStarsPayment(profile, planId, key).finally(() => {
    if (inFlightStarsPayments.get(key) === source) inFlightStarsPayments.delete(key);
  });
  inFlightStarsPayments.set(key, source);
  return source;
}

async function simPaymentFlow(
  tg: any,
  profile: UserProfile,
  titleRu: string,
  descRu: string,
  titleEn: string,
  descEn: string,
  userId: string,
  planId: PremiumPlanId,
  stars: number
): Promise<TelegramStarsPaymentOutcome> {
  if (!tg) {
    return new Promise((resolve) => {
      const ok = window.confirm(`Simulate Payment: ${descEn}?`);
      if (ok) {
        activateSim(userId, { simMode: true, type: planId })
          .then((activated) => resolve(activated ? 'paid' : 'cancelled'))
          .catch(() => resolve('cancelled'));
      } else {
        resolve('cancelled');
      }
    });
  }

  const hasPopup = tg.isVersionAtLeast ? tg.isVersionAtLeast('6.2') : false;
  if (!hasPopup) {
    return new Promise((resolve) => {
      const ok = window.confirm(profile.language === 'ru' ? descRu : descEn);
      if (ok) {
        activateSim(userId, { simMode: true, type: planId })
          .then((activated) => resolve(activated ? 'paid' : 'cancelled'))
          .catch(() => resolve('cancelled'));
      } else {
        resolve('cancelled');
      }
    });
  }

  return waitForTelegramCallback<TelegramStarsPaymentOutcome>((finish) => {
    tg.showPopup(
      {
        title: profile.language === 'ru' ? titleRu : titleEn,
        message: profile.language === 'ru' ? descRu : descEn,
        buttons: [
          { id: 'pay', type: 'default', text: `Pay ${stars} stars` },
          { id: 'cancel', type: 'destructive', text: 'Cancel' },
        ],
      },
      (buttonId: string) => {
        if (buttonId === 'pay') {
          if (tg.MainButton) tg.MainButton.showProgress();
          activateSim(userId, { simMode: true, type: planId })
            .then((activated) => finish(activated ? 'paid' : 'cancelled'))
            .catch(() => finish('cancelled'))
            .finally(() => {
              try {
                if (tg.MainButton) tg.MainButton.hideProgress();
              } catch {
                // Telegram UI cleanup is best effort.
              }
            });
        } else {
          finish('cancelled');
        }
      }
    );
  }, 'cancelled', () => {
    if (tg.MainButton) tg.MainButton.hideProgress();
  });
}

async function activateSim(userId: string, payload: Record<string, any>): Promise<boolean> {
  if (isNativeAppRuntime()) return false;
  const res = await apiFetch('/api/subscriptions/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getExplicitTelegramInitDataHeaders() },
    body: JSON.stringify({ userId, ...payload }),
  });
  const data = await res.json();
  return data.success === true;
}
