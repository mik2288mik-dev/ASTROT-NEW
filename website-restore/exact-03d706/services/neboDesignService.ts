import { apiFetch } from './apiClient';
import { getTelegramInitDataHeaders } from './sessionService';
import { DesignPreferenceStore, EMPTY_DESIGN_SNAPSHOT } from '../lib/neboDesign/preferenceStore';
let current: { userId: string; store: DesignPreferenceStore } | null = null;
const empty = new DesignPreferenceStore(async () => ({ status: 403 }));
export function getNeboDesignStore(userId: string): DesignPreferenceStore {
  if (typeof window === 'undefined' || !userId) return empty;
  if (current?.userId === userId) return current.store;
  current?.store.dispose();
  const key = `nebo.design.escape.v1:${userId}`;
  let escaped = false;
  try { escaped = window.sessionStorage.getItem(key) === '1'; } catch { /* Storage is optional. */ }
  const store = new DesignPreferenceStore(async (method, body) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await apiFetch('/api/users/design-preference', {
        method, signal: controller.signal, cache: 'no-store',
        headers: { ...getTelegramInitDataHeaders(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, data: await response.json().catch(() => ({})) };
    } finally { clearTimeout(timeout); }
  }, value => {
    try { if (value) window.sessionStorage.setItem(key, '1'); else window.sessionStorage.removeItem(key); } catch { /* In-memory escape still works. */ }
  }, escaped);
  current = { userId, store };
  return store;
}
export function clearNeboDesignAccount(): void { current?.store.dispose(); current = null; }
export function getCurrentNeboDesignStore(): DesignPreferenceStore { return current?.store || empty; }
export const emptyDesignSnapshot = () => EMPTY_DESIGN_SNAPSHOT;
