import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArticleCard } from '@/components/ArticleCard';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { getGuides } from '@/lib/content';
import { getDictionary } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';
import { isLocale } from '@/lib/site';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return pageMetadata({ locale, title: dict.common.guides, description: locale === 'ru' ? 'Разборы о натальной карте, совместимости, времени рождения, асценденте и популярных астрологических темах.' : locale === 'es' ? 'Guías sobre carta natal, compatibilidad, hora de nacimiento, ascendente y temas populares de astrología.' : 'Guides about natal charts, compatibility, birth time, rising signs, and popular astrology topics.', path: 'guides' });
}

export default async function GuidesIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const guides = await getGuides(locale);
  const dict = getDictionary(locale);
  return <><section className="page-hero"><div className="shell"><Breadcrumbs items={[{ label: dict.common.home, href: `/${locale}` }, { label: dict.common.guides }]} /><h1>{dict.common.guides}</h1><p className="lead">{locale === 'ru' ? 'Не энциклопедия ради ключевых слов, а материалы, после которых становится понятнее, как устроены расчёты и где у них есть границы.' : locale === 'es' ? 'Contenido útil para entender los cálculos, sus límites y cómo leerlos sin dramatizar.' : 'Useful material that explains the calculations, their limits, and how to read them without drama.'}</p></div></section><section className="section"><div className="shell article-grid">{guides.map((guide) => <ArticleCard key={guide.frontmatter.slug} href={`/${locale}/guides/${guide.frontmatter.slug}`} title={guide.frontmatter.title} description={guide.frontmatter.description} meta={guide.frontmatter.publishedAt} />)}</div></section></>;
}
