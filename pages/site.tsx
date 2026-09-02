import Link from 'next/link';
import { MeouForecastScrollStory } from '../components/public-site/MeouForecastScrollStory';
import {
  PageHead,
  PublicSiteShell,
  ReleaseAction,
  publicSiteStyles as styles,
} from '../components/public-site/PublicSiteShell';
import { PUBLIC_SITE_CONFIG, isRuStorePublished } from '../lib/publicSiteConfig';

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
      availability: isRuStorePublished()
        ? 'https://schema.org/InStock'
        : 'https://schema.org/PreOrder',
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
  {
    number: '01',
    title: 'Личный прогноз',
    href: '/lichnyy-goroskop',
    description: 'Сегодня — несколько коротких фрагментов. Неделя и месяц — одним связным текстом. Без длинных вступлений.',
  },
  {
    number: '02',
    title: 'Гороскоп по знакам',
    href: '/goroskop',
    description: 'Выбери свой знак и посмотри общий гороскоп, когда нужен быстрый ответ без ввода дополнительных данных.',
  },
  {
    number: '03',
    title: 'Совместимость',
    href: '/sovmestimost',
    description: 'Сравни вас двоих: где легко совпадаете, где по-разному реагируете и из-за чего чаще можете цепляться.',
  },
  {
    number: '04',
    title: 'Натальная карта',
    href: '/natalnaya-karta',
    description: 'Добавь дату, время и место рождения. NEBO сохранит карту и поможет понятно разобрать планеты, знаки и дома.',
  },
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
              <span className={styles.heroLineMask} aria-hidden="true">
                <span className={`${styles.heroLine} ${styles.heroLineSecond}`}>Твой <span className={styles.heroStickerWord}>текст.</span></span>
              </span>
            </h1>

            <p className={styles.heroFact}>Сегодня — коротко и по делу</p>

            <div className={styles.heroFooter}>
              <div className={styles.heroLeadGroup}>
                <p className={styles.heroLead}>
                  Открываешь NEBO и читаешь личный прогноз на сегодня, неделю или месяц. Если хочешь больше деталей — добавляешь данные рождения один раз, и карта остаётся сохранённой.
                </p>
                <a className={styles.heroTextLink} href="#forecast-example">Посмотреть примеры</a>
              </div>
              <div className={styles.heroAction}>
                <ReleaseAction />
                <small>Android · RuStore</small>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.forecastSection} id="forecast-example" aria-labelledby="forecast-example-title">
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeadingWide}>
              <p className={styles.eyebrow}>Так звучит NEBO</p>
              <h2 id="forecast-example-title">Два человека. Два разных прогноза.</h2>
              <p className={styles.sectionLead}>Без одинакового текста для всех и без длинной воды перед главной мыслью.</p>
            </div>
            <MeouForecastScrollStory />
          </div>
        </section>

        <section className={styles.functionsSection} id="possibilities" aria-labelledby="possibilities-title">
          <div className={styles.sectionInner}>
            <div className={styles.functionsHeading}>
              <div>
                <p className={styles.eyebrow}>В одном приложении</p>
                <h2 id="possibilities-title">Прогноз, карта и совместимость.</h2>
              </div>
              <p>Никаких спрятанных меню. Основные вещи всегда рядом.</p>
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

        <section className={styles.principlesSection} id="principles" aria-labelledby="principles-title">
          <div className={styles.sectionInner}>
            <div className={styles.principlesManifesto}>
              <div className={styles.principlesCopy}>
                <p className={styles.darkEyebrow}>Без лишних обещаний</p>
                <h2 id="principles-title">NEBO рассказывает. Решения принимаешь ты.</h2>
                <p>
                  Добавь данные рождения, если хочешь более личный результат. NEBO учитывает сохранённую карту, но не обещает точные события и не решает за тебя вопросы здоровья, денег, права или безопасности.
                </p>
              </div>

              <dl className={styles.principleList}>
                <div>
                  <dt>Данные рождения вводятся один раз</dt>
                  <dd>Дата, время и место сохраняются вместе с твоей картой, чтобы не вводить их заново.</dd>
                </div>
                <div>
                  <dt>Личный прогноз учитывает карту</dt>
                  <dd>Поэтому он может быть заметно точнее по формулировкам, чем общий текст для одного знака.</dd>
                </div>
                <div>
                  <dt>Чужие данные — только с разрешения</dt>
                  <dd>Если добавляешь другого человека для совместимости, используй его данные только с его разрешения.</dd>
                </div>
                <div>
                  <dt>Аккаунт можно удалить</dt>
                  <dd>Удаление аккаунта и связанных данных доступно в настройках приложения.</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <section className={styles.closingSection} aria-labelledby="release-title">
          <div className={styles.sectionInner}>
            <div className={styles.closing}>
              <div>
                <p className={styles.eyebrow}>NEBO для Android</p>
                <h2 id="release-title">Скоро в RuStore.</h2>
              </div>
              <div className={styles.closingCopy}>
                <p>После публикации здесь появится прямая ссылка на приложение.</p>
                <Link className={styles.closingLink} href="/support">Поддержка и документы</Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </PublicSiteShell>
  );
}
