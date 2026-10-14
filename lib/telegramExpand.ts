/**
 * Telegram Desktop turns WebApp.expand() into «make the window as big as the
 * screen» and keeps the old top-left corner, so the mini app opens mostly off
 * screen. Phones need expand() to open the full-height sheet; computers keep
 * the normal centered panel.
 */
export function shouldExpandTelegramApp(platform: unknown): boolean {
  return ['android', 'android_x', 'ios'].includes(String(platform || '').toLowerCase());
}

export function expandTelegramAppOnPhones(tg: { platform?: unknown; expand?: () => void } | null | undefined): void {
  if (tg && shouldExpandTelegramApp(tg.platform)) tg.expand?.();
}
