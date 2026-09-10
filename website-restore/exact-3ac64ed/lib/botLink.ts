/**
 * Ссылка на наш бот для шеринга. Имя бота берётся из env
 * NEXT_PUBLIC_TELEGRAM_BOT_USERNAME (инлайнится в сборку, задаётся в Railway).
 * Никаких захардкоженных «левых» ботов.
 */
export function getBotUsername(): string {
  return (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || '').replace(/^@/, '').trim();
}

export function getBotShareUrl(): string {
  const u = getBotUsername();
  // startapp откроет мини-апп сразу при переходе
  return u ? `https://t.me/${u}?startapp=share` : '';
}

/** Открыть нативный диалог «Поделиться» в Telegram с текстом-зазывалкой. */
export function shareToTelegram(text: string): void {
  try {
    const tg = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } } }).Telegram?.WebApp;
    const url = getBotShareUrl();
    const base = 'https://t.me/share/url';
    const query = url
      ? `url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
      : `url=${encodeURIComponent(text)}`;
    tg?.openTelegramLink?.(`${base}?${query}`);
  } catch {
    /* optional */
  }
}
