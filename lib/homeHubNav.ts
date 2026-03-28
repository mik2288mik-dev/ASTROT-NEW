import type { ViewState } from '../types';

/** Bottom hub bar keys (shown only on dashboard). */
export type HomeHubNavKey = 'home' | 'chart' | 'day' | 'charts';

/**
 * Derive which hub tab should appear selected from the real app view.
 * Non-hub views (settings, wallet, etc.) do not show the bar — value unused.
 */
export function hubNavActiveFromView(view: ViewState): HomeHubNavKey {
  if (view === 'horoscope') return 'day';
  if (view === 'chart') return 'chart';
  if (view === 'charts') return 'charts';
  return 'home';
}
