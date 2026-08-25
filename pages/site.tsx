import Image from 'next/image';
import Link from 'next/link';
import {
  PageHead,
  PublicSiteShell,
  ReleaseAction,
  publicSiteStyles as styles,
} from '../components/public-site/PublicSiteShell';
import { PUBLIC_SITE_CONFIG, isRuStorePublished } from '../lib/publicSiteConfig';

const pageDescription =
  'MEOU: личные прогнозы на сегодня, неделю и месяц, натальная карта с расшифровкой, совместимость и бесплатный гороскоп для всех знаков зодиака.';

const zodiacSigns = [
  'Овен',
  'Телец',
  'Близнецы',
  'Рак',
  'Лев',
  'Дева',
  'Весы',
  'Скорпион',
  'Стрелец',
  'Козерог',
  'Водолей',
  'Рыбы',
] as const;

function homeSchema() {
  const organizationId = `${PUBLIC_SITE_CONFIG.baseUrl}/#organization`;
  const software: Record<string, unknown> = {
    '@type': 'SoftwareApplication',
    '@id': `${PUBLIC_SITE_CONFIG.baseUrl}/#application`,
    name: 'MEOU',
    url: PUBLIC_SITE_CONFIG.baseUrl,
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Android',
    inLanguage: 'ru-RU',
    description: pageDescription,
    publisher: { '@id': organizationId },
  };

  if (isRuStorePublished()) {
    software.downloadUrl = PUBLIC_SITE_CONFIG.rustoreUrl;
    software.offers = {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'RUB',
      availability: 'https://schema.org/InStock',
    };
  }

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: 'MEOU',
        url: PUBLIC_SITE_CONFIG.baseUrl,
        logo: `${PUBLIC_SITE_CONFIG.baseUrl}/assets/brand/personal-horoscope-mark.svg`,
      },
      {
        '@type': 'WebSite',
        '@id': `${PUBLIC_SITE_CONFIG.baseUrl}/#website`,
        name: 'MEOU',
        url: PUBLIC_SITE_CONFIG.baseUrl,
        inLanguage: 'ru-RU',
        description: pageDescription,
        publisher: { '@id': organizationId },
      },
      software,
    ],
  };
}

export default function PublicLandingPage() {
  return (
    <PublicSiteShell>
      <PageHead
        title="MEOU: гороскоп, натальная карта и совместимость"
        description={pageDescription}
        path="/"
        jsonLd={homeSchema()}
      />
      <main id="main-content">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>Приложение MEOU для Android</p>
              <h1 id="hero-title">Личные прогнозы, натальная карта и совместимость</h1>
              <p>
                Смотрите личный прогноз на сегодня, неделю и месяц. Изучайте свою натальную карту,
                проверяйте совместимость и читайте бесплатный гороскоп для любого знака зодиака.
                Всё в одном месте и обычными словами.
              </p>
              <div className={styles.heroAction}>
                <ReleaseAction />
                <small>Первый релиз для Android уже готовится.</small>
              </div>
            </div>
            <div className={styles.heroVisual} aria-hidden="true">
              <Image
                className={styles.heroImage}
                src="/home/cards/today-hero.webp"
                alt=""
                width={1400}
                height={788}
                priority
                sizes="(max-width: 928px) 100vw, 46vw"
              />
              <Image
                className={styles.heroMark}
                src="/assets/brand/personal-horoscope-mark.svg"
                alt=""
                width={672}
                height={511}
              />
            </div>
          </div>
        </section>

        <section className={styles.sectionTint} id="possibilities" aria-labelledby="possibilities-title">
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeading}>
              <p className={styles.eyebrow}>Всё в одном приложении</p>
              <h2 id="possibilities-title">Откройте то, что важно именно сейчас</h2>
              <p>
                Начните с прогноза на сегодня, загляните в свою карту или посмотрите совместимость
                с близким человеком. Не нужно разбираться в сложных терминах.
              </p>
            </div>
            <dl className={styles.benefitGrid}>
              <div className={styles.benefit}>
                <dt>Личный прогноз</dt>
                <dd>Прогноз на сегодня, неделю и месяц с учётом ваших данных рождения.</dd>
              </div>
              <div className={styles.benefit}>
                <dt>Гороскоп по знаку</dt>
                <dd>Бесплатный прогноз на сегодня для всех двенадцати знаков зодиака.</dd>
              </div>
              <div className={styles.benefit}>
                <dt>Натальная карта</dt>
                <dd>Карта рождения и понятный разбор характера, сильных сторон и привычных реакций.</dd>
              </div>
              <div className={styles.benefit}>
                <dt>Совместимость знаков зодиака</dt>
                <dd>Быстрое сравнение по знакам и подробный разбор по двум натальным картам.</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className={styles.section} id="signs" aria-labelledby="signs-title">
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeading}>
              <p className={styles.eyebrow}>Бесплатный гороскоп по знакам</p>
              <h2 id="signs-title">Прогноз на сегодня для каждого знака зодиака</h2>
              <p>
                В MEOU можно выбрать свой знак и сразу посмотреть прогноз на день. Бесплатный
                гороскоп на сегодня доступен для Овна, Тельца, Близнецов, Рака, Льва, Девы, Весов,
                Скорпиона, Стрельца, Козерога, Водолея и Рыб.
              </p>
            </div>
            <ul className={styles.zodiacList} aria-label="Все знаки зодиака">
              {zodiacSigns.map((sign) => <li key={sign}>{sign}</li>)}
            </ul>
            <p className={styles.sectionNote}>Гороскоп на неделю и месяц доступен в Premium.</p>
          </div>
        </section>

        <section className={styles.sectionTint} aria-labelledby="personal-title">
          <div className={styles.sectionInner}>
            <div className={styles.featureSplit}>
              <div className={styles.featureMedia}>
                <Image
                  className={styles.featureImage}
                  src="/home/cards/natal-map.webp"
                  alt="Рабочий стол с планшетом и материалами для личного разбора"
                  width={1400}
                  height={788}
                  sizes="(max-width: 928px) 100vw, 50vw"
                />
              </div>
              <div className={styles.featureCopy}>
                <p className={styles.eyebrow}>Натальная карта</p>
                <h2 id="personal-title">Узнайте себя глубже, чем по одному знаку</h2>
                <p>
                  Введите дату, время и место рождения. MEOU построит натальную карту с понятной
                  расшифровкой: как вы думаете, общаетесь, реагируете и в чём ваши сильные стороны.
                </p>
                <dl className={styles.featureList}>
                  <div>
                    <dt>Базовая натальная карта бесплатно</dt>
                    <dd>Основные положения и первый личный разбор доступны без Premium.</dd>
                  </div>
                  <div>
                    <dt>Больше тем в Premium</dt>
                    <dd>Откройте подробный разбор отношений, талантов и других важных сторон.</dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className={`${styles.featureSplit} ${styles.featureSplitReverse}`}>
              <div className={styles.featureMedia}>
                <Image
                  className={styles.featureImage}
                  src="/home/cards/compatibility.webp"
                  alt="Два человека разговаривают за столом"
                  width={1400}
                  height={788}
                  loading="lazy"
                  sizes="(max-width: 928px) 100vw, 50vw"
                />
              </div>
              <div className={styles.featureCopy}>
                <p className={styles.eyebrow}>Совместимость</p>
                <h2>Посмотрите, как вы понимаете друг друга</h2>
                <p>
                  Выберите два знака для быстрого сравнения. Если нужны детали, добавьте данные
                  рождения двух людей и откройте разбор по натальным картам.
                </p>
                <dl className={styles.featureList}>
                  <div>
                    <dt>По знакам бесплатно</dt>
                    <dd>Узнайте, где вам легко договориться, а где реакции могут не совпадать.</dd>
                  </div>
                  <div>
                    <dt>По двум картам в Premium</dt>
                    <dd>Подробное сравнение учитывает натальные карты обоих людей.</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section} id="free" aria-labelledby="free-title">
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeading}>
              <p className={styles.eyebrow}>Можно начать бесплатно</p>
              <h2 id="free-title">Сначала попробуйте главное</h2>
              <p>
                Без подписки можно открыть личный прогноз на сегодня, гороскоп по знаку, базовую
                натальную карту и совместимость по знакам. Premium добавляет полные прогнозы и
                подробные разборы.
              </p>
            </div>
            <dl className={styles.principles}>
              <div>
                <dt>Личный прогноз на сегодня</dt>
                <dd>Главная часть прогноза доступна бесплатно.</dd>
              </div>
              <div>
                <dt>Гороскоп по знаку</dt>
                <dd>Бесплатный прогноз на день для любого из двенадцати знаков.</dd>
              </div>
              <div>
                <dt>Карта и совместимость</dt>
                <dd>Базовая натальная карта и сравнение по знакам тоже доступны бесплатно.</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="release-title">
          <div className={styles.sectionInner}>
            <div className={styles.closing}>
              <p className={styles.eyebrow}>Скоро в RuStore</p>
              <h2 id="release-title">MEOU готовится к первому релизу</h2>
              <p>
                После публикации здесь появится официальная кнопка RuStore. Одно нажатие, и можно
                будет скачать MEOU на Android.
              </p>
              <Link href="/support">Поддержка и документы</Link>
            </div>
          </div>
        </section>
      </main>
    </PublicSiteShell>
  );
}
