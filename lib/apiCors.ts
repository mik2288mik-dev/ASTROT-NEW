export const API_CORS_ALLOW_METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
export const API_CORS_ALLOW_HEADERS = 'Content-Type,Authorization,X-Telegram-Init-Data';

export function configuredNativeOrigins(value = process.env.NATIVE_APP_ORIGINS || ''): Set<string> {
  return new Set(
    value
      .split(',')
      .map((origin) => origin.trim().replace(/\/+$/, ''))
      .filter(Boolean)
  );
}

export function isAllowedNativeOrigin(origin: string, value?: string): boolean {
  return configuredNativeOrigins(value).has(origin.trim().replace(/\/+$/, ''));
}
