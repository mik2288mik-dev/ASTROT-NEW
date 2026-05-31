import { UserProfile } from '../types';
import { PREMIUM_WEEK_DAYS, PREMIUM_WEEK_STARS } from '../lib/premiumPricing';

const API_BASE = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Request Premium payment via Telegram Stars.
 * - With BOT_TOKEN: creates real invoice, opens via openInvoice
 * - Without BOT_TOKEN: sim mode with showPopup + activate API
 */
export const requestStarsPayment = async (profile: UserProfile): Promise<boolean> => {
  const userId = profile.id;
  if (!userId) {
    console.warn('[TelegramService] No user id');
    return false;
  }

  const tg = (window as any).Telegram?.WebApp;
  const TITLE_RU = 'Премиум на Неделю';
  const DESC_RU = `Полный доступ на ${PREMIUM_WEEK_DAYS} дней за ${PREMIUM_WEEK_STARS} Stars`;
  const TITLE_EN = 'Weekly Premium';
  const DESC_EN = `Full access for ${PREMIUM_WEEK_DAYS} days for ${PREMIUM_WEEK_STARS} Stars`;

  try {
    const res = await fetch(`${API_BASE}/api/telegram/create-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, type: 'premium_week' }),
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
      return simPaymentFlow(tg, profile, TITLE_RU, DESC_RU, TITLE_EN, DESC_EN, userId);
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
  userId: string
): Promise<boolean> {
  if (!tg) {
    return new Promise((resolve) => {
      const ok = window.confirm(`Simulate Payment: ${descEn}?`);
      if (ok) {
        activateSim(userId, { simMode: true, type: 'premium_week' }).then(resolve);
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
        activateSim(userId, { simMode: true, type: 'premium_week' }).then(resolve);
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
          { id: 'pay', type: 'default', text: `Pay ${PREMIUM_WEEK_STARS} stars` },
          { id: 'cancel', type: 'destructive', text: 'Cancel' },
        ],
      },
      (buttonId: string) => {
        if (buttonId === 'pay') {
          if (tg.MainButton) tg.MainButton.showProgress();
          activateSim(userId, { simMode: true, type: 'premium_week' })
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, ...payload }),
  });
  const data = await res.json();
  return data.success === true;
}
