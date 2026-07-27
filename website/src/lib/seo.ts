import type { Metadata } from 'next';
import { absoluteUrl, brands, hreflangCodes, locales, localizedPath, siteIndexable, storeLinks, type Locale } from './site';

export function languageAlternates(path: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const locale of locales) result[hreflangCodes[locale]] = absoluteUrl(localizedPath(locale, path));
  result['x-default'] = absoluteUrl('/');
  return result;
}

export function pageMetadata(input: { locale: Locale; title: string; description: string; path?: string; noindex?: boolean; type?: 'website' | 'article'; publishedTime?: string; modifiedTime?: string }): Metadata {
  const path = input.path || '';
  const canonical = absoluteUrl(localizedPath(input.locale, path));
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical, languages: languageAlternates(path) },
    robots: input.noindex || !siteIndexable ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      type: input.type || 'website', locale: input.locale, url: canonical, siteName: brands[input.locale], title: input.title,
      description: input.description, publishedTime: input.publishedTime, modifiedTime: input.modifiedTime,
      images: [{ url: absoluteUrl('/placeholder.svg'), width: 1200, height: 900 }],
    },
    twitter: { card: 'summary_large_image', title: input.title, description: input.description, images: [absoluteUrl('/placeholder.svg')] },
  };
}

export function organizationJsonLd(locale: Locale) {
  return { '@context': 'https://schema.org', '@type': 'Organization', name: brands[locale], url: absoluteUrl(localizedPath(locale)), email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || undefined };
}

export function websiteJsonLd(locale: Locale) {
  return { '@context': 'https://schema.org', '@type': 'WebSite', name: brands[locale], url: absoluteUrl(localizedPath(locale)), inLanguage: locale };
}

export function softwareApplicationJsonLd(locale: Locale) {
  const price = process.env.NEXT_PUBLIC_APP_PRICE;
  const currency = process.env.NEXT_PUBLIC_APP_PRICE_CURRENCY;
  const hasStore = Boolean(storeLinks.googlePlay || storeLinks.appStore || storeLinks.ruStore);
  if (!price || !currency || !hasStore) return null;
  return {
    '@context': 'https://schema.org', '@type': 'MobileApplication', name: brands[locale], operatingSystem: 'Android, iOS', applicationCategory: 'LifestyleApplication',
    url: absoluteUrl(localizedPath(locale)),
    description: locale === 'ru' ? 'Личные прогнозы, натальная карта, совместимость и гороскопы по знакам.' : locale === 'es' ? 'Horóscopos personales, carta natal, compatibilidad y horóscopos por signo.' : 'Personal forecasts, natal chart, compatibility, and zodiac horoscopes.',
    offers: { '@type': 'Offer', price, priceCurrency: currency },
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: absoluteUrl(item.path) })) };
}

export function articleJsonLd(input: { locale: Locale; title: string; description: string; path: string; publishedAt: string; updatedAt?: string }) {
  return {
    '@context': 'https://schema.org', '@type': 'Article', headline: input.title, description: input.description, inLanguage: input.locale,
    datePublished: input.publishedAt, dateModified: input.updatedAt || input.publishedAt, mainEntityOfPage: absoluteUrl(input.path),
    author: { '@type': 'Organization', name: brands[input.locale] }, publisher: { '@type': 'Organization', name: brands[input.locale] }, image: absoluteUrl('/placeholder.svg'),
  };
}
