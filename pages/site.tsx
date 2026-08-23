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
  'MEOU — персональный гороскоп на сегодня, неделю и месяц, натальная карта, личностный разбор и совместимость по данным рождения.';

function homeSchema() {
  const software: Record<string, unknown> = {
    '@type': 'SoftwareApplication',
    '@id': `${PUBLIC_SITE_CONFIG.baseUrl}/#application`,
    name: 'MEOU',
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
        name: 'MEOU',
        url: PUBLIC_SITE_CONFIG.baseUrl,
        inLanguage: 'ru-RU',
        description: pageDescription,
      },
      software,
    ],
  };
}

export default function PublicLandingPage() {
  return (
    <PublicSiteShell>
      <PageHead
        title="MEOU — персональный гороскоп и натальная карта"
        description={pageDescription}
        path="/"
        jsonLd={homeSchema()}
      />
      <main id="main-content">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>MEOU · личный прогноз</p>
              <h1 id="hero-title">Не общий гороскоп на весь знак.</h1>
              <p>
                MEOU пишет персональные прогнозы на сегодня, неделю и месяц по сохранённой
                натальной карте — коротко, по-человечески и без обещаний предсказать судьбу.
              </p>
              <div className={styles.heroAction}>
                <ReleaseAction />
                <small>Android · первый релиз готовится для RuStore.</small>
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
              <p className={styles.eyebrow}>Что уже есть в продукте</p>
              <h2 id="possibilities-title">Одна карта — несколько способов посмотреть на себя.</h2>
              <p>
                Приложение не показывает выдуманные события и не заменяет специалиста. Оно
                превращает данные карты в понятный персональный текст и сохраняет контекст между
                чтениями.
              </p>
            </div>
            <dl className={styles.benefitGrid}>
              <div className={styles.benefit}>
                <dt>Сегодня</dt>
                <dd>Непрерывный персональный текст из нескольких коротких фрагментов.</dd>
              </div>
              <div className={styles.benefit}>
                <dt>Неделя и месяц</dt>
                <dd>По одной цельной истории на выбранный период, без календарной дробилки.</dd>
              </div>
              <div className={styles.benefit}>
                <dt>Натальная карта</dt>
                <dd>Рассчитанная карта и личностный разбор, который можно перечитывать.</dd>
              </div>
              <div className={styles.benefit}>
                <dt>Совместимость</dt>
                <dd>Сопоставление двух сохранённых карт по данным рождения.</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="personal-title">
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
                <p className={styles.eyebrow}>Личная карта</p>
                <h2 id="personal-title">Данные рождения превращаются в связный разбор.</h2>
                <p>
                  MEOU рассчитывает натальную карту отдельно от ИИ-текста. Разбор опирается на
                  сохранённые положения и связи в карте, а не на случайный набор общих фраз.
                </p>
                <dl className={styles.featureList}>
                  <div>
                    <dt>Карта сохраняется</dt>
                    <dd>Не нужно заново вводить дату, время и место для каждого чтения.</dd>
                  </div>
                  <div>
                    <dt>Прогноз не притворяется расчётом</dt>
                    <dd>Периодный текст пишет ИИ; MEOU не приписывает ему несуществующие транзиты.</dd>
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
                <h2>Не оценка отношений, а материал для разговора.</h2>
                <p>
                  Можно сохранить карту другого человека и посмотреть, где вы легко понимаете друг
                  друга, а где привычные реакции расходятся. Имя используется только как подпись;
                  лишние сведения вводить не нужно.
                </p>
                <dl className={styles.featureList}>
                  <div>
                    <dt>Две реальные карты</dt>
                    <dd>Совместимость строится по данным рождения, а не только по знакам зодиака.</dd>
                  </div>
                  <div>
                    <dt>Ответственность за чужие данные</dt>
                    <dd>Добавлять сведения другого человека можно только с законным основанием.</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.sectionTint} id="principles" aria-labelledby="principles-title">
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeading}>
              <p className={styles.eyebrow}>Без лишнего шума</p>
              <h2 id="principles-title">Lifestyle-приложение, а не инструкция к жизни.</h2>
              <p>
                Прогнозы MEOU относятся к персонализированному развлекательному и информационному
                контенту. Решения о здоровье, деньгах, праве и безопасности требуют профильного
                специалиста.
              </p>
            </div>
            <dl className={styles.principles}>
              <div>
                <dt>Без гарантий событий</dt>
                <dd>Никаких обещаний стопроцентной точности или заранее известного будущего.</dd>
              </div>
              <div>
                <dt>Без trackers на сайте</dt>
                <dd>Публичный сайт не ставит рекламные пиксели и не собирает заявки через формы.</dd>
              </div>
              <div>
                <dt>Удаление из приложения</dt>
                <dd>Аккаунт и связанные данные можно удалить в Настройках после подтверждения.</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="release-title">
          <div className={styles.sectionInner}>
            <div className={styles.closing}>
              <p className={styles.eyebrow}>Первый релиз</p>
              <h2 id="release-title">MEOU готовится к публикации в RuStore.</h2>
              <p>
                Ссылка появится здесь после публикации карточки. До этого сайт не показывает
                поддельный бейдж и не ведёт на чужое приложение.
              </p>
              <Link href="/support">Открыть поддержку и документы</Link>
            </div>
          </div>
        </section>
      </main>
    </PublicSiteShell>
  );
}
