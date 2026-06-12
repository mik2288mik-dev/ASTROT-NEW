/**
 * Client-side sharing via Telegram's native share sheet (no backend, no image).
 * The server-only card renderer (`services/notificationCardRenderer`, uses `sharp`)
 * is intentionally not used here.
 */

/** Public Mini App link for sharing — client-safe NEXT_PUBLIC_* only. */
function resolveAppLink(): string {
  const bot = (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || '').trim().replace(/^@/, '');
  if (bot) return `https://t.me/${bot}`;
  return (
    process.env.NEXT_PUBLIC_TELEGRAM_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://t.me'
  ).trim();
}

function getWebApp(): { openTelegramLink?: (url: string) => void } | null {
  try {
    return (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } } })
      ?.Telegram?.WebApp ?? null;
  } catch {
    return null;
  }
}

/** Open Telegram's share sheet with the given text + app link. */
export function shareText(text: string, url?: string): void {
  const link = url || resolveAppLink();
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
  const wa = getWebApp();
  try {
    if (wa?.openTelegramLink) {
      wa.openTelegramLink(shareUrl);
      return;
    }
  } catch {
    /* fall through to web fallbacks */
  }
  try {
    const nav = navigator as Navigator & { share?: (data: { text?: string; url?: string }) => Promise<void> };
    if (typeof nav.share === 'function') {
      void nav.share({ text, url: link });
      return;
    }
  } catch {
    /* fall through */
  }
  try {
    window.open(shareUrl, '_blank');
  } catch {
    /* no-op */
  }
}

/** Build a shareable caption for today's sign forecast. */
export function buildDailyShareText(opts: {
  signLabel: string;
  summary: string;
  language: 'ru' | 'en';
}): string {
  const { signLabel, summary, language } = opts;
  const head = language === 'ru'
    ? `✨ Мой гороскоп на сегодня${signLabel ? ` — ${signLabel}` : ''}`
    : `✨ My horoscope today${signLabel ? ` — ${signLabel}` : ''}`;
  const tail = language === 'ru' ? 'Узнай свой в Lumia 👇' : 'Get yours in Lumia 👇';
  const body = String(summary || '').trim();
  return [head, body, tail].filter(Boolean).join('\n\n');
}
