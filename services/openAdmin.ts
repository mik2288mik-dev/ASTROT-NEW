import { isNativeAppRuntime } from './nativeRuntime';

/**
 * The admin lives on the website of the live server, never inside the app:
 * the app only opens it in the browser, where the owner signs in with the
 * same account.
 */
export const LIVE_ADMIN_ORIGIN = 'https://api.tvoi-goroskop.ru';

export function adminUrl(): string {
  // Always the live server: the Telegram version is served from another host,
  // and its admin would show only that host's people.
  const configured = String(process.env.NEXT_PUBLIC_ADMIN_URL || '').trim().replace(/\/+$/, '');
  return `${/^https:\/\//.test(configured) ? configured : LIVE_ADMIN_ORIGIN}/admin`;
}

export function openAdmin(): void {
  const url = adminUrl();
  const telegram = (window as any).Telegram?.WebApp;
  if (typeof telegram?.openLink === 'function') {
    telegram.openLink(url);
    return;
  }
  if (isNativeAppRuntime()) {
    window.open(url, '_system', 'noopener,noreferrer');
    return;
  }
  window.location.assign(url);
}
