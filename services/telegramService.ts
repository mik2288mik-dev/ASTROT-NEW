import { UserProfile } from '../types';
import { PREMIUM_PLANS, type PremiumPlanId } from '../lib/premiumPricing';
import { getTelegramInitDataHeaders } from './sessionService';

const API_BASE = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Request Premium payment via Telegram Stars for a given plan.
 * - With BOT_TOKEN: creates real invoice, opens via openInvoice
 * - Without BOT_TOKEN: sim mode with showPopup + activate API
 */
export const requestStarsPayment = async (profile: UserProfile, planId: PremiumPlanId = 'premium_week'): Promise<boolean> => {
  const userId = profile.id;
  if (!userId) {
    console.warn('[TelegramService] No user id');
    return false;
  }

  const tg = (window as any).Telegram?.WebApp;
  const plan = PREMIUM_PLANS[planId] || PREMIUM_PLANS.premium_week;
  const periodRu = plan.days >= 365 ? 'год' : plan.days >= 90 ? '3 месяца' : plan.days >= 30 ? 'месяц' : `${plan.days} дней`;
  const periodEn = plan.days >= 365 ? '1 year' : plan.days >= 90 ? '3 months' : plan.days >= 30 ? '1 month' : `${plan.days} days`;
  const TITLE_RU = `Lumia Premium · ${periodRu}`;
  const DESC_RU = `Полный доступ на ${periodRu} за ${plan.stars} Stars`;
  const TITLE_EN = `Lumia Premium · ${periodEn}`;
  const DESC_EN = `Full access for ${periodEn} for ${plan.stars} Stars`;

  try {
    const res = await fetch(`${API_BASE}/api/telegram/create-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() },
      body: JSON.stringify({ userId, type: planId }),
    });
    const data = await res.json();

    if (data.invoiceUrl && tg?.openInvoice) {
      return new Promise((resolve) => {
        tg.openInvoice(data.invoiceUrl, (status: string) => {
          if (status === 'paid') {
            resolve(true);
          } else {
            resolve(false);
          }
        });
      });
    }

    if (data.simMode) {
      return simPaymentFlow(tg, profile, TITLE_RU, DESC_RU, TITLE_EN, DESC_EN, userId, planId);
    }

    console.warn('[TelegramService] No invoice URL and not sim mode');
    return false;
  } catch (err: any) {
    console.error('[TelegramService] Payment error:', err?.message);
    return false;
  }
};

async function simPaymentFlow(
  tg: any,
  profile: UserProfile,
  titleRu: string,
  descRu: string,
  titleEn: string,
  descEn: string,
  userId: string,
  planId: PremiumPlanId
): Promise<boolean> {
  const stars = (PREMIUM_PLANS[planId] || PREMIUM_PLANS.premium_week).stars;
  if (!tg) {
    return new Promise((resolve) => {
      const ok = window.confirm(`Simulate Payment: ${descEn}?`);
      if (ok) {
        activateSim(userId, { simMode: true, type: planId }).then(resolve);
      } else {
        resolve(false);
      }
    });
  }

  const hasPopup = tg.isVersionAtLeast ? tg.isVersionAtLeast('6.2') : false;
  if (!hasPopup) {
    return new Promise((resolve) => {
      const ok = window.confirm(profile.language === 'ru' ? descRu : descEn);
      if (ok) {
        activateSim(userId, { simMode: true, type: planId }).then(resolve);
      } else {
        resolve(false);
      }
    });
  }

  return new Promise((resolve) => {
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
            .then((ok) => {
              if (tg.MainButton) tg.MainButton.hideProgress();
              resolve(ok);
            })
            .catch(() => {
              if (tg.MainButton) tg.MainButton.hideProgress();
              resolve(false);
            });
        } else {
          resolve(false);
        }
      }
    );
  });
}

async function activateSim(userId: string, payload: Record<string, any>): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/subscriptions/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() },
    body: JSON.stringify({ userId, ...payload }),
  });
  const data = await res.json();
  return data.success === true;
}
