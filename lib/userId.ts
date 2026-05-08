const INVALID_USER_ID_VALUES = new Set(['', 'undefined', 'null', 'anonymous', 'nan']);

export function normalizeUserId(value: unknown): string {
  return String(value ?? '').trim();
}

export function isValidUserId(value: unknown): boolean {
  const id = normalizeUserId(value);
  if (INVALID_USER_ID_VALUES.has(id.toLowerCase())) return false;
  return /^\d{1,20}$/.test(id);
}

export function assertValidUserId(value: unknown): string {
  const id = normalizeUserId(value);
  if (!isValidUserId(id)) {
    const error = new Error('Invalid user id') as Error & { code?: string; status?: number };
    error.code = 'INVALID_USER_ID';
    error.status = 400;
    throw error;
  }
  return id;
}

export function invalidUserIdPayload(language: 'ru' | 'en' = 'ru') {
  return {
    error: 'INVALID_USER_ID',
    code: 'INVALID_USER_ID',
    message:
      language === 'en'
        ? 'Open Lumia through Telegram so the app can identify your profile.'
        : 'Открой Lumia через Telegram, чтобы приложение смогло определить профиль.',
  };
}
