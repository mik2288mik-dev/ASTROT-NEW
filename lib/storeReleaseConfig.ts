/** Public, replaceable store and legal metadata. Never put credentials here. */
const publicBaseUrl = String(process.env.NEXT_PUBLIC_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
const fallback = (path: string) => publicBaseUrl ? `${publicBaseUrl}${path}` : path;

export const STORE_RELEASE_CONFIG = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'Твой гороскоп: натальная карта',
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || '[УКАЖИТЕ_EMAIL_ПОДДЕРЖКИ]',
  developerName: process.env.NEXT_PUBLIC_DEVELOPER_NAME || '[УКАЖИТЕ_ВЛАДЕЛЬЦА_ИЛИ_КОМПАНИЮ]',
  publicationDate: process.env.NEXT_PUBLIC_LEGAL_PUBLICATION_DATE || '[УКАЖИТЕ_ДАТУ_ПУБЛИКАЦИИ]',
  privacyUrl: process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL || fallback('/privacy'),
  termsUrl: process.env.NEXT_PUBLIC_TERMS_URL || fallback('/terms'),
  deleteAccountUrl: process.env.NEXT_PUBLIC_ACCOUNT_DELETION_URL || fallback('/delete-account'),
} as const;

export function isConfiguredPublicValue(value: string): boolean {
  return !!value && !value.includes('[УКАЖИТЕ_') && !value.includes('_REQUIRED');
}

export function isAbsoluteHttpsUrl(value: string): boolean {
  return /^https:\/\//i.test(value);
}
