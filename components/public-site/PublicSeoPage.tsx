import Link from 'next/link';
import type { PropsWithChildren, ReactNode } from 'react';
import {
  PageHead,
  PublicSiteShell,
  createBreadcrumbJsonLd,
  publicSiteStyles as styles,
  type PublicSiteJsonLd,
} from './PublicSiteShell';
import {
  PUBLIC_SEO_BRAND,
  PUBLIC_SEO_HUB_LINKS,
  PUBLIC_SEO_ORIGIN,
} from '../../lib/publicSeoContent';

export type PublicSeoBreadcrumb = {
  name: string;
  path: string;
};

export type PublicSeoFaq = {
  question: string;
  answer: string;
};

export type PublicSeoRelatedLink = {
  href: string;
  label: string;
};

type PublicSeoPageProps = PropsWithChildren<{
  path: string;
  title: string;
  description: string;
  eyebrow: string;
  heading: string;
  lead: ReactNode;
  breadcrumbs: readonly PublicSeoBreadcrumb[];
  faq?: readonly PublicSeoFaq[];
  relatedLinks?: readonly PublicSeoRelatedLink[];
  schemaType?: 'WebPage' | 'CollectionPage';
}>;

function absoluteUrl(path: string): string {
  return path === '/' ? PUBLIC_SEO_ORIGIN : `${PUBLIC_SEO_ORIGIN}${path}`;
}

function buildPageJsonLd({
  path,
  title,
  description,
  breadcrumbs,
  faq,
  schemaType,
}: Pick<
  PublicSeoPageProps,
  'path' | 'title' | 'description' | 'breadcrumbs' | 'faq' | 'schemaType'
>): PublicSiteJsonLd[] {
  const breadcrumbItems = [
    { name: PUBLIC_SEO_BRAND, path: '/' },
    ...breadcrumbs.map(({ name, path: breadcrumbPath }) => ({
      name,
      path: breadcrumbPath,
    })),
  ];
  const pageUrl = absoluteUrl(path);
  const blocks: PublicSiteJsonLd[] = [
    createBreadcrumbJsonLd(breadcrumbItems),
    {
      '@context': 'https://schema.org',
      '@type': schemaType || 'WebPage',
      '@id': `${pageUrl}#webpage`,
      url: pageUrl,
      name: title,
      description,
      inLanguage: 'ru-RU',
      isPartOf: { '@id': `${PUBLIC_SEO_ORIGIN}/#website` },
      breadcrumb: { '@id': `${pageUrl}#breadcrumb` },
    },
  ];

  if (faq?.length) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': `${pageUrl}#faq`,
      mainEntity: faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    });
  }

  return blocks;
}

export function PublicSeoPage({
  path,
  title,
  description,
  eyebrow,
  heading,
  lead,
  breadcrumbs,
  faq = [],
  relatedLinks = PUBLIC_SEO_HUB_LINKS,
  schemaType = 'WebPage',
  children,
}: PublicSeoPageProps) {
  const headTitle = title.includes(PUBLIC_SEO_BRAND)
    ? title
    : `${title} — ${PUBLIC_SEO_BRAND}`;
  const jsonLd = buildPageJsonLd({
    path,
    title: headTitle,
    description,
    breadcrumbs,
    faq,
    schemaType,
  });
  const visibleBreadcrumbs = [
    { name: PUBLIC_SEO_BRAND, path: '/' },
    ...breadcrumbs,
  ];

  return (
    <PublicSiteShell>
      <PageHead
        title={headTitle}
        description={description}
        path={path}
        indexIntent="index"
        jsonLd={jsonLd}
      />
      <main id="main-content" className={styles.seoMain}>
        <nav className={styles.breadcrumbs} aria-label="Хлебные крошки">
          {visibleBreadcrumbs.map((item, index) => {
            const isCurrent = index === visibleBreadcrumbs.length - 1;
            return (
              <span key={item.path}>
                {index > 0 ? <span aria-hidden="true"> / </span> : null}
                {isCurrent ? (
                  <span aria-current="page">{item.name}</span>
                ) : (
                  <Link href={item.path}>{item.name}</Link>
                )}
              </span>
            );
          })}
        </nav>

        <article className={styles.seoArticle}>
          <header className={styles.seoHero}>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h1>{heading}</h1>
            <div className={styles.seoLead}>{lead}</div>
          </header>

          {children}

          {faq.length ? (
            <section className={styles.seoFaq} aria-labelledby="faq-heading">
              <h2 id="faq-heading">Частые вопросы</h2>
              <dl>
                {faq.map((item) => (
                  <div key={item.question}>
                    <dt>{item.question}</dt>
                    <dd>{item.answer}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {relatedLinks.length ? (
            <section className={styles.seoRelated} aria-labelledby="related-heading">
              <h2 id="related-heading">Смотреть дальше</h2>
              <ul>
                {relatedLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </article>
      </main>
    </PublicSiteShell>
  );
}
