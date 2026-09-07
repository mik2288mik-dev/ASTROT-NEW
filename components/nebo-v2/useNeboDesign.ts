import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { UserProfile } from '../../types';
import { getNeboDesignStore, getCurrentNeboDesignStore, clearNeboDesignAccount, emptyDesignSnapshot } from '../../services/neboDesignService';
/** Server approval is mandatory; local flags never grant access or Premium. */
export function useNeboDesign(profile: UserProfile | null | undefined) {
  const userId = profile?.id ? String(profile.id) : '';
  const store = useMemo(() => getNeboDesignStore(userId), [userId]);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const change = () => setSystemDark(query.matches); change();
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (!userId) { clearNeboDesignAccount(); return; }
    if (profile?.isAdmin !== true) return;
    void store.hydrate();
  }, [store, userId, profile?.isAdmin]);
  const active = !!userId && profile?.isAdmin === true && state.ready && state.eligible && !state.forceClassic && state.preference.design === 'nebo-v2';
  const resolvedTheme = state.preference.theme === 'system' ? (systemDark ? 'dark' : 'light') : state.preference.theme;
  return { ...state, active, resolvedTheme, store };
}
/** Decorative assets only. This hook is not an authorization API. */
export function useNeboVisualMode(): boolean {
  const store = getCurrentNeboDesignStore();
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, emptyDesignSnapshot);
  return state.ready && state.eligible && !state.forceClassic && state.preference.design === 'nebo-v2';
}
/** Called once by App. Restore Telegram's original swipe policy when leaving the pilot. */
export function useNeboHostGestures(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    type MiniApp = { isVersionAtLeast?: (version: string) => boolean; isVerticalSwipesEnabled?: boolean; disableVerticalSwipes?: () => void; enableVerticalSwipes?: () => void };
    const host = (window as unknown as { Telegram?: { WebApp?: MiniApp } }).Telegram?.WebApp;
    if (!host?.isVersionAtLeast?.('7.7') || !host.disableVerticalSwipes) return;
    const enabled = host.isVerticalSwipesEnabled !== false;
    host.disableVerticalSwipes();
    return () => { if (enabled) host.enableVerticalSwipes?.(); };
  }, [active]);
}
