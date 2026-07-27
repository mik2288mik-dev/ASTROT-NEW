import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { getCurrentHoroscope, getCurrentHoroscopeRoutes } from '@/lib/content';
import { getDictionary } from '@/lib/i18n';
import { articleJsonLd, breadcrumbJsonLd, pageMetadata } from '@/lib/seo';
import { isLocale } from '@/lib/site';
import { getZodiacInfo, zodiacSlugs, type ZodiacSlug } from '@/lib/zodiac';

export async function generateStaticParams() {
  return getCurrentHoroscopeRoutes();
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; period: string; sign: string }> }): Promise<Metadata> {
  const { locale, period, sign } = await params;
  if (!isLocale(locale)) return {};
  const document = await getCurrentHoroscope(locale, period, sign);
  if (!document) return {};
  const item = document.frontmatter;
  return pageMetadata({ locale, title: item.title, description: item.description, path: `horoscopes/${period}/${sign}`, noindex: item.indexing === 'noindex', type: 'article', publishedTime: item.publishedAt, modifiedTime: item.updatedAt });
}

export default async function CurrentHoroscopePage({ params }: { params: Promise<{ locale: string; period: string; sign: string }> }) {
  const { locale, period, sign } = await params;
  if (!isLocale(locale) || !zodiacSlugs.includes(sign as ZodiacSlug)) notFound();
  const document = await getCurrentHoroscope(locale, period, sign);
  if (!document) notFound();
  const item = document.frontmatter;
  const dict = getDictionary(locale);
  const zodiac = getZodiacInfo(locale, sign as ZodiacSlug);
  const path = `/${locale}/horoscopes/${period}/${sign}`;
  return <><JsonLd data={breadcrumbJsonLd([{ name: dict.common.home, path: `/${locale}` }, { name: dict.common.horoscopes, path: `/${locale}/horoscopes` }, { name: zodiac.name, path }])} /><JsonLd data={articleJsonLd({ locale, title: item.title, description: item.description, path, publishedAt: item.publishedAt, updatedAt: item.updatedAt })} /><article><header className="page-hero"><div className="shell"><Breadcrumbs items={[{ label: dict.common.home, href: `/${locale}` }, { label: dict.common.horoscopes, href: `/${locale}/horoscopes` }, { label: zodiac.name }]} /><p className="eyebrow">{zodiac.name} · {item.validFrom} — {item.validThrough}</p><h1>{item.title}</h1><p className="lead">{item.description}</p></div></header><section className="section"><div className="shell prose" dangerouslySetInnerHTML={{ __html: document.html }} /></section></article></>;
}
