/**
 * Light / dark / auto theme from the canvas profile («Тема: Светлая · Тёмная · Авто»).
 * Kept on the device; «Авто» follows Telegram's theme or the phone setting.
 */
import { useCallback, useSyncExternalStore } from 'react';

export type ThemePref = 'light' | 'dark' | 'system';
/** Main button colour from the canvas popup «Цвет кнопок». */
export type CtaStyle = 'night' | 'ink' | 'gold' | 'light';
export const CTA_STYLES: readonly CtaStyle[] = ['night', 'ink', 'gold', 'light'];

export const THEME_STORAGE_KEY = 'nebo.theme';
export const CTA_STORAGE_KEY = 'nebo.cta';
/** Device choices that stay when the account signs out. */
export const DEVICE_PREFERENCE_KEYS = [THEME_STORAGE_KEY, CTA_STORAGE_KEY] as const;
const EVENT = 'nebo-theme-change';
const PAGE = { light: '#FFFFFF', dark: '#1C1D21' } as const;

export function readThemePref(): ThemePref {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'dark' || value === 'system' ? value : 'light';
  } catch {
    return 'light';
  }
}

function systemDark(): boolean {
  const tg = (window as any).Telegram?.WebApp;
  if (tg && typeof tg.colorScheme === 'string' && tg.initData) return tg.colorScheme === 'dark';
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(pref: ThemePref = readThemePref()): 'light' | 'dark' {
  if (pref === 'system') return systemDark() ? 'dark' : 'light';
  return pref;
}

export function applyTheme(pref: ThemePref = readThemePref()) {
  if (typeof document === 'undefined') return;
  const theme = resolveTheme(pref);
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', PAGE[theme]);
  const tg = (window as any).Telegram?.WebApp;
  try {
    tg?.setHeaderColor?.(PAGE[theme]);
    tg?.setBackgroundColor?.(PAGE[theme]);
    tg?.setBottomBarColor?.(PAGE[theme]);
  } catch { /* older Telegram clients */ }
}

export function saveThemePref(pref: ThemePref) {
  try { window.localStorage.setItem(THEME_STORAGE_KEY, pref); } catch { /* storage may be unavailable */ }
  applyTheme(pref);
  window.dispatchEvent(new Event(EVENT));
}

export function readCtaStyle(): CtaStyle {
  try {
    const value = window.localStorage.getItem(CTA_STORAGE_KEY) as CtaStyle | null;
    return value && CTA_STYLES.includes(value) ? value : 'night';
  } catch {
    return 'night';
  }
}

export function saveCtaStyle(style: CtaStyle) {
  try { window.localStorage.setItem(CTA_STORAGE_KEY, style); } catch { /* storage may be unavailable */ }
  document.documentElement.dataset.cta = style;
  window.dispatchEvent(new Event(EVENT));
}

export function useCtaStyle(): [CtaStyle, (style: CtaStyle) => void] {
  const subscribe = useCallback((notify: () => void) => {
    window.addEventListener(EVENT, notify);
    return () => window.removeEventListener(EVENT, notify);
  }, []);
  const style = useSyncExternalStore(subscribe, readCtaStyle, () => 'night' as CtaStyle);
  return [style, saveCtaStyle];
}

/** Keeps «Авто» in step with Telegram and the phone while the app is open. */
export function watchSystemTheme(): () => void {
  const update = () => { if (readThemePref() === 'system') applyTheme('system'); };
  const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  media?.addEventListener?.('change', update);
  const tg = (window as any).Telegram?.WebApp;
  try { tg?.onEvent?.('themeChanged', update); } catch { /* older Telegram clients */ }
  applyTheme();
  return () => {
    media?.removeEventListener?.('change', update);
    try { tg?.offEvent?.('themeChanged', update); } catch { /* older Telegram clients */ }
  };
}

export function useThemePref(): [ThemePref, (pref: ThemePref) => void] {
  const subscribe = useCallback((notify: () => void) => {
    window.addEventListener(EVENT, notify);
    return () => window.removeEventListener(EVENT, notify);
  }, []);
  const pref = useSyncExternalStore(subscribe, readThemePref, () => 'light' as ThemePref);
  return [pref, saveThemePref];
}

/** Inline script for _document: sets the theme before the first paint, so there is no white flash. */
export const THEME_BOOT_SCRIPT = `try{var p=localStorage.getItem('${THEME_STORAGE_KEY}');var d=p==='dark';if(p==='system'){var t=window.Telegram&&window.Telegram.WebApp;d=t&&t.initData&&t.colorScheme?t.colorScheme==='dark':!!(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);}document.documentElement.setAttribute('data-theme',d?'dark':'light');var c=localStorage.getItem('${CTA_STORAGE_KEY}');document.documentElement.setAttribute('data-cta',/^(night|ink|gold|light)$/.test(c||'')?c:'night');}catch(e){}`;
