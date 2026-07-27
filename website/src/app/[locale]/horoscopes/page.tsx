import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArticleCard } from '@/components/ArticleCard';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { getHoroscopes } from '@/lib/content';
import { getDictionary } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';
import { isLocale } from '@/lib/site';
import { getZodiacInfo } from '@/lib/zodiac';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return pageMetadata({ locale, title: dict.common.horoscopes, description: locale === 'ru' ? 'Актуальные гороскопы по знакам: сегодня, неделя и месяц. Только опубликованные редакцией материалы.' : locale === 'es' ? 'Horóscopos actuales por signo para hoy, la semana y el mes.' : 'Current zodiac horoscopes for today, the week, and the month.', path: 'horoscopes' });
}

export default async function HoroscopesIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const all = await getHoroscopes(locale);
  const now = new Date();
  const current = all.filter((item) => new Date(item.frontmatter.validFrom) <= now && new Date(item.frontmatter.validThrough) >= now);
  return <><section className="page-hero"><div className="shell"><Breadcrumbs items={[{ label: dict.common.home, href: `/${locale}` }, { label: dict.common.horoscopes }]} /><h1>{dict.common.horoscopes}</h1><p className="lead">{locale === 'ru' ? 'Здесь появляются только актуальные материалы. Мы не создаём тысячи пустых архивных страниц ради поискового трафика.' : locale === 'es' ? 'Aquí aparecen solo contenidos vigentes. No creamos miles de páginas vacías para atraer tráfico.' : 'Only current material appears here. We do not create thousands of thin archive pages for search traffic.'}</p></div></section><section className="section"><div className="shell article-grid">{current.map((item) => { const sign = getZodiacInfo(locale, item.frontmatter.sign); return <ArticleCard key={`${item.frontmatter.period}-${item.frontmatter.sign}`} href={`/${locale}/horoscopes/${item.frontmatter.period}/${item.frontmatter.sign}`} title={item.frontmatter.title} description={item.frontmatter.description} meta={`${sign.name} · ${item.frontmatter.validThrough}`} />; })}</div></section></>;
}
