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
import space from '../styles/SpaceHome.module.css';

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

      <main id="main-content" className={`${styles.homeMain} ${space.home}`}>
        <section className={`${styles.hero} ${space.heroSpace}`} aria-labelledby="hero-title">
          <div className={styles.heroInner}>
            <p className={`${styles.heroEyebrow} ${space.heroBadge}`}>{PUBLIC_BRAND} · личный прогноз</p>
            <h1 id="hero-title" className={styles.heroTitle} aria-label="Твой день. Твой текст.">
              <span className={styles.heroLineMask} aria-hidden="true"><span className={styles.heroLine}>Твой день.</span></span>
              <span className={styles.heroLineMask} aria-hidden="true"><span className={`${styles.heroLine} ${styles.heroLineSecond} ${space.heroTone}`}>Твой <span className={styles.heroStickerWord}>текст.</span></span></span>
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

        <section className={`${seo.seoSection} ${space.spaceSection} ${space.nebula}`} aria-labelledby="natal-home-title">
          <div className={`${seo.inner} ${seo.split}`}>
            <div className={`${seo.copy} ${space.contentPlate}`}>
              <p className={seo.kicker}>Натальная карта</p>
              <h2 id="natal-home-title">Натальная карта по дате рождения.</h2>
              <p>Введи дату, время и место рождения, чтобы построить свою карту. Потом можно отдельно смотреть дома, планеты в знаках и планеты в домах — без длинного вступления перед ответом.</p>
              <p>Если точное время неизвестно, часть карты всё равно можно посмотреть. Для домов и некоторых положений точное время уже важно.</p>
              <ul className={seo.linkList}>
                <li><Link href="/natalnaya-karta">Рассчитать натальную карту</Link></li>
                <li><Link href="/natalnaya-karta/doma">12 домов натальной карты</Link></li>
                <li><Link href="/natalnaya-karta/planety-v-znakah">Планеты в знаках</Link></li>
                <li><Link href="/natalnaya-karta/planety-v-domah">Планеты в домах</Link></li>
              </ul>
              <div className={space.warmLine} aria-hidden="true" />
            </div>
            <div className={seo.visual} aria-hidden="true">
              <div className={`${space.visualFrame} ${space.galaxyCard}`}>
                <div className={space.visualCopy}><span>NEBO · карта рождения</span><strong>Дата. Время. Место.</strong></div>
              </div>
            </div>
          </div>
        </section>

        <section className={`${seo.seoSection} ${space.spaceSection} ${space.cloud}`} aria-labelledby="today-home-title">
          <div className={`${seo.inner} ${seo.split} ${seo.reverse}`}>
            <div className={`${seo.copy} ${space.contentPlate}`}>
              <p className={seo.kicker}>Гороскоп на сегодня</p>
              <h2 id="today-home-title">Сначала ответ. Потом подробности.</h2>
              <p>Гороскоп на сегодня по знаку можно читать сразу. Для личного прогноза NEBO учитывает сохранённые данные рождения и показывает отдельный текст именно для твоей карты.</p>
              <p>На сайте можно открыть гороскоп своего знака. В приложении — личный прогноз на сегодня, неделю и месяц.</p>
              <ul className={seo.linkList}>
                <li><Link href="/lichnyy-goroskop">Личный гороскоп</Link></li>
                <li><Link href="/goroskop">Гороскоп на сегодня для всех знаков</Link></li>
                <li><Link href="/goroskop/oven">Гороскоп для Овна</Link></li>
                <li><Link href="/goroskop/skorpion">Гороскоп для Скорпиона</Link></li>
              </ul>
            </div>
            <div className={seo.visual}>
              <div className={seo.imageFrame}>
                <Image src="/home/cards/today-hero.webp" alt="Пример экрана личного прогноза NEBO" width={1400} height={788} sizes="(max-width: 820px) 100vw, 48vw" priority />
              </div>
            </div>
          </div>
        </section>

        <section className={`${styles.forecastSection} ${space.forecastDark}`} id="forecast-example" aria-labelledby="forecast-example-title">
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeadingWide}>
              <p className={styles.eyebrow}>Так звучит NEBO</p>
              <h2 id="forecast-example-title">Два человека. Два разных прогноза.</h2>
              <p className={styles.sectionLead}>Короткий заголовок, нормальный текст и конкретная мысль — без длинной воды перед ответом.</p>
            </div>
            <MeouForecastScrollStory />
          </div>
        </section>

        <section className={`${seo.seoSection} ${space.spaceSection} ${space.spiral}`} aria-labelledby="compat-home-title">
          <div className={`${seo.inner} ${seo.split}`}>
            <div className={`${seo.copy} ${space.contentPlate}`}>
              <p className={seo.kicker}>Совместимость</p>
              <h2 id="compat-home-title">Совместимость без случайного процента.</h2>
              <p>Совместимость знаков даёт общую картину пары. Если добавить даты рождения обоих людей, можно сравнить две карты и посмотреть, где вы быстрее понимаете друг друга, а где чаще расходятся реакции.</p>
              <ul className={seo.linkList}>
                <li><Link href="/sovmestimost">Совместимость по датам рождения</Link></li>
                <li><Link href="/sovmestimost/znakov">Совместимость знаков зодиака</Link></li>
              </ul>
            </div>
            <div className={seo.visual} aria-hidden="true">
              <div className={`${space.visualFrame} ${space.cloudCard}`}>
                <div className={space.visualCopy}><span>NEBO · совместимость</span><strong>Сравни вас двоих.</strong></div>
              </div>
            </div>
          </div>
        </section>

        <section className={`${styles.functionsSection} ${space.functionsDark}`} id="possibilities" aria-labelledby="possibilities-title">
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

        <section className={`${seo.seoSection} ${space.spaceSection} ${space.nebula}`} aria-labelledby="learn-home-title">
          <div className={seo.inner}>
            <div className={`${seo.copy} ${space.contentPlate}`}>
              <p className={seo.kicker}>Справочник NEBO</p>
              <h2 id="learn-home-title">Найди конкретный ответ.</h2>
              <p>Знаки зодиака, дома натальной карты, планеты в знаках, планеты в домах и совместимость собраны в отдельных понятных разделах. Можно открыть именно то, что сейчас нужно, и перейти к связанным страницам.</p>
            </div>
            <div className={seo.textGrid}>
              <article><h3>Знаки зодиака</h3><p>Характер знаков и общий гороскоп на сегодня.</p></article>
              <article><h3>Планеты и дома</h3><p>Что означает конкретная планета в знаке или доме.</p></article>
              <article><h3>Совместимость</h3><p>Пары знаков и сравнение двух карт по данным рождения.</p></article>
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

        <section className={`${styles.closingSection} ${space.closingDark}`} aria-labelledby="release-title">
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
