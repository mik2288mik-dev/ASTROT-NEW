import Image from 'next/image';
import Link from 'next/link';
import { MeouForecastScrollStory } from '../components/public-site/MeouForecastScrollStory';
import {
  PageHead,
  PublicSiteShell,
  ReleaseAction,
  publicSiteStyles as styles,
} from '../components/public-site/PublicSiteShell';
import { PUBLIC_SITE_CONFIG, isRuStorePublished } from '../lib/publicSiteConfig';
import seo from '../styles/PublicSeoHome.module.css';

const PUBLIC_BRAND = 'NEBO';
const PUBLIC_SEO_NAME = 'NEBO гороскоп натальная карта';
const pageDescription = `${PUBLIC_SEO_NAME} — личный прогноз на сегодня, неделю и месяц, натальная карта, совместимость и гороскопы по знакам.`;

function homeSchema() {
  const software: Record<string, unknown> = {
    '@type': 'SoftwareApplication',
    '@id': `${PUBLIC_SITE_CONFIG.baseUrl}/#application`,
    name: PUBLIC_BRAND,
    url: PUBLIC_SITE_CONFIG.baseUrl,
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Android',
    inLanguage: 'ru-RU',
    description: pageDescription,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'RUB',
      availability: isRuStorePublished() ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder',
    },
  };
  if (isRuStorePublished()) software.downloadUrl = PUBLIC_SITE_CONFIG.rustoreUrl;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${PUBLIC_SITE_CONFIG.baseUrl}/#website`,
        name: PUBLIC_BRAND,
        url: PUBLIC_SITE_CONFIG.baseUrl,
        inLanguage: 'ru-RU',
        description: pageDescription,
      },
      software,
    ],
  };
}

const productFunctions = [
  { number: '01', title: 'Личный прогноз', href: '/lichnyy-goroskop', description: 'Сегодня — коротко. Неделя и месяц — одним связным текстом. Без одинаковых фраз для всех.' },
  { number: '02', title: 'Гороскоп по знакам', href: '/goroskop', description: 'Быстрый общий прогноз для Овна, Тельца, Близнецов и остальных знаков.' },
  { number: '03', title: 'Совместимость', href: '/sovmestimost', description: 'Посмотри, где вам легко друг с другом, а где чаще появляются споры и недопонимание.' },
  { number: '04', title: 'Натальная карта', href: '/natalnaya-karta', description: 'Дата, время и место рождения — и можно отдельно посмотреть планеты, знаки и дома.' },
] as const;

export default function PublicLandingPage() {
  return (
    <PublicSiteShell>
      <PageHead
        title={`${PUBLIC_BRAND}: гороскоп, натальная карта и совместимость`}
        description={pageDescription}
        path="/"
        jsonLd={homeSchema()}
      />

      <main id="main-content" className={styles.homeMain}>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroInner}>
            <p className={styles.heroEyebrow}>{PUBLIC_BRAND} · личный прогноз</p>
            <h1 id="hero-title" className={styles.heroTitle} aria-label="Твой день. Твой текст.">
              <span className={styles.heroLineMask} aria-hidden="true"><span className={styles.heroLine}>Твой день.</span></span>
              <span className={styles.heroLineMask} aria-hidden="true"><span className={`${styles.heroLine} ${styles.heroLineSecond}`}>Твой <span className={styles.heroStickerWord}>текст.</span></span></span>
            </h1>
            <div className={styles.heroFooter}>
              <div className={styles.heroLeadGroup}>
                <p className={styles.heroLead}>NEBO — личный гороскоп, натальная карта и совместимость в одном месте. Можно начать с общего прогноза, а если нужны детали — добавить дату, время и место рождения.</p>
                <a className={styles.heroTextLink} href="#forecast-example">Посмотреть, как это выглядит</a>
              </div>
              <div className={styles.heroAction}><ReleaseAction /><small>Android · RuStore</small></div>
            </div>
          </div>
        </section>

        <section className={seo.seoSection} aria-labelledby="natal-home-title">
          <div className={`${seo.inner} ${seo.split}`}>
            <div className={seo.copy}>
              <p className={seo.kicker}>Натальная карта</p>
              <h2 id="natal-home-title">Посмотри карту рождения по частям.</h2>
              <p>Натальная карта строится по дате, времени и месту рождения. На сайте можно отдельно открыть дома, планеты в знаках и планеты в домах — без необходимости читать огромную статью целиком.</p>
              <p>Если время рождения неизвестно, часть карты всё равно можно посмотреть, но дома и некоторые точки уже нельзя считать такими же надёжными.</p>
              <ul className={seo.linkList}>
                <li><Link href="/natalnaya-karta">Натальная карта по дате рождения</Link></li>
                <li><Link href="/natalnaya-karta/doma">Все 12 домов</Link></li>
                <li><Link href="/natalnaya-karta/planety-v-znakah">Планеты в знаках</Link></li>
                <li><Link href="/natalnaya-karta/planety-v-domah">Планеты в домах</Link></li>
              </ul>
            </div>
            <div className={seo.visual} aria-label="Схема натальной карты">
              <div className={seo.chartVisual}>
                <span className={seo.chartCrossH} />
                <span className={seo.chartCrossV} />
                <span className={seo.chartCenter}>NEBO</span>
              </div>
            </div>
          </div>
        </section>

        <section className={`${seo.seoSection} ${seo.tint}`} aria-labelledby="today-home-title">
          <div className={`${seo.inner} ${seo.split} ${seo.reverse}`}>
            <div className={seo.copy}>
              <p className={seo.kicker}>Гороскоп на сегодня</p>
              <h2 id="today-home-title">Сначала ответ. Потом подробности.</h2>
              <p>Общий гороскоп по знаку можно читать без регистрации и без времени рождения. Для личного прогноза NEBO использует сохранённую карту, поэтому текст получается ближе к конкретному человеку.</p>
              <p>На сайте есть отдельные страницы всех знаков. В приложении — личный прогноз на сегодня, неделю и месяц.</p>
              <ul className={seo.linkList}>
                <li><Link href="/lichnyy-goroskop">Личный гороскоп</Link></li>
                <li><Link href="/goroskop">Гороскопы всех знаков</Link></li>
                <li><Link href="/goroskop/oven">Овен</Link></li>
                <li><Link href="/goroskop/skorpion">Скорпион</Link></li>
              </ul>
            </div>
            <div className={seo.visual}>
              <div className={seo.imageFrame}>
                <Image src="/home/cards/today-hero.webp" alt="Пример экрана личного прогноза NEBO" width={1400} height={788} sizes="(max-width: 820px) 100vw, 48vw" priority />
              </div>
            </div>
          </div>
        </section>

        <section className={styles.forecastSection} id="forecast-example" aria-labelledby="forecast-example-title">
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeadingWide}>
              <p className={styles.eyebrow}>Так звучит NEBO</p>
              <h2 id="forecast-example-title">Два человека. Два разных прогноза.</h2>
              <p className={styles.sectionLead}>Короткий заголовок, нормальный текст и конкретная мысль — без длинной воды перед ответом.</p>
            </div>
            <MeouForecastScrollStory />
          </div>
        </section>

        <section className={seo.seoSection} aria-labelledby="compat-home-title">
          <div className={`${seo.inner} ${seo.split}`}>
            <div className={seo.copy}>
              <p className={seo.kicker}>Совместимость</p>
              <h2 id="compat-home-title">Не процент любви. Нормальное сравнение.</h2>
              <p>Совместимость знаков показывает общую картину. Если добавить данные рождения обоих людей, можно сравнить две натальные карты и увидеть больше различий: как вы разговариваете, реагируете и где чаще можете не понять друг друга.</p>
              <ul className={seo.linkList}>
                <li><Link href="/sovmestimost">Совместимость по двум картам</Link></li>
                <li><Link href="/sovmestimost/znakov">Совместимость знаков зодиака</Link></li>
              </ul>
            </div>
            <div className={seo.visual}>
              <div className={seo.imageFrame}>
                <Image src="/assets/sky-today-bg.webp" alt="Спокойный визуальный фон NEBO" width={1600} height={900} sizes="(max-width: 820px) 100vw, 48vw" />
              </div>
            </div>
          </div>
        </section>

        <section className={styles.functionsSection} id="possibilities" aria-labelledby="possibilities-title">
          <div className={styles.sectionInner}>
            <div className={styles.functionsHeading}>
              <div><p className={styles.eyebrow}>В одном приложении</p><h2 id="possibilities-title">Прогноз, карта и совместимость.</h2></div>
              <p>Основные вещи рядом, без сложной навигации.</p>
            </div>
            <dl className={styles.functionLedger}>
              {productFunctions.map((item) => (
                <div className={styles.functionRow} key={item.title}>
                  <dt><span className={styles.functionNumber} aria-hidden="true">{item.number}</span><Link href={item.href}>{item.title}</Link></dt>
                  <dd>{item.description}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className={`${seo.seoSection} ${seo.tint}`} aria-labelledby="learn-home-title">
          <div className={seo.inner}>
            <div className={seo.copy}>
              <p className={seo.kicker}>Справочник NEBO</p>
              <h2 id="learn-home-title">Если хочется разобраться самому.</h2>
              <p>На сайте постепенно собирается большой справочник по натальной карте, знакам, домам и совместимости. Каждая страница отвечает на один конкретный вопрос и связана с соседними материалами.</p>
            </div>
            <div className={seo.textGrid}>
              <article><h3>Знаки</h3><p>Что обычно связывают с Овном, Тельцом, Близнецами и другими знаками.</p></article>
              <article><h3>Планеты и дома</h3><p>Что означает конкретная планета в знаке или доме и что смотреть рядом.</p></article>
              <article><h3>Совместимость</h3><p>Отдельные страницы пар знаков и переход к сравнению двух карт.</p></article>
            </div>
          </div>
        </section>

        <section className={styles.principlesSection} id="principles" aria-labelledby="principles-title">
          <div className={styles.sectionInner}>
            <div className={styles.principlesManifesto}>
              <div className={styles.principlesCopy}>
                <p className={styles.darkEyebrow}>Без лишних обещаний</p>
                <h2 id="principles-title">NEBO рассказывает. Решения принимаешь ты.</h2>
                <p>Прогноз и разбор карты не заменяют врача, юриста или финансового специалиста и не обещают точное будущее.</p>
              </div>
              <dl className={styles.principleList}>
                <div><dt>Данные рождения вводятся один раз</dt><dd>Карта сохраняется, чтобы не повторять ввод каждый раз.</dd></div>
                <div><dt>Можно начать бесплатно</dt><dd>Базовая карта, общий гороскоп и часть функций доступны без подписки.</dd></div>
                <div><dt>Чужие данные — только с разрешения</dt><dd>Для совместимости используй данные другого человека только с его разрешения.</dd></div>
                <div><dt>Аккаунт можно удалить</dt><dd>Удаление аккаунта и связанных данных доступно в настройках приложения.</dd></div>
              </dl>
            </div>
          </div>
        </section>

        <section className={styles.closingSection} aria-labelledby="release-title">
          <div className={styles.sectionInner}>
            <div className={styles.closing}>
              <div><p className={styles.eyebrow}>NEBO для Android</p><h2 id="release-title">Скоро в RuStore.</h2></div>
              <div className={styles.closingCopy}><p>После публикации здесь появится прямая ссылка на приложение.</p><Link className={styles.closingLink} href="/support">Поддержка и документы</Link></div>
            </div>
          </div>
        </section>
      </main>
    </PublicSiteShell>
  );
}
