import { apiFetch } from './apiClient';
import { getTelegramInitDataHeaders } from './sessionService';
import type { ChartAvatarChoice } from '../lib/chartAvatar';

type Snapshot = { avatars: Record<string, ChartAvatarChoice>; telegramUrl: string | null };
const empty: Snapshot = { avatars: {}, telegramUrl: null };
const stores = new Map<string, ReturnType<typeof createStore>>();
function createStore(owner: string, preview: boolean) {
  let snapshot = empty, pending: Promise<void> | null = null, loaded = false;
  const listeners = new Set<() => void>();
  const emit = (next: Snapshot) => { snapshot = next; listeners.forEach(listener => listener()); };
  return {
    getSnapshot: () => snapshot, getServerSnapshot: () => empty,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    load() {
      if (loaded) return Promise.resolve();
      if (pending) return pending;
      pending = (async () => {
        if (preview) { const saved = localStorage.getItem(`nebo-preview-avatars:${owner}`); if (saved) emit(JSON.parse(saved)); loaded = true; return; }
        if (!owner) return;
        const response = await apiFetch('/api/users/chart-avatars', { headers: getTelegramInitDataHeaders() });
        if (!response.ok) throw Error('Не удалось загрузить аватары.');
        emit(await response.json()); loaded = true;
      })().finally(() => { pending = null; });
      return pending;
    },
    async save(subjectKey: string, avatar: ChartAvatarChoice) {
      let accepted = avatar;
      if (!preview) {
        const response = await apiFetch('/api/users/chart-avatars', { method: 'PATCH', headers: { ...getTelegramInitDataHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ subjectKey, avatar }) });
        if (!response.ok) throw Error('Не получилось сохранить аватар. Попробуй ещё раз.');
        accepted = (await response.json()).avatar;
      }
      const next = { ...snapshot, avatars: { ...snapshot.avatars, [subjectKey]: accepted } };
      if (preview) localStorage.setItem(`nebo-preview-avatars:${owner}`, JSON.stringify(next));
      emit(next);
    },
  };
}
export function getChartAvatarStore(owner: string, preview: boolean) {
  const key = `${preview ? 'preview' : 'account'}:${owner}`;
  if (!stores.has(key)) stores.set(key, createStore(owner, preview));
  return stores.get(key)!;
}
