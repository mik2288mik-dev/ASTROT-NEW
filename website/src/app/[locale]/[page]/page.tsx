import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { getDictionary } from '@/lib/i18n';
import { getLegalPage } from '@/lib/legal';
import { getStaticPage, getStaticPages } from '@/lib/pages';
import { breadcrumbJsonLd, pageMetadata } from '@/lib/seo';
import { isLocale, locales } from '@/lib/site';

const legalSlugs = ['privacy','terms','subscription-terms','delete-account','cookies','contact'];

export function generateStaticParams() {
  return locales.flatMap((locale) => [
    ...getStaticPages(locale).map((page) => ({ locale, page: page.slug })),
    ...legalSlugs.map((page) => ({ locale, page })),
  ]);
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; page: string }> }): Promise<Metadata> {
  const { locale, page } = await params;
  if (!isLocale(locale)) return {};
  const entry = getStaticPage(locale, page) || getLegalPage(locale, page);
  if (!entry) return {};
  return pageMetadata({ locale, title: entry.title, description: entry.description, path: entry.slug, noindex: entry.noindex });
}

export default async function StaticContentPage({ params }: { params: Promise<{ locale: string; page: string }> }) {
  const { locale, page } = await params;
  if (!isLocale(locale)) notFound();
  const entry = getStaticPage(locale, page) || getLegalPage(locale, page);
  if (!entry) notFound();
  const dict = getDictionary(locale);
  const currentPath = `/${locale}/${entry.slug}`;
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: dict.common.home, path: `/${locale}` }, { name: entry.title, path: currentPath }])} />
      <section className="page-hero">
        <div className="shell">
          <Breadcrumbs items={[{ label: dict.common.home, href: `/${locale}` }, { label: entry.title }]} />
          <h1>{entry.title}</h1>
          <p className="lead">{entry.description}</p>
        </div>
      </section>
      <section className="section">
        <div className="shell prose">
          <p className={entry.intro.startsWith('Черновик') || entry.intro.startsWith('Draft') || entry.intro.startsWith('Borrador') ? 'notice legal-placeholder' : 'notice'}>{entry.intro}</p>
          {entry.sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.body.length === 1 ? <p>{section.body[0]}</p> : <ul>{section.body.map((item) => <li key={item}>{item}</li>)}</ul>}
            </section>
          ))}
        </div>
      </section>
    </>
  );
}
