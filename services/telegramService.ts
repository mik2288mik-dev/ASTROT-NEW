import { UserProfile } from '../types';

const API_BASE = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_API_URL || '';

export type StarsOneOffPaymentType = 'ask_lumia_one_off' | 'forecast_full_day';

export type StarsOneOffPaymentInput = {
  userId: string;
  type: StarsOneOffPaymentType;
  chartId?: number;
  cacheKey?: string;
  sectionKey?: string;
  date?: string;
};

export type StarsOneOffPaymentResult = {
  status: 'paid' | 'cancelled' | 'failed';
  paymentNonce: string | null;
  starsAmount: number;
};

/**
 * @deprecated Deprecated one-off Stars unlock helper. Current UI uses Premium-only gating.
 * Kept for legacy server tests and webhook compatibility.
 */
export async function requestStarsOneOffPayment(
  input: StarsOneOffPaymentInput
): Promise<StarsOneOffPaymentResult> {
  const userId = String(input.userId || '').trim();
  if (!userId) {
    return { status: 'failed', paymentNonce: null, starsAmount: 0 };
  }

  const tg = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;

  try {
    const res = await fetch(`${API_BASE}/api/telegram/create-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        type: input.type,
        chartId: input.chartId,
        cacheKey: input.cacheKey,
        sectionKey: input.sectionKey,
        date: input.date,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      console.warn('[TelegramService] create-invoice failed', data?.code || data?.error);
      return { status: 'failed', paymentNonce: null, starsAmount: 0 };
    }

    const paymentNonce = data.paymentNonce != null ? String(data.paymentNonce) : null;
    const starsAmount = Number(data.starsAmount) || 0;
    const invoiceLink = data.invoiceLink || data.invoiceUrl;

    if (invoiceLink && tg?.openInvoice) {
      const invoiceStatus = await new Promise<string>((resolve) => {
        tg.openInvoice(invoiceLink, (status: string) => resolve(status || 'failed'));
      });

      if (invoiceStatus === 'paid') {
        return { status: 'paid', paymentNonce, starsAmount };
      }
      if (invoiceStatus === 'cancelled') {
        return { status: 'cancelled', paymentNonce, starsAmount };
      }
      return { status: 'failed', paymentNonce, starsAmount };
    }

    if (data.simMode && paymentNonce) {
      const simOk = await simOneOffPaymentFlow(tg, input, paymentNonce, starsAmount);
      return {
        status: simOk ? 'paid' : 'cancelled',
        paymentNonce,
        starsAmount,
      };
    }

    if (!tg?.openInvoice && !data.simMode) {
      console.warn('[TelegramService] Telegram WebApp openInvoice unavailable');
      return { status: 'failed', paymentNonce, starsAmount };
    }

    return { status: 'failed', paymentNonce, starsAmount };
  } catch (err: any) {
    console.error('[TelegramService] One-off payment error:', err?.message);
    return { status: 'failed', paymentNonce: null, starsAmount: 0 };
  }
}

async function simOneOffPaymentFlow(
  tg: any,
  input: StarsOneOffPaymentInput,
  paymentNonce: string,
  starsAmount: number
): Promise<boolean> {
  const userId = String(input.userId || '').trim();
  const productLabel = input.type === 'forecast_full_day' ? 'Full day forecast' : 'Ask Lumia one-off';
  const message = `Simulate ${productLabel} payment for ${starsAmount} Stars?`;

  if (!tg) {
    const ok = typeof window !== 'undefined' && window.confirm(message);
    if (!ok) return false;
    return activateSimOneOff(input, paymentNonce);
  }

  const hasPopup = tg.isVersionAtLeast ? tg.isVersionAtLeast('6.2') : false;
  if (!hasPopup) {
    const ok = typeof window !== 'undefined' && window.confirm(message);
    if (!ok) return false;
    return activateSimOneOff(input, paymentNonce);
  }

  return new Promise((resolve) => {
    tg.showPopup(
      {
        title: productLabel,
        message,
        buttons: [
          { id: 'pay', type: 'default', text: `Pay ${starsAmount} stars` },
          { id: 'cancel', type: 'destructive', text: 'Cancel' },
        ],
      },
      (buttonId: string) => {
        if (buttonId === 'pay') {
          if (tg.MainButton) tg.MainButton.showProgress();
          activateSimOneOff(input, paymentNonce)
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

async function activateSimOneOff(input: StarsOneOffPaymentInput, paymentNonce: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/subscriptions/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: input.userId,
      simMode: true,
      type: input.type,
      paymentNonce,
      chartId: input.chartId,
      date: input.date,
      cacheKey: input.cacheKey || input.date,
    }),
  });
  const data = await res.json();
  return data.success === true;
}

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
  const DESC_RU = 'Полный доступ на 7 дней за 250 Stars';
  const TITLE_EN = 'Weekly Premium';
  const DESC_EN = 'Full access for 7 days for 250 Stars';

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
          { id: 'pay', type: 'default', text: 'Pay 250 stars' },
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
