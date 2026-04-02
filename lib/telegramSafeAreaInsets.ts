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
  if (!wa) return;
  const root = document.documentElement;
  applyInsetVars(root, 'tg-content-safe-area-inset', wa.contentSafeAreaInset);
  applyInsetVars(root, 'tg-safe-area-inset', wa.safeAreaInset);
}

export function subscribeTelegramContentSafeAreaChanges(handler: () => void): () => void {
  const wa = (typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null) as TelegramWebAppLike | undefined;
  if (!wa?.onEvent || !wa?.offEvent) {
    return () => {};
  }
  wa.onEvent('contentSafeAreaChanged', handler);
  wa.onEvent('safeAreaChanged', handler);
  return () => {
    wa.offEvent?.('contentSafeAreaChanged', handler);
    wa.offEvent?.('safeAreaChanged', handler);
  };
}
