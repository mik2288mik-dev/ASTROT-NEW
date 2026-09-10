import { getTelegramCssVars, appDebugLog } from './appDebug';

/**
 * Telegram Mini App (Bot API 8+): device insets vs content insets.
 * contentSafeAreaInset — зона без пересечения с UI Telegram (крестик, заголовок чата).
 * @see https://core.telegram.org/bots/webapps
 */

type WebAppInsets = {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
};

type TelegramWebAppLike = {
  contentSafeAreaInset?: WebAppInsets;
  safeAreaInset?: WebAppInsets;
  viewportHeight?: number;
  viewportStableHeight?: number;
  onEvent?: (event: string, handler: () => void) => void;
  offEvent?: (event: string, handler: () => void) => void;
};

function applyInsetVars(
  root: HTMLElement,
  prefix: 'tg-content-safe-area-inset' | 'tg-safe-area-inset',
  inset: WebAppInsets | undefined
): void {
  if (!inset) return;
  const keys = ['top', 'bottom', 'left', 'right'] as const;
  for (const k of keys) {
    const v = inset[k];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
      root.style.setProperty(`--${prefix}-${k}`, `${v}px`);
    }
  }
}

/** Пишет CSS-переменные на :root (дополняет то, что клиент Telegram уже может выставить). */
export function applyTelegramSafeAreaCssVars(): void {
  if (typeof document === 'undefined') return;
  const wa = (window as any).Telegram?.WebApp as TelegramWebAppLike | undefined;
  const root = document.documentElement;

  if (!wa) {
    root.style.setProperty('--tg-viewport-height', '100dvh');
    root.style.setProperty('--tg-viewport-stable-height', '100dvh');
    appDebugLog('viewport_change', {
      source: 'fallback_no_telegram',
      cssVars: getTelegramCssVars(),
    });
    return;
  }

  applyInsetVars(root, 'tg-content-safe-area-inset', wa.contentSafeAreaInset);
  applyInsetVars(root, 'tg-safe-area-inset', wa.safeAreaInset);

  if (typeof wa.viewportHeight === 'number' && Number.isFinite(wa.viewportHeight) && wa.viewportHeight > 0) {
    root.style.setProperty('--tg-viewport-height', `${wa.viewportHeight}px`);
  }

  if (typeof wa.viewportStableHeight === 'number' && Number.isFinite(wa.viewportStableHeight) && wa.viewportStableHeight > 0) {
    root.style.setProperty('--tg-viewport-stable-height', `${wa.viewportStableHeight}px`);
  } else if (typeof wa.viewportHeight === 'number' && Number.isFinite(wa.viewportHeight) && wa.viewportHeight > 0) {
    root.style.setProperty('--tg-viewport-stable-height', `${wa.viewportHeight}px`);
  }

  appDebugLog('viewport_change', {
    source: 'telegram_webapp',
    viewportHeight: wa.viewportHeight,
    viewportStableHeight: wa.viewportStableHeight,
    safeAreaInset: wa.safeAreaInset,
    contentSafeAreaInset: wa.contentSafeAreaInset,
    cssVars: getTelegramCssVars(),
  });
}

export function subscribeTelegramContentSafeAreaChanges(handler: () => void): () => void {
  const wa = (typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null) as TelegramWebAppLike | undefined;
  if (!wa?.onEvent || !wa?.offEvent) {
    return () => {};
  }
  wa.onEvent('viewportChanged', handler);
  wa.onEvent('contentSafeAreaChanged', handler);
  wa.onEvent('safeAreaChanged', handler);
  return () => {
    wa.offEvent?.('viewportChanged', handler);
    wa.offEvent?.('contentSafeAreaChanged', handler);
    wa.offEvent?.('safeAreaChanged', handler);
  };
}
