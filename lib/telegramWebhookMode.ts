type TelegramWebhookEnvironment = Record<string, string | undefined>;

function configuredValue(
  name: string,
  environment: TelegramWebhookEnvironment,
): string {
  const value = String(environment[name] || '').trim();
  if (
    !value
    || /_REQUIRED/i.test(value)
    || /^your[_-]/i.test(value)
    || /^replace-with/i.test(value)
    || value.includes('[УКАЖИТЕ')
  ) return '';
  return value;
}

export function getTelegramBotToken(
  environment: TelegramWebhookEnvironment = process.env,
): string {
  return configuredValue('BOT_TOKEN', environment)
    || configuredValue('TELEGRAM_BOT_TOKEN', environment);
}

export function getTelegramWebhookSecret(
  environment: TelegramWebhookEnvironment = process.env,
): string {
  const secret = configuredValue('WEBHOOK_SECRET_TOKEN', environment);
  return /^[A-Za-z0-9_-]{32,256}$/.test(secret) ? secret : '';
}

export function isTelegramWebhookEnabled(
  environment: TelegramWebhookEnvironment = process.env,
): boolean {
  return configuredValue('TELEGRAM_WEBHOOK_ENABLED', environment) === '1'
    || !!configuredValue('WEBHOOK_BASE_URL', environment);
}
