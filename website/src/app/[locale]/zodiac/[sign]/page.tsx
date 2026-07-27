import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { getDictionary } from '@/lib/i18n';
import { breadcrumbJsonLd, pageMetadata } from '@/lib/seo';
import { isLocale, locales } from '@/lib/site';
import { getZodiacInfo, zodiacSlugs, type ZodiacSlug } from '@/lib/zodiac';

export function generateStaticParams() {
  return locales.flatMap((locale) => zodiacSlugs.map((sign) => ({ locale, sign })));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; sign: string }> }): Promise<Metadata> {
  const { locale, sign } = await params;
  if (!isLocale(locale) || !zodiacSlugs.includes(sign as ZodiacSlug)) return {};
  const info = getZodiacInfo(locale, sign as ZodiacSlug);
  return pageMetadata({ locale, title: info.title, description: info.description, path: `zodiac/${sign}` });
}

export default async function ZodiacPage({ params }: { params: Promise<{ locale: string; sign: string }> }) {
  const { locale, sign } = await params;
  if (!isLocale(locale) || !zodiacSlugs.includes(sign as ZodiacSlug)) notFound();
  const info = getZodiacInfo(locale, sign as ZodiacSlug);
  const dict = getDictionary(locale);
  const currentPath = `/${locale}/zodiac/${sign}`;
  return <><JsonLd data={breadcrumbJsonLd([{ name: dict.common.home, path: `/${locale}` }, { name: dict.common.zodiac, path: `/${locale}/zodiac` }, { name: info.name, path: currentPath }])} /><section className="page-hero"><div className="shell"><Breadcrumbs items={[{ label: dict.common.home, href: `/${locale}` }, { label: dict.common.zodiac, href: `/${locale}/zodiac` }, { label: info.name }]} /><p className="eyebrow">{info.dates}</p><h1>{info.title}</h1><p className="lead">{info.intro}</p></div></section><section className="section"><div className="shell split-panel"><article className="content-panel"><h2>{locale==='ru'?'Характер и сильные стороны':locale==='es'?'Rasgos y fortalezas':'Traits and strengths'}</h2><p>{info.strengths}</p></article><article className="content-panel"><h2>{locale==='ru'?'Отношения':locale==='es'?'Relaciones':'Relationships'}</h2><p>{info.relationships}</p></article><article className="content-panel"><h2>{locale==='ru'?'Работа':locale==='es'?'Trabajo':'Work'}</h2><p>{info.work}</p></article><article className="content-panel"><h2>{locale==='ru'?'Общий или личный прогноз':locale==='es'?'Horóscopo general o lectura personal':'General or personal forecast'}</h2><p>{info.note}</p></article></div></section></>;
}
