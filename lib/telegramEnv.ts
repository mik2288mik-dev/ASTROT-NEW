/**
 * Telegram Bot API token resolver.
 *
 * Railway/hosting dashboards often rename variables during imports or template
 * changes. Keep BOT_TOKEN as canonical, but accept common Telegram token aliases
 * so production notifications do not silently fall back to dry-run after an env
 * rename. Values are read at call time (not module import time) because tests and
 * serverless runtimes may mutate process.env after modules are loaded.
 */
const TELEGRAM_BOT_TOKEN_ENV_KEYS = [
  'BOT_TOKEN',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_BOT_API_TOKEN',
  'TELEGRAM_TOKEN',
] as const;

export function getTelegramBotToken(): string {
  for (const key of TELEGRAM_BOT_TOKEN_ENV_KEYS) {
    const value = String(process.env[key] || '').trim();
    if (value) return value;
  }
  return '';
}

export function hasTelegramBotToken(): boolean {
  return !!getTelegramBotToken();
}

export function getTelegramBotTokenEnvKey(): string | null {
  for (const key of TELEGRAM_BOT_TOKEN_ENV_KEYS) {
    if (String(process.env[key] || '').trim()) return key;
  }
  return null;
}

export { TELEGRAM_BOT_TOKEN_ENV_KEYS };
