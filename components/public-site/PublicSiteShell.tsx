import Head from 'next/head';
import Link from 'next/link';
import type { PropsWithChildren, ReactNode } from 'react';
import {
  PUBLIC_SITE_CONFIG,
  formatPublicationDate,
  isPublicLegalReady,
  isRuStorePublished,
  mailto,
} from '../../lib/publicSiteConfig';
import styles from '../../styles/OpenAiPublicSite.module.css';
import {
  PUBLIC_SITE_SEO,
  createBreadcrumbJsonLd,
  preparePublicPageJsonLd,
  publicAssetUrl,
  publicCanonicalUrl,
  serializePublicJsonLd,
  type PublicSiteJsonLdInput,
  type PublicSiteSocialImage,
} from './publicSiteSeo';
import { PublicAnalytics } from './PublicAnalytics';

export type PageHeadProps = {
  title: string;
  description: string;
  path: string;
  canonical?: boolean;
  indexIntent?: 'index' | 'noindex';
  noindex?: boolean;
  follow?: boolean;
  openGraphType?: 'website' | 'article' | 'profile';
  socialImage?: PublicSiteSocialImage;
  jsonLd?: PublicSiteJsonLdInput;
};

export function PageHead({ title, description, path, canonical: includeCanonical = true, indexIntent = 'index', noindex = false, follow, openGraphType = 'website', socialImage = PUBLIC_SITE_SEO.defaultSocialImage, jsonLd }: PageHeadProps) {
  const canonical = publicCanonicalUrl(path);
  const shouldNoindex = indexIntent === 'noindex' || noindex || PUBLIC_SITE_CONFIG.isLegalPreview;
  const shouldFollow = follow ?? true;
  const robots = `${shouldNoindex ? 'noindex' : 'index'},${shouldFollow ? 'follow' : 'nofollow'}`;
  const socialImageUrl = publicAssetUrl(socialImage.path);
  const jsonLdBlocks = preparePublicPageJsonLd({ path, description, jsonLd });

  return (
    <Head>
      <title>{title}</title>
      <meta key="application-name" name="application-name" content={PUBLIC_SITE_SEO.applicationName} />
      <meta key="description" name="description" content={description} />
      <meta key="robots" name="robots" content={robots} />
      {includeCanonical ? <link key="canonical" rel="canonical" href={canonical} /> : null}
      <link key="favicon" rel="icon" type="image/png" sizes="512x512" href={PUBLIC_SITE_SEO.logoPath} />
      <link key="apple-touch-icon" rel="apple-touch-icon" sizes="192x192" href="/assets/brand/nebo-app-icon-192.png" />
      <link key="manifest" rel="manifest" href={PUBLIC_SITE_SEO.manifestPath} />
      {PUBLIC_SITE_CONFIG.yandexWebmasterVerification ? <meta key="yandex-verification" name="yandex-verification" content={PUBLIC_SITE_CONFIG.yandexWebmasterVerification} /> : null}
      {PUBLIC_SITE_CONFIG.googleSiteVerification ? <meta key="google-site-verification" name="google-site-verification" content={PUBLIC_SITE_CONFIG.googleSiteVerification} /> : null}
      <meta key="og:type" property="og:type" content={openGraphType} />
      <meta key="og:locale" property="og:locale" content={PUBLIC_SITE_SEO.openGraphLocale} />
      <meta key="og:site_name" property="og:site_name" content={PUBLIC_SITE_SEO.siteName} />
      {includeCanonical ? <meta key="og:url" property="og:url" content={canonical} /> : null}
      <meta key="og:title" property="og:title" content={title} />
      <meta key="og:description" property="og:description" content={description} />
      <meta key="og:image" property="og:image" content={socialImageUrl} />
      <meta key="og:image:width" property="og:image:width" content={String(socialImage.width)} />
      <meta key="og:image:height" property="og:image:height" content={String(socialImage.height)} />
      <meta key="og:image:alt" property="og:image:alt" content={socialImage.alt} />
      {socialImage.type ? <meta key="og:image:type" property="og:image:type" content={socialImage.type} /> : null}
      <meta key="twitter:card" name="twitter:card" content="summary_large_image" />
      <meta key="twitter:title" name="twitter:title" content={title} />
      <meta key="twitter:description" name="twitter:description" content={description} />
      <meta key="twitter:image" name="twitter:image" content={socialImageUrl} />
      <meta key="twitter:image:alt" name="twitter:image:alt" content={socialImage.alt} />
      {jsonLdBlocks.map((block, index) => <script key={`json-ld-${index}`} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializePublicJsonLd(block) }} />)}
    </Head>
  );
}

function Brand({ footer = false }: { footer?: boolean }) {
  return (
    <Link href="/" className={footer ? styles.footerBrand : styles.brand} aria-label={`Главная ${PUBLIC_SITE_SEO.siteName}`}>
      <span aria-hidden="true" style={{ display: 'inline-block', color: '#f5f0e7', fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif', fontSize: footer ? '1.55rem' : '1.35rem', fontWeight: 680, lineHeight: 1, letterSpacing: '0.16em' }}>NEBO</span>
    </Link>
  );
}

function DownloadAction({ compact = false }: { compact?: boolean }) {
  if (isRuStorePublished()) return <a className={compact ? styles.headerCta : styles.primaryCta} href={PUBLIC_SITE_CONFIG.rustoreUrl} rel="noreferrer" data-analytics-event="rustore_click">Скачать в RuStore</a>;
  return <span className={compact ? styles.headerStatus : styles.releaseStatus} role="status" aria-label="Приложение скоро появится в RuStore">Скоро в RuStore</span>;
}

export function PublicSiteShell({ children }: PropsWithChildren) {
  const supportHref = mailto(PUBLIC_SITE_CONFIG.supportEmail, `Поддержка ${PUBLIC_SITE_SEO.siteName}`);
  return (
    <div className={styles.siteRoot}>
      <a className={styles.skipLink} href="#main-content">К основному содержанию</a>
      <PublicAnalytics />
      <header className={styles.siteHeader}><div className={styles.headerInner}><Brand /><nav className={styles.headerNav} aria-label="Основная навигация">{PUBLIC_SITE_SEO.navigation.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}</nav><details className={styles.mobileNav}><summary className={styles.mobileNavSummary}>Меню</summary><nav className={styles.mobileNavPanel} aria-label="Мобильная навигация">{PUBLIC_SITE_SEO.navigation.map((item) => <Link key={item.href} href={item.href} className={styles.mobileNavLink}>{item.label}</Link>)}</nav></details><DownloadAction compact /></div></header>
      {children}
      <footer className={styles.siteFooter}><div className={styles.footerInner}><div className={styles.footerIntro}><Brand footer /><p>Личный прогноз, натальная карта и совместимость в одном приложении.</p></div><nav className={styles.footerLinks} aria-label="Правовая информация"><Link href="/privacy">Конфиденциальность</Link><Link href="/personal-data-consent">Согласие на обработку ПД</Link><Link href="/terms">Пользовательское соглашение</Link><Link href="/delete-account">Удаление аккаунта</Link><Link href="/support">Поддержка</Link><Link href="/requisites">Реквизиты</Link><button className={styles.footerAnalyticsButton} type="button" onClick={() => window.dispatchEvent(new Event('nebo-open-analytics-consent'))}>Настройки аналитики</button>{supportHref ? <a href={supportHref}>Написать в поддержку</a> : null}</nav><p className={styles.footerMeta}>© 2026 {PUBLIC_SITE_SEO.siteName}. Приложение для Android.</p></div></footer>
    </div>
  );
}

export function ReleaseAction() { return <DownloadAction />; }

type LegalPageProps = PropsWithChildren<{ title: string; description: string; path: string; lead: ReactNode; }>;
export function LegalPage({ title, description, path, lead, children }: LegalPageProps) {
  const legalReady = isPublicLegalReady();
  const breadcrumbs = createBreadcrumbJsonLd([{ name: PUBLIC_SITE_SEO.siteName, path: '/' }, { name: title, path }]);
  return <PublicSiteShell><PageHead title={title.endsWith(PUBLIC_SITE_SEO.siteName) ? title : `${title} — ${PUBLIC_SITE_SEO.siteName}`} description={description} path={path} indexIntent={legalReady ? 'index' : 'noindex'} follow jsonLd={breadcrumbs} /><main id="main-content" className={styles.legalMain}><nav className={styles.breadcrumbs} aria-label="Хлебные крошки"><Link href="/">{PUBLIC_SITE_SEO.siteName}</Link><span aria-hidden="true">/</span><span aria-current="page">{title}</span></nav><article className={styles.legalArticle}><header className={styles.legalHeading}><p className={styles.eyebrow}>{PUBLIC_SITE_SEO.siteName}{legalReady ? ` · редакция от ${formatPublicationDate()}` : ''}</p><h1>{title}</h1><div className={styles.legalLead}>{lead}</div></header>{children}</article></main></PublicSiteShell>;
}

export { PUBLIC_SITE_SEO, createBreadcrumbJsonLd } from './publicSiteSeo';
export type { PublicSiteJsonLd, PublicSiteJsonLdInput, PublicSiteSocialImage } from './publicSiteSeo';
export { styles as publicSiteStyles };
