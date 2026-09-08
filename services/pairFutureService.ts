import { apiFetch } from './apiClient';
import { getTelegramInitDataHeaders } from './sessionService';
import { isPairFutureReading, type PairFutureRequest, type PairFutureReading } from '../lib/synastry/pairFutureContract';

export async function loadPairFuture(selection: PairFutureRequest, signal: AbortSignal): Promise<PairFutureReading> {
  const deadline = Date.now() + 115000;
  while (!signal.aborted) {
    const response = await apiFetch('/api/content/synastry/future', { method: 'POST', signal, cache: 'no-store', headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() }, body: JSON.stringify(selection) }, Math.min(95000, Math.max(1000, deadline - Date.now())));
    const value = await response.json();
    if (!response.ok) throw Object.assign(new Error('Pair forecast unavailable'), { status: response.status, code: value?.code });
    if (!isPairFutureReading(value)) throw new Error('Invalid pair forecast');
    if (value.status === 'ready') return value;
    if (Date.now() + 2500 >= deadline) throw new Error('Forecast is still being prepared');
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 2500);
      if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
    });
  }
  throw new DOMException('Aborted', 'AbortError');
}
