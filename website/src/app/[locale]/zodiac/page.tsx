import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { getDictionary } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';
import { isLocale } from '@/lib/site';
import { getZodiacInfo, zodiacSlugs } from '@/lib/zodiac';
import Link from 'next/link';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return pageMetadata({ locale, title: dict.common.zodiac, description: locale === 'ru' ? 'Все 12 знаков зодиака: даты, характер, отношения, работа и переход к текущим гороскопам.' : locale === 'es' ? 'Los 12 signos del zodiaco: fechas, personalidad, relaciones y trabajo.' : 'All 12 zodiac signs: dates, personality, relationships, and work.', path: 'zodiac' });
}

export default async function ZodiacHub({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  return <><section className="page-hero"><div className="shell"><Breadcrumbs items={[{ label: dict.common.home, href: `/${locale}` }, { label: dict.common.zodiac }]} /><h1>{dict.common.zodiac}</h1><p className="lead">{locale === 'ru' ? 'Общий профиль каждого знака и честное объяснение, где заканчивается общий гороскоп и начинается персональный разбор.' : locale === 'es' ? 'Perfil general de cada signo y una explicación clara de la diferencia entre horóscopo general y lectura personal.' : 'A general profile for each sign and a clear explanation of where sign-based content ends and personal reading begins.'}</p></div></section><section className="section"><div className="shell sign-grid">{zodiacSlugs.map((sign) => { const info = getZodiacInfo(locale, sign); return <Link key={sign} className="sign-card" href={`/${locale}/zodiac/${sign}`}><strong>{info.name}</strong><span>{info.dates}</span></Link>; })}</div></section></>;
}
