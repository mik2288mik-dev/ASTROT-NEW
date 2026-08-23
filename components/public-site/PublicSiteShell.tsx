import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import type { PropsWithChildren, ReactNode } from 'react';
import {
  PUBLIC_SITE_CONFIG,
  formatPublicationDate,
  isPublicLegalReady,
  isRuStorePublished,
  mailto,
} from '../../lib/publicSiteConfig';
import styles from '../../styles/PublicSite.module.css';

type PageHeadProps = {
  title: string;
  description: string;
  path: string;
  canonical?: boolean;
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
};

export function PageHead({
  title,
  description,
  path,
  canonical: includeCanonical = true,
  noindex = false,
  jsonLd,
}: PageHeadProps) {
  const canonical = `${PUBLIC_SITE_CONFIG.baseUrl}${path === '/' ? '' : path}`;
  const shouldNoindex = noindex || PUBLIC_SITE_CONFIG.isLegalPreview;

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={shouldNoindex ? 'noindex,nofollow' : 'index,follow'} />
      {includeCanonical ? <link rel="canonical" href={canonical} /> : null}
      <link rel="icon" type="image/svg+xml" href="/assets/brand/personal-horoscope-mark.svg" />
      <link rel="manifest" href="/site.webmanifest" />
      {PUBLIC_SITE_CONFIG.yandexWebmasterVerification ? (
        <meta name="yandex-verification" content={PUBLIC_SITE_CONFIG.yandexWebmasterVerification} />
      ) : null}
      {PUBLIC_SITE_CONFIG.googleSiteVerification ? (
        <meta name="google-site-verification" content={PUBLIC_SITE_CONFIG.googleSiteVerification} />
      ) : null}
      <meta property="og:type" content="website" />
      <meta property="og:locale" content="ru_RU" />
      <meta property="og:site_name" content="MEOU" />
      <meta property="og:url" content={canonical} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={`${PUBLIC_SITE_CONFIG.baseUrl}/home/cards/today-hero.webp`} />
      <meta property="og:image:width" content="1400" />
      <meta property="og:image:height" content="788" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={`${PUBLIC_SITE_CONFIG.baseUrl}/home/cards/today-hero.webp`} />
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
    </Head>
  );
}

function Brand({ footer = false }: { footer?: boolean }) {
  return (
    <Link href="/" className={footer ? styles.footerBrand : styles.brand} aria-label="Главная MEOU">
      <Image
        src="/assets/brand/personal-horoscope-mark.svg"
        alt=""
        width={42}
        height={32}
        className={styles.brandMark}
      />
      <span>MEOU</span>
    </Link>
  );
}

function DownloadAction({ compact = false }: { compact?: boolean }) {
  if (isRuStorePublished()) {
    return (
      <a
        className={compact ? styles.headerCta : styles.primaryCta}
        href={PUBLIC_SITE_CONFIG.rustoreUrl}
        rel="noreferrer"
      >
        Скачать в RuStore
      </a>
    );
  }

  return (
    <span
      className={compact ? styles.headerStatus : styles.releaseStatus}
      role="status"
      aria-label="Приложение скоро появится в RuStore"
    >
      Скоро в RuStore
    </span>
  );
}

export function PublicSiteShell({ children }: PropsWithChildren) {
  const supportHref = mailto(PUBLIC_SITE_CONFIG.supportEmail, 'Поддержка MEOU');

  return (
    <div className={styles.siteRoot}>
      <a className={styles.skipLink} href="#main-content">К основному содержанию</a>
      <header className={styles.siteHeader}>
        <div className={styles.headerInner}>
          <Brand />
          <nav className={styles.headerNav} aria-label="Основная навигация">
            <Link href="/#possibilities">Возможности</Link>
            <Link href="/#principles">Принципы</Link>
            <Link href="/support">Поддержка</Link>
          </nav>
          <DownloadAction compact />
        </div>
      </header>
      {children}
      <footer className={styles.siteFooter}>
        <div className={styles.footerInner}>
          <div className={styles.footerIntro}>
            <Brand footer />
            <p>Персональные прогнозы и разбор натальной карты без обещаний предсказать судьбу.</p>
          </div>
          <nav className={styles.footerLinks} aria-label="Правовая информация">
            <Link href="/privacy">Конфиденциальность</Link>
            <Link href="/personal-data-consent">Согласие на обработку ПД</Link>
            <Link href="/terms">Пользовательское соглашение</Link>
            <Link href="/delete-account">Удаление аккаунта</Link>
            <Link href="/support">Поддержка</Link>
            <Link href="/requisites">Реквизиты</Link>
            {supportHref ? <a href={supportHref}>Написать в поддержку</a> : null}
          </nav>
          <p className={styles.footerMeta}>© 2026 MEOU. Lifestyle / entertainment.</p>
        </div>
      </footer>
    </div>
  );
}

export function ReleaseAction() {
  return <DownloadAction />;
}

type LegalPageProps = PropsWithChildren<{
  title: string;
  description: string;
  path: string;
  lead: ReactNode;
}>;

export function LegalPage({ title, description, path, lead, children }: LegalPageProps) {
  const legalReady = isPublicLegalReady();
  const canonical = `${PUBLIC_SITE_CONFIG.baseUrl}${path}`;
  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'MEOU', item: PUBLIC_SITE_CONFIG.baseUrl },
      { '@type': 'ListItem', position: 2, name: title, item: canonical },
    ],
  };

  return (
    <PublicSiteShell>
      <PageHead
        title={title.endsWith('MEOU') ? title : `${title} — MEOU`}
        description={description}
        path={path}
        noindex={!legalReady}
        jsonLd={breadcrumbs}
      />
      <main id="main-content" className={styles.legalMain}>
        <nav className={styles.breadcrumbs} aria-label="Хлебные крошки">
          <Link href="/">MEOU</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{title}</span>
        </nav>
        {!legalReady ? (
          <aside className={styles.legalDraftNotice} role="status">
            <strong>Черновик не готов к публикации.</strong>
            <span> Реальные реквизиты оператора и контакты ещё не заполнены; страница закрыта от индексации.</span>
          </aside>
        ) : null}
        <article className={styles.legalArticle}>
          <header className={styles.legalHeading}>
            <p className={styles.eyebrow}>MEOU · редакция от {formatPublicationDate()}</p>
            <h1>{title}</h1>
            <div className={styles.legalLead}>{lead}</div>
          </header>
          {children}
        </article>
      </main>
    </PublicSiteShell>
  );
}

export { styles as publicSiteStyles };
