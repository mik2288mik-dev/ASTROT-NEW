import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArticleCard } from '@/components/ArticleCard';
import { JsonLd } from '@/components/JsonLd';
import { StoreButtons } from '@/components/StoreButtons';
import { getGuides } from '@/lib/content';
import { getDictionary } from '@/lib/i18n';
import { pageMetadata, organizationJsonLd, softwareApplicationJsonLd, websiteJsonLd } from '@/lib/seo';
import { brands, isLocale } from '@/lib/site';
import { zodiacSlugs, getZodiacInfo } from '@/lib/zodiac';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return pageMetadata({ locale, title: dict.hero.title, description: dict.hero.body });
}

export default async function LocaleHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const guides = (await getGuides(locale)).slice(0, 3);
  const features = [
    ['personal-horoscope', dict.sections.personal],
    ['natal-chart', dict.sections.natal],
    ['compatibility', dict.sections.compatibility],
    ['zodiac-horoscope', dict.sections.zodiac],
    ['questions', dict.sections.questions],
  ] as const;

  const appJsonLd = softwareApplicationJsonLd(locale);
  return (
    <>
      <JsonLd data={organizationJsonLd(locale)} />
      <JsonLd data={websiteJsonLd(locale)} />
      {appJsonLd ? <JsonLd data={appJsonLd} /> : null}
      <section className="hero">
        <div className="shell hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">{dict.hero.eyebrow}</p>
            <h1>{dict.hero.title}</h1>
            <p className="lead">{dict.hero.body}</p>
            <div className="hero-actions">
              <Link className="button" href={`/${locale}#features`}>{dict.hero.primary}</Link>
              <Link className="button secondary" href={`/${locale}/guides`}>{dict.hero.secondary}</Link>
            </div>
          </div>
          <div className="hero-visual" aria-label={`${brands[locale]} product preview`}>
            <div className="visual-blob blob-one" aria-hidden="true" />
            <div className="visual-blob blob-two" aria-hidden="true" />
            <div className="visual-card visual-card-one">
              <span>01</span>
              <strong>{dict.sections.personal.title}</strong>
            </div>
            <div className="visual-card visual-card-two">
              <span>02</span>
              <strong>{dict.sections.natal.title}</strong>
            </div>
            <div className="visual-card visual-card-three">
              <span>03</span>
              <strong>{dict.sections.compatibility.title}</strong>
            </div>
            <div className="visual-card visual-card-four">
              <span>04</span>
              <strong>{dict.sections.questions.title}</strong>
            </div>
            <div className="visual-mark" aria-hidden="true">★</div>
          </div>
        </div>
      </section>

      <section className="section feature-section" id="features">
        <div className="shell">
          <div className="section-heading">
            <h2>{dict.nav.features}</h2>
            <p>{dict.hero.body}</p>
          </div>
          <div className="feature-grid">
            {features.map(([slug, item], index) => (
              <article className={`feature-card feature-${slug}`} key={slug}>
                <span className="feature-index">0{index + 1}</span>
                <div><h3>{item.title}</h3><p>{item.body}</p></div>
                <Link href={`/${locale}/${slug}`}>{dict.common.readMore} →</Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section alt story-section">
        <div className="shell split-panel">
          <article className="content-panel content-panel-primary">
            <p className="eyebrow">{brands[locale]}</p>
            <h2>{dict.home.whyTitle}</h2>
            <p>{dict.home.whyBody}</p>
          </article>
          <article className="content-panel content-panel-secondary">
            <p className="eyebrow">Editorial</p>
            <h2>{dict.home.contentTitle}</h2>
            <p>{dict.home.contentBody}</p>
            <Link className="button secondary" href={`/${locale}/guides`}>{dict.common.allGuides}</Link>
          </article>
        </div>
      </section>

      <section className="section zodiac-section">
        <div className="shell">
          <div className="section-heading"><h2>{dict.common.zodiac}</h2><Link className="button secondary" href={`/${locale}/zodiac`}>{dict.common.allSigns}</Link></div>
          <div className="sign-grid">
            {zodiacSlugs.slice(0, 8).map((sign, index) => {
              const info = getZodiacInfo(locale, sign);
              return <Link className={`sign-card sign-card-${(index % 4) + 1}`} key={sign} href={`/${locale}/zodiac/${sign}`}><strong>{info.name}</strong><span>{info.dates}</span></Link>;
            })}
          </div>
        </div>
      </section>

      {guides.length > 0 ? (
        <section className="section alt guides-section">
          <div className="shell">
            <div className="section-heading"><h2>{dict.home.contentTitle}</h2><Link className="button secondary" href={`/${locale}/guides`}>{dict.common.allGuides}</Link></div>
            <div className="article-grid">
              {guides.map((guide) => <ArticleCard key={guide.frontmatter.slug} href={`/${locale}/guides/${guide.frontmatter.slug}`} title={guide.frontmatter.title} description={guide.frontmatter.description} meta={guide.frontmatter.publishedAt} />)}
            </div>
          </div>
        </section>
      ) : null}

      <section className="section">
        <div className="shell final-cta">
          <div><h2>{dict.home.finalTitle}</h2><p>{dict.home.finalBody}</p></div>
          <StoreButtons fallback={dict.common.comingSoon} />
        </div>
      </section>
    </>
  );
}
