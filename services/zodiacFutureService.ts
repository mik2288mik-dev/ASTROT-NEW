import { apiFetch } from './apiClient';
import { getTelegramInitDataHeaders } from './sessionService';
import { isSignFutureReading, type SignFutureSelection, type SignFutureReading, type SignFutureGrant } from '../lib/horoscope/signFutureContract';

export type ZodiacFutureClientError = Error & { status?: number; code?: string; freeChoice?: SignFutureGrant };
export async function loadZodiacFuture(selection: SignFutureSelection, signal?: AbortSignal): Promise<SignFutureReading> {
  const deadline = Date.now() + 115000;
  while (!signal?.aborted) {
    const response = await apiFetch('/api/content/horoscope/sign-future', { method: 'POST', signal, headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() }, body: JSON.stringify(selection), cache: 'no-store' }, Math.min(95000, Math.max(1000, deadline - Date.now())));
    const value = await response.json();
    if (!response.ok) throw Object.assign(new Error('Не удалось получить прогноз'), { status: response.status, code: value?.code, freeChoice: value?.freeChoice });
    if (!isSignFutureReading(value) || value.sign !== selection.sign || value.date !== selection.date || value.period !== selection.period || value.topic !== selection.topic || value.endDate !== selection.endDate || value.language !== selection.language) throw new Error('Invalid Zodiac forecast response');
    if (value.status === 'ready') return value;
    if (Date.now() + 2500 >= deadline) throw new Error('Forecast is still being prepared');
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
      const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, 2500);
      if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
    });
  }
  throw new DOMException('Aborted', 'AbortError');
}
