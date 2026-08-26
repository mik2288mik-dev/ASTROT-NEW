import Link from 'next/link';
import { MeouForecastScrollStory } from '../components/public-site/MeouForecastScrollStory';
import {
  PageHead,
  PublicSiteShell,
  ReleaseAction,
  publicSiteStyles as styles,
} from '../components/public-site/PublicSiteShell';
import { PUBLIC_SITE_CONFIG, isRuStorePublished } from '../lib/publicSiteConfig';

const pageDescription = `${PUBLIC_SITE_CONFIG.appName}: персональный гороскоп на сегодня, неделю и месяц по сохранённой натальной карте. В приложении также есть натальная карта, совместимость и гороскопы по знакам.`;

function homeSchema() {
  const software: Record<string, unknown> = {
    '@type': 'SoftwareApplication',
    '@id': `${PUBLIC_SITE_CONFIG.baseUrl}/#application`,
    name: PUBLIC_SITE_CONFIG.appName,
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
        name: PUBLIC_SITE_CONFIG.appName,
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
    title: 'Дневник',
    href: '/lichnyy-goroskop',
    description:
      'Сегодня читается как лента из 4–6 связанных фрагментов. Неделя и месяц идут цельным текстом. Каждый период складывается в одну историю.',
  },
  {
    number: '02',
    title: 'Гороскоп по знакам',
    href: '/goroskop',
    description:
      'Общий прогноз для каждого знака живёт в отдельном разделе. Это знакомый формат, когда хочется посмотреть день именно по знаку.',
  },
  {
    number: '03',
    title: 'Совместимость',
    href: '/sovmestimost',
    description:
      'Сравни две карты и посмотри, где вы легко совпадаете, а где привычно спорите. Результат объясняет сильные точки пары и разницу в реакциях.',
  },
  {
    number: '04',
    title: 'Карта',
    href: '/natalnaya-karta',
    description:
      'Дата, время и место рождения складываются в натальную карту с понятным разбором. Карта сохраняется, поэтому вводить данные заново не придётся.',
  },
] as const;

export default function PublicLandingPage() {
  return (
    <PublicSiteShell>
      <PageHead
        title={`${PUBLIC_SITE_CONFIG.appName}: личный гороскоп, натальная карта и совместимость`}
        description={pageDescription}
        path="/"
        jsonLd={homeSchema()}
      />
      <main id="main-content" className={styles.homeMain}>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroInner}>
            <p className={styles.heroEyebrow}>{PUBLIC_SITE_CONFIG.appName} · личный прогноз</p>
            <h1
              id="hero-title"
              className={styles.heroTitle}
              aria-label="Твой день. Твой текст."
            >
              <span className={styles.heroLineMask} aria-hidden="true">
                <span className={styles.heroLine}>Твой день.</span>
              </span>
              <span className={styles.heroLineMask} aria-hidden="true">
                <span className={`${styles.heroLine} ${styles.heroLineSecond}`}>
                  Твой <span className={styles.heroStickerWord}>текст.</span>
                </span>
              </span>
            </h1>

            <p className={styles.heroFact}>Сегодня: 4–6 фрагментов</p>

            <div className={styles.heroFooter}>
              <div className={styles.heroLeadGroup}>
                <p className={styles.heroLead}>
                  Выбираешь период и читаешь личный прогноз по сохранённой натальной карте. Сегодня
                  это 4–6 связанных фрагментов. Неделя и месяц идут одним цельным текстом.
                </p>
                <a className={styles.heroTextLink} href="#forecast-example">
                  Прочитать два прогноза
                </a>
              </div>
              <div className={styles.heroAction}>
                <ReleaseAction />
                <small>Android. Первый релиз готовится для RuStore.</small>
              </div>
            </div>
          </div>
        </section>

        <section
          className={styles.forecastSection}
          id="forecast-example"
          aria-labelledby="forecast-example-title"
        >
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeadingWide}>
              <p className={styles.eyebrow}>Так звучит личный прогноз</p>
              <h2 id="forecast-example-title">Два человека. Два разных прогноза.</h2>
              <p className={styles.sectionLead}>
                Имена нужны только для различия примеров. В самом прогнозе они не показываются.
              </p>
            </div>
            <MeouForecastScrollStory />
          </div>
        </section>

        <section
          className={styles.functionsSection}
          id="possibilities"
          aria-labelledby="possibilities-title"
        >
          <div className={styles.sectionInner}>
            <div className={styles.functionsHeading}>
              <div>
                <p className={styles.eyebrow}>Кроме личного прогноза</p>
                <h2 id="possibilities-title">Что ещё есть в приложении.</h2>
              </div>
              <p>
                Дневник, гороскопы по знакам, совместимость и натальная карта собраны в четырёх
                понятных разделах.
              </p>
            </div>

            <dl className={styles.functionLedger}>
              {productFunctions.map((item) => (
                <div className={styles.functionRow} key={item.title}>
                  <dt>
                    <span className={styles.functionNumber} aria-hidden="true">
                      {item.number}
                    </span>
                    <Link href={item.href}>{item.title}</Link>
                  </dt>
                  <dd>{item.description}</dd>
                </div>
              ))}
            </dl>
            <p className={styles.functionsSticker}>Всё по делу</p>
          </div>
        </section>

        <section
          className={styles.principlesSection}
          id="principles"
          aria-labelledby="principles-title"
        >
          <div className={styles.sectionInner}>
            <div className={styles.principlesManifesto}>
              <div className={styles.principlesCopy}>
                <p className={styles.darkEyebrow}>Как это работает</p>
                <h2 id="principles-title">Карта считается отдельно. Текст пишется отдельно.</h2>
                <p>
                  Дата, время и место рождения используются для расчёта карты. Для личного прогноза
                  ИИ получает выбранный период и данные сохранённой карты. Решения о здоровье,
                  деньгах, праве и безопасности остаются за человеком и профильным специалистом.
                </p>
                <p className={styles.principlesSticker}>Расчёт + текст</p>
              </div>

              <dl className={styles.principleList}>
                <div>
                  <dt>Карта считается отдельно</dt>
                  <dd>
                    Дата, время и место рождения идут в расчёт натальной карты. Сохранённая карта
                    становится основой для личного текста.
                  </dd>
                </div>
                <div>
                  <dt>Решения остаются твоими</dt>
                  <dd>
                    Здоровье, деньги, право и безопасность требуют профильного специалиста. MEOU
                    оставляет решения в этих темах тебе.
                  </dd>
                </div>
                <div>
                  <dt>Данные другого человека с разрешением</dt>
                  <dd>
                    Перед добавлением данных другого человека нужно его разрешение или другое
                    законное основание.
                  </dd>
                </div>
                <div>
                  <dt>Удаление в настройках</dt>
                  <dd>
                    Аккаунт и связанные данные можно удалить в приложении после подтверждения.
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <section className={styles.closingSection} aria-labelledby="release-title">
          <div className={styles.sectionInner}>
            <div className={styles.closing}>
              <div>
                <p className={styles.eyebrow}>Первый релиз</p>
                <h2 id="release-title">
                  {PUBLIC_SITE_CONFIG.appName} готовится к публикации в RuStore.
                </h2>
              </div>
              <div className={styles.closingCopy}>
                <p>
                  Ссылка станет активной после публикации карточки. Сейчас сайт показывает текущий
                  статус релиза.
                </p>
                <Link className={styles.closingLink} href="/support">
                  Открыть поддержку и документы
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </PublicSiteShell>
  );
}
