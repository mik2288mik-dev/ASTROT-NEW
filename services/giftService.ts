import { apiFetch } from './apiClient';
import { getTelegramInitDataHeaders } from './sessionService';

export type GiftReason = 'streak' | 'anniversary';
export type GiftStatus = {
  streak: number;
  daysToGift: number;
  weekGift: { periodKey: string; reason: GiftReason } | null;
  claimable: GiftReason | null;
  premium: boolean;
};

async function call<T>(method: 'GET' | 'POST', body?: unknown): Promise<T> {
  const response = await apiFetch('/api/forecast/gift', {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  }, 15_000);
  if (!response.ok) throw new Error(`GIFT_${response.status}`);
  return response.json() as Promise<T>;
}

export function loadGiftStatus(): Promise<GiftStatus> {
  return call<GiftStatus>('GET');
}

export function claimWeekGift(reason: GiftReason): Promise<{ ok: boolean; weekGift: { periodKey: string; reason: GiftReason } }> {
  return call('POST', { reason });
}
