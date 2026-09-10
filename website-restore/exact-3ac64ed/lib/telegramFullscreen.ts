type TelegramWebAppLike = {
  ready?: () => void;
  expand?: () => void;
  requestFullscreen?: () => void;
  disableVerticalSwipes?: () => void;
  isFullscreen?: boolean;
  onEvent?: (event: string, handler: (...args: any[]) => void) => void;
  offEvent?: (event: string, handler: (...args: any[]) => void) => void;
};

const FULLSCREEN_RETRY_DELAYS = [0, 250, 900, 1800];

function getTelegramWebApp(): TelegramWebAppLike | null {
  if (typeof window === 'undefined') return null;
  return (window as any).Telegram?.WebApp || null;
}

export function ensureTelegramFullscreen(): boolean {
  const tg = getTelegramWebApp();
  if (!tg) return false;

  try {
    tg.ready?.();
    tg.expand?.();
    tg.disableVerticalSwipes?.();

    if (typeof tg.requestFullscreen === 'function' && !tg.isFullscreen) {
      tg.requestFullscreen();
    }

    return true;
  } catch (error: any) {
    console.warn('[TelegramFullscreen] Failed to request fullscreen:', error?.message || error);
    return false;
  }
}

export function installTelegramFullscreenGuard(): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  let disposed = false;
  const timeoutIds: number[] = [];
  let removeTelegramListeners: (() => void) | null = null;

  const run = () => {
    if (disposed) return;
    const didRun = ensureTelegramFullscreen();

    if (!didRun) return;

    if (!removeTelegramListeners) {
      const tg = getTelegramWebApp();
      if (!tg?.onEvent || !tg?.offEvent) return;

      const handleActivated = () => ensureTelegramFullscreen();
      const handleFullscreenChanged = () => {
        if (!getTelegramWebApp()?.isFullscreen) {
          window.setTimeout(() => {
            ensureTelegramFullscreen();
          }, 80);
        }
      };
      const handleFullscreenFailed = () => {
        window.setTimeout(() => {
          ensureTelegramFullscreen();
        }, 180);
      };

      tg.onEvent('activated', handleActivated);
      tg.onEvent('fullscreenChanged', handleFullscreenChanged);
      tg.onEvent('fullscreenFailed', handleFullscreenFailed);

      removeTelegramListeners = () => {
        tg.offEvent?.('activated', handleActivated);
        tg.offEvent?.('fullscreenChanged', handleFullscreenChanged);
        tg.offEvent?.('fullscreenFailed', handleFullscreenFailed);
      };
    }
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      run();
    }
  };

  const handleFocus = () => {
    run();
  };

  FULLSCREEN_RETRY_DELAYS.forEach((delay) => {
    timeoutIds.push(window.setTimeout(run, delay));
  });

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', handleFocus);

  return () => {
    disposed = true;
    timeoutIds.forEach((id) => window.clearTimeout(id));
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleFocus);
    removeTelegramListeners?.();
  };
}
