export const locales = ['ru', 'en', 'es'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'ru';

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com').replace(/\/$/, '');
export const siteIndexable = process.env.NEXT_PUBLIC_SITE_INDEXABLE === 'true';

export const localeNames: Record<Locale, string> = {
  ru: 'Русский',
  en: 'English',
  es: 'Español',
};

export const hreflangCodes: Record<Locale, string> = {
  ru: 'ru',
  en: 'en',
  es: 'es',
};

export const brands: Record<Locale, string> = {
  ru: process.env.NEXT_PUBLIC_APP_NAME_RU || 'Твой Гороскоп',
  en: process.env.NEXT_PUBLIC_APP_NAME_EN || 'Your Horoscope',
  es: process.env.NEXT_PUBLIC_APP_NAME_ES || 'Tu Horóscopo',
};

export const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@example.com';
export const privacyEmail = process.env.NEXT_PUBLIC_PRIVACY_EMAIL || supportEmail;
export const legalOperator = process.env.NEXT_PUBLIC_LEGAL_OPERATOR || '[LEGAL_OPERATOR_NAME]';
export const legalCountry = process.env.NEXT_PUBLIC_LEGAL_COUNTRY || '[LEGAL_COUNTRY]';
export const legalAddress = process.env.NEXT_PUBLIC_LEGAL_ADDRESS || '[LEGAL_ADDRESS]';
export const minimumAge = process.env.NEXT_PUBLIC_MINIMUM_AGE || '16';

export const storeLinks = {
  googlePlay: process.env.NEXT_PUBLIC_GOOGLE_PLAY_URL || '',
  appStore: process.env.NEXT_PUBLIC_APP_STORE_URL || '',
  ruStore: process.env.NEXT_PUBLIC_RUSTORE_URL || '',
};

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function absoluteUrl(path = ''): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${siteUrl}${normalized === '/' ? '' : normalized}`;
}

export function localizedPath(locale: Locale, path = ''): string {
  const normalized = path ? `/${path.replace(/^\//, '')}` : '';
  return `/${locale}${normalized}`;
}
