import { isNativeAppRuntime } from './nativeRuntime';

/**
 * The admin lives on the website of the live server, never inside the app:
 * the app only opens it in the browser, where the owner signs in with the
 * same account.
 */
export function adminUrl(): string {
  const configured = String(process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
  const base = /^https:\/\//.test(configured) ? configured : window.location.origin;
  return `${base}/admin`;
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
