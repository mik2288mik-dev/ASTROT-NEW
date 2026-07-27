import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { getGuide, getGuides } from '@/lib/content';
import { getDictionary } from '@/lib/i18n';
import { articleJsonLd, breadcrumbJsonLd, pageMetadata } from '@/lib/seo';
import { isLocale, locales } from '@/lib/site';

export async function generateStaticParams() {
  const params: Array<{ locale: string; slug: string }> = [];
  for (const locale of locales) {
    const guides = await getGuides(locale);
    params.push(...guides.map((guide) => ({ locale, slug: guide.frontmatter.slug })));
  }
  return params;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const guide = await getGuide(locale, slug);
  if (!guide) return {};
  const item = guide.frontmatter;
  return pageMetadata({ locale, title: item.title, description: item.description, path: `guides/${item.slug}`, noindex: item.indexing === 'noindex', type: 'article', publishedTime: item.publishedAt, modifiedTime: item.updatedAt });
}

export default async function GuidePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const guide = await getGuide(locale, slug);
  if (!guide) notFound();
  const item = guide.frontmatter;
  const dict = getDictionary(locale);
  const path = `/${locale}/guides/${item.slug}`;
  return <><JsonLd data={breadcrumbJsonLd([{ name: dict.common.home, path: `/${locale}` }, { name: dict.common.guides, path: `/${locale}/guides` }, { name: item.title, path }])} /><JsonLd data={articleJsonLd({ locale, title: item.title, description: item.description, path, publishedAt: item.publishedAt, updatedAt: item.updatedAt })} /><article><header className="page-hero"><div className="shell"><Breadcrumbs items={[{ label: dict.common.home, href: `/${locale}` }, { label: dict.common.guides, href: `/${locale}/guides` }, { label: item.title }]} /><h1>{item.title}</h1><p className="lead">{item.description}</p><p className="article-meta">{dict.common.updated}: {item.updatedAt || item.publishedAt}</p></div></header><section className="section"><div className="shell prose" dangerouslySetInnerHTML={{ __html: guide.html }} /></section></article></>;
}
