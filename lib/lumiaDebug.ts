type LumiaDebugEvent = {
  seq: number;
  ts: number;
  t: number;
  type: string;
  payload?: Record<string, unknown>;
};

type RectSnapshot = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
} | null;

type TelegramWebAppDebug = {
  platform?: string;
  version?: string;
  viewportHeight?: number;
  viewportStableHeight?: number;
  safeAreaInset?: unknown;
  contentSafeAreaInset?: unknown;
};

const MAX_EVENTS = 200;
const startedAt = Date.now();
const events: LumiaDebugEvent[] = [];
let sequence = 0;

declare global {
  interface Window {
    __LUMIA_DEBUG__?: {
      enabled: boolean;
      log: typeof lumiaDebugLog;
      dump: () => string;
      copy: () => Promise<string>;
      clear: () => void;
      snapshot: (source?: string, extra?: Record<string, unknown>) => void;
    };
  }
}

function nowMs() {
  return Math.round(performance.now());
}

export function isLumiaDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('lumiaDebug') === '1';
  } catch {
    return false;
  }
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function rectFor(selector: string): RectSnapshot {
  if (typeof document === 'undefined') return null;
  const node = document.querySelector(selector);
  if (!node) return null;
  const rect = node.getBoundingClientRect();
  return {
    top: round(rect.top),
    right: round(rect.right),
    bottom: round(rect.bottom),
    left: round(rect.left),
    width: round(rect.width),
    height: round(rect.height),
  };
}

function cssVar(name: string): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function getTelegramDebug(): TelegramWebAppDebug | null {
  if (typeof window === 'undefined') return null;
  const tg = (window as any).Telegram?.WebApp;
  if (!tg) return null;
  return {
    platform: tg.platform,
    version: tg.version,
    viewportHeight: tg.viewportHeight,
    viewportStableHeight: tg.viewportStableHeight,
    safeAreaInset: tg.safeAreaInset,
    contentSafeAreaInset: tg.contentSafeAreaInset,
  };
}

export function getLumiaDebugDump(): string {
  return JSON.stringify(
    {
      meta: {
        enabled: isLumiaDebugEnabled(),
        startedAt,
        dumpedAt: Date.now(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        location:
          typeof window !== 'undefined'
            ? {
                pathname: window.location.pathname,
                search: window.location.search,
              }
            : null,
      },
      events,
    },
    null,
    2
  );
}

export async function copyLumiaDebugDump(): Promise<string> {
  const dump = getLumiaDebugDump();
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(dump);
  }
  return dump;
}

export function clearLumiaDebugLog(): void {
  events.length = 0;
  sequence = 0;
}

export function lumiaDebugLog(type: string, payload?: Record<string, unknown>): void {
  if (!isLumiaDebugEnabled()) return;

  const event: LumiaDebugEvent = {
    seq: ++sequence,
    ts: Date.now(),
    t: nowMs(),
    type,
    payload,
  };

  events.push(event);
  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS);
  }

  try {
    console.log('[LUMIA_DEBUG]', type, payload || {});
  } catch {
    /* console is optional */
  }
}

export function captureLumiaHomeLayout(source = 'manual', extra?: Record<string, unknown>): void {
  if (!isLumiaDebugEnabled()) return;

  const header = rectFor('.lumia-home-top-cluster');
  const headerSpacer = rectFor('.lumia-home-top-spacer');
  const appHeader = rectFor('.lumia-app-header');
  const appHeaderSpacer = rectFor('.lumia-app-header-spacer');
  const compactRow = rectFor('.lumia-home-compact-row');
  const compactStories = rectFor('.lumia-home-compact-story-cluster');
  const compactLogo = rectFor('.lumia-home-compact-logo');
  const expandedStories = rectFor('.lumia-home-stories-strip');
  const logo = rectFor('.lumia-home-brand');
  const wordmark = rectFor('.lumia-home-wordmark');
  const hero = rectFor('.lumia-home-hero-card');
  const bottomNav = rectFor('.lumia-home-bottom-nav-shell');
  const scroll = rectFor('.lumia-main-scroll');
  const lastContent = rectFor('.lumia-home-scroll-content > :last-child');
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
  const telegramTopInset = Number.parseFloat(cssVar('--tg-content-safe-area-inset-top') || cssVar('--tg-safe-area-inset-top') || '0') || 0;

  lumiaDebugLog('layout_snapshot', {
    source,
    viewport: {
      width: viewportWidth,
      height: viewportHeight,
      visualViewportHeight: typeof window !== 'undefined' ? window.visualViewport?.height ?? null : null,
    },
    cssVars: getTelegramCssVars(),
    telegram: getTelegramDebug(),
    rects: {
      scroll,
      header,
      headerSpacer,
      appHeader,
      appHeaderSpacer,
      logo,
      wordmark,
      compactRow,
      compactStories,
      compactLogo,
      expandedStories,
      hero,
      lastContent,
      bottomNav,
    },
    measurements: {
      compactGap:
        compactStories && compactLogo
          ? round(compactLogo.left - compactStories.right)
          : null,
      compactCenterDeltaY:
        compactStories && compactLogo
          ? round((compactStories.top + compactStories.height / 2) - (compactLogo.top + compactLogo.height / 2))
          : null,
      compactRailHeight: compactRow?.height ?? null,
      homeHeaderStableHeight: header?.height ?? null,
      homeSpacerHeight: headerSpacer?.height ?? null,
      appHeaderStableHeight: appHeader?.height ?? null,
      appSpacerHeight: appHeaderSpacer?.height ?? null,
    },
    flags: {
      overlapsTelegramTop:
        !!header && header.top < telegramTopInset - 1,
      storiesClipped:
        !!scroll &&
        !!expandedStories &&
        (expandedStories.bottom > scroll.bottom + 1 || expandedStories.top < scroll.top - 1),
      compactStoriesClipped:
        !!header &&
        !!compactStories &&
        (compactStories.bottom > header.bottom + 1 || compactStories.top < header.top - 1),
      compactRowClipped:
        !!header &&
        !!compactRow &&
        (compactRow.bottom > header.bottom + 1 || compactRow.top < header.top - 1),
      bottomNavOverlapsHero:
        !!bottomNav && !!hero && bottomNav.top < hero.bottom,
      bottomNavOverlapsVisibleLastContent:
        !!bottomNav &&
        !!lastContent &&
        lastContent.bottom <= viewportHeight &&
        bottomNav.top < lastContent.bottom,
      bottomNavOffscreen:
        !!bottomNav && bottomNav.bottom > viewportHeight + 1,
    },
    ...extra,
  });
}

export function getTelegramCssVars(): Record<string, string> {
  return {
    '--tg-viewport-height': cssVar('--tg-viewport-height'),
    '--tg-viewport-stable-height': cssVar('--tg-viewport-stable-height'),
    '--tg-safe-area-inset-top': cssVar('--tg-safe-area-inset-top'),
    '--tg-safe-area-inset-bottom': cssVar('--tg-safe-area-inset-bottom'),
    '--tg-content-safe-area-inset-top': cssVar('--tg-content-safe-area-inset-top'),
    '--tg-content-safe-area-inset-bottom': cssVar('--tg-content-safe-area-inset-bottom'),
  };
}

export function installLumiaDebugGlobal(): void {
  if (typeof window === 'undefined') return;
  window.__LUMIA_DEBUG__ = {
    enabled: isLumiaDebugEnabled(),
    log: lumiaDebugLog,
    dump: getLumiaDebugDump,
    copy: copyLumiaDebugDump,
    clear: clearLumiaDebugLog,
    snapshot: captureLumiaHomeLayout,
  };
}
