import React, { useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import Component from '../../lib/canvasApp/canvasLogic';
import { CANVAS_CSS, CANVAS_FONTS } from '../../lib/canvasApp/canvasStyles';
import { buildCanvasRealData, type CanvasRealData } from '../../lib/canvasApp/realData';
import { readLocalNatalChartCache } from '../../lib/localNatalChartCache';
import { getChartData, getProfile } from '../../services/storageService';

const CanvasRoot = Component as unknown as React.ComponentType<Record<string, unknown>>;

const DESIGN_WIDTH = 390;
const MAX_SCALE = 1.3;

/** The design is drawn at 390px: every phone gets it scaled to its width, the height follows the screen. */
function fitToScreen(mount: HTMLElement): void {
  const scale = Math.min(window.innerWidth / DESIGN_WIDTH, MAX_SCALE);
  mount.style.setProperty('zoom', String(scale));
  mount.style.setProperty('--nb-h', `${window.innerHeight / scale}px`);
}

async function loadRealData(): Promise<CanvasRealData | null> {
  try {
    const profile = await getProfile({ maxAttempts: 2 });
    if (!profile) return null;
    const chart = profile.isSetup
      ? readLocalNatalChartCache(profile)?.chartData ?? await getChartData().catch(() => null)
      : null;
    return { ...buildCanvasRealData(profile, chart), isAdmin: Boolean(profile.isAdmin) } as CanvasRealData;
  } catch {
    return null;
  }
}

/**
 * The canvas as the app. It lives in a shadow root, so the old global CSS of the app
 * cannot touch it and it renders exactly as on the canvas.
 * Until every screen is wired to real data it opens for admins only.
 */
export default function CanvasApp() {
  const host = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const element = host.current;
    if (!element) return undefined;
    let root: Root | null = null;
    let cancelled = false;
    const links = CANVAS_FONTS.map((href) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
      return link;
    });
    const shadow = element.shadowRoot ?? element.attachShadow({ mode: 'open' });
    shadow.innerHTML = '';
    const style = document.createElement('style');
    style.textContent = `:host{all:initial;display:flex;justify-content:center;position:fixed;inset:0;overflow:hidden;background:#fff;font-family:Onest,'Segoe UI',sans-serif;}\n${CANVAS_CSS}`;
    shadow.appendChild(style);
    const mount = document.createElement('div');
    shadow.appendChild(mount);
    fitToScreen(mount);
    const onResize = () => fitToScreen(mount);
    window.addEventListener('resize', onResize);

    const params = new URLSearchParams(window.location.search);
    void loadRealData().then((real) => {
      if (cancelled) return;
      const isDev = process.env.NODE_ENV !== 'production';
      if (!isDev && !(real as (CanvasRealData & { isAdmin?: boolean }) | null)?.isAdmin) {
        window.location.replace('/');
        return;
      }
      root = createRoot(mount);
      root.render(
        <CanvasRoot
          start={params.get('start') ?? (real ? 'today' : undefined)}
          account={params.get('account') ?? real?.account}
          real={real}
        />,
      );
    });
    return () => {
      cancelled = true;
      window.removeEventListener('resize', onResize);
      window.setTimeout(() => root?.unmount(), 0);
      links.forEach((link) => link.remove());
    };
  }, []);
  return <div ref={host} />;
}
