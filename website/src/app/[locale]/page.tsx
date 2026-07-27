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

const extraCopy = {
  ru: {
    badge: 'Личное приложение про тебя',
    proof: ['Сегодня, неделя, месяц и год', 'Натальная карта без занудства', 'Совместимость без сладкой лжи'],
    today: 'Сегодня',
    date: 'ВОСКРЕСЕНЬЕ · 26 ИЮЛЯ',
    todayTitle: 'День просит не суетиться там, где уже всё понятно.',
    todayBody: 'Важный разговор лучше не растягивать. Ты и так знаешь, что хочешь сказать.',
    love: 'Любовь',
    loveText: 'Есть шанс наконец договориться без игры в угадайку.',
    natal: 'Натальная карта',
    natalText: 'Сильные стороны, привычные сценарии и то, что ты обычно не замечаешь.',
    compatibility: 'Совместимость',
    compatibilityText: 'Не процент ради процента, а разбор общения, притяжения и сложных мест.',
    ticker: ['Личный прогноз', 'Натальная карта', 'Совместимость', 'Ответы на вопросы', 'Гороскопы по знакам'],
    featuresKicker: 'Всё приложение — на одном сайте',
    featuresTitle: 'Не пять одинаковых карточек. Пять разных причин зайти.',
    featuresBody: 'Каждый раздел отвечает на свой вопрос и ведёт в приложение без мистического тумана и рекламной шелухи.',
    periodKicker: 'Личный прогноз',
    periodTitle: 'Сегодня понятно. Дальше — тоже.',
    periodBody: 'Один персональный разбор развивается по четырём периодам. Не нужно собирать смысл по случайным карточкам.',
    periodTabs: ['Сегодня', 'Неделя', 'Месяц', 'Год'],
    chartKicker: 'Натальная карта',
    chartTitle: 'Не ярлык на всю жизнь. Нормальный разбор характера.',
    chartBody: 'Показываем сильные стороны, повторяющиеся реакции и реальные точки роста — без фатализма и псевдодиагнозов.',
    stepsKicker: 'Как это работает',
    stepsTitle: 'Три шага. Без квеста на двадцать экранов.',
    steps: [
      ['01', 'Выбираешь формат', 'Начни с гороскопа по знаку или сразу перейди к личному разбору.'],
      ['02', 'Добавляешь данные', 'Дата, время и место рождения нужны только для персональных расчётов.'],
      ['03', 'Получаешь разбор', 'Приложение объясняет выводы человеческим языком и показывает, откуда они взялись.'],
    ],
    zodiacKicker: 'Гороскопы по знакам',
    zodiacTitle: 'Быстрый вход, когда не хочется ничего заполнять.',
    guidesKicker: 'Полезные материалы',
    guidesTitle: 'Читайте разборы, которые не заканчиваются словами «доверься Вселенной».',
  },
  en: {
    badge: 'A personal app about you',
    proof: ['Today, week, month, and year', 'A natal chart without jargon', 'Compatibility without sugar-coating'],
    today: 'Today',
    date: 'SUNDAY · JULY 26',
    todayTitle: 'Do not overcomplicate what is already clear.',
    todayBody: 'That important conversation will go better when you stop rehearsing and say the real thing.',
    love: 'Love',
    loveText: 'A direct conversation can finally replace the guessing game.',
    natal: 'Natal chart',
    natalText: 'Strengths, repeating patterns, and the things you usually miss about yourself.',
    compatibility: 'Compatibility',
    compatibilityText: 'Not a random score — communication, attraction, and points of friction.',
    ticker: ['Personal forecast', 'Natal chart', 'Compatibility', 'Personal answers', 'Zodiac horoscopes'],
    featuresKicker: 'The whole app in one place',
    featuresTitle: 'Not five identical cards. Five real reasons to open the app.',
    featuresBody: 'Every section answers a different question and leads to useful content without mystical fog or marketing filler.',
    periodKicker: 'Personal forecast',
    periodTitle: 'Today makes sense. What comes next does too.',
    periodBody: 'One personal reading develops across four timeframes instead of scattering the meaning across random cards.',
    periodTabs: ['Today', 'Week', 'Month', 'Year'],
    chartKicker: 'Natal chart',
    chartTitle: 'Not a life sentence. A useful reading of your patterns.',
    chartBody: 'See strengths, repeating reactions, and practical growth points without fatalism or pseudo-diagnosis.',
    stepsKicker: 'How it works',
    stepsTitle: 'Three steps. No twenty-screen obstacle course.',
    steps: [
      ['01', 'Choose your format', 'Start with a zodiac horoscope or go straight to a personal reading.'],
      ['02', 'Add your details', 'Birth date, time, and place are requested only for personal calculations.'],
      ['03', 'Get the reading', 'The app explains conclusions in plain language and shows what supports them.'],
    ],
    zodiacKicker: 'Zodiac horoscopes',
    zodiacTitle: 'A quick start when you do not want to fill anything in.',
    guidesKicker: 'Useful reading',
    guidesTitle: 'Guides that do not end with “trust the universe.”',
  },
  es: {
    badge: 'Una app personal sobre ti',
    proof: ['Hoy, semana, mes y año', 'Carta natal sin jerga', 'Compatibilidad sin endulzar'],
    today: 'Hoy',
    date: 'DOMINGO · 26 DE JULIO',
    todayTitle: 'No compliques lo que ya está claro.',
    todayBody: 'Esa conversación importante irá mejor cuando dejes de ensayarla y digas lo que de verdad piensas.',
    love: 'Amor',
    loveText: 'Hablar claro puede sustituir por fin el juego de adivinar.',
    natal: 'Carta natal',
    natalText: 'Fortalezas, patrones repetidos y detalles que no siempre ves en ti.',
    compatibility: 'Compatibilidad',
    compatibilityText: 'No un porcentaje al azar: comunicación, atracción y puntos de fricción.',
    ticker: ['Pronóstico personal', 'Carta natal', 'Compatibilidad', 'Respuestas personales', 'Horóscopos por signo'],
    featuresKicker: 'Toda la app en un solo lugar',
    featuresTitle: 'No son cinco tarjetas iguales. Son cinco razones reales para entrar.',
    featuresBody: 'Cada sección responde a una pregunta distinta y lleva a contenido útil, sin niebla mística ni relleno comercial.',
    periodKicker: 'Pronóstico personal',
    periodTitle: 'Hoy queda claro. Lo que viene después, también.',
    periodBody: 'Una lectura personal se desarrolla en cuatro períodos, sin repartir el sentido entre tarjetas aleatorias.',
    periodTabs: ['Hoy', 'Semana', 'Mes', 'Año'],
    chartKicker: 'Carta natal',
    chartTitle: 'No es una sentencia. Es una lectura útil de tus patrones.',
    chartBody: 'Muestra fortalezas, reacciones repetidas y puntos de crecimiento sin fatalismo ni pseudodiagnósticos.',
    stepsKicker: 'Cómo funciona',
    stepsTitle: 'Tres pasos. Sin una carrera de veinte pantallas.',
    steps: [
      ['01', 'Elige el formato', 'Empieza por tu signo o pasa directamente a una lectura personal.'],
      ['02', 'Añade tus datos', 'Fecha, hora y lugar de nacimiento solo se piden para cálculos personales.'],
      ['03', 'Recibe la lectura', 'La app explica las conclusiones con claridad y muestra en qué se apoyan.'],
    ],
    zodiacKicker: 'Horóscopos por signo',
    zodiacTitle: 'Una entrada rápida cuando no quieres rellenar nada.',
    guidesKicker: 'Contenido útil',
    guidesTitle: 'Guías que no terminan con “confía en el universo”.',
  },
} as const;

export default async function LocaleHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const extra = extraCopy[locale];
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

      <section className="hero hero-home">
        <div className="shell hero-grid">
          <div className="hero-copy">
            <p className="hero-badge">{extra.badge}</p>
            <p className="eyebrow">{dict.hero.eyebrow}</p>
            <h1>{dict.hero.title}</h1>
            <p className="lead">{dict.hero.body}</p>
            <div className="hero-actions">
              <Link className="button" href={`/${locale}#features`}>{dict.hero.primary}</Link>
              <Link className="button secondary" href={`/${locale}/guides`}>{dict.hero.secondary}</Link>
            </div>
            <ul className="hero-proof" aria-label={extra.badge}>
              {extra.proof.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>

          <div className="product-stage" aria-label={`${brands[locale]} product preview`}>
            <span className="stage-orb stage-orb-one" />
            <span className="stage-orb stage-orb-two" />
            <div className="phone phone-main">
              <div className="phone-top"><span>{extra.today}</span><span>•••</span></div>
              <p className="phone-date">{extra.date}</p>
              <h2>{extra.todayTitle}</h2>
              <p>{extra.todayBody}</p>
              <div className="phone-topic phone-topic-love"><span>{extra.love}</span><strong>{extra.loveText}</strong></div>
            </div>
            <div className="phone phone-side">
              <div className="mini-chart" aria-hidden="true"><span /><span /><span /><span /></div>
              <p className="phone-kicker">{extra.natal}</p>
              <strong>{extra.natalText}</strong>
            </div>
            <div className="floating-note">
              <span>87%</span>
              <strong>{extra.compatibility}</strong>
              <p>{extra.compatibilityText}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="value-strip" aria-hidden="true">
        <div className="value-track">
          {[...extra.ticker, ...extra.ticker].map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}
        </div>
      </div>

      <section className="section feature-section" id="features">
        <div className="shell">
          <div className="section-heading section-heading-wide">
            <div><p className="eyebrow">{extra.featuresKicker}</p><h2>{extra.featuresTitle}</h2></div>
            <p>{extra.featuresBody}</p>
          </div>
          <div className="feature-bento">
            {features.map(([slug, item], index) => (
              <article className={`feature-card feature-${slug} feature-card-${index + 1}`} key={slug}>
                <span className="feature-index">0{index + 1}</span>
                <div><h3>{item.title}</h3><p>{item.body}</p></div>
                <Link href={`/${locale}/${slug}`}>{dict.common.readMore} <span aria-hidden="true">↗</span></Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section product-story-section">
        <div className="shell product-story-grid">
          <article className="story-card story-card-period">
            <div className="story-copy">
              <p className="eyebrow">{extra.periodKicker}</p>
              <h2>{extra.periodTitle}</h2>
              <p>{extra.periodBody}</p>
              <Link className="text-button" href={`/${locale}/personal-horoscope`}>{dict.common.readMore} →</Link>
            </div>
            <div className="period-demo">
              <div className="period-tabs">{extra.periodTabs.map((tab, index) => <span className={index === 0 ? 'active' : ''} key={tab}>{tab}</span>)}</div>
              <div className="period-line period-line-long" />
              <div className="period-line" />
              <div className="period-block period-block-blue" />
              <div className="period-line period-line-short" />
            </div>
          </article>

          <article className="story-card story-card-chart">
            <div className="chart-art" aria-hidden="true">
              <span className="chart-ring chart-ring-one" />
              <span className="chart-ring chart-ring-two" />
              <span className="chart-dot chart-dot-one" />
              <span className="chart-dot chart-dot-two" />
              <span className="chart-dot chart-dot-three" />
            </div>
            <div className="story-copy">
              <p className="eyebrow">{extra.chartKicker}</p>
              <h2>{extra.chartTitle}</h2>
              <p>{extra.chartBody}</p>
              <Link className="text-button" href={`/${locale}/natal-chart`}>{dict.common.readMore} →</Link>
            </div>
          </article>
        </div>
      </section>

      <section className="section steps-section">
        <div className="shell">
          <div className="section-heading section-heading-wide">
            <div><p className="eyebrow">{extra.stepsKicker}</p><h2>{extra.stepsTitle}</h2></div>
          </div>
          <div className="steps-grid">
            {extra.steps.map(([number, title, body]) => (
              <article className="step-card" key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section zodiac-section">
        <div className="shell">
          <div className="section-heading section-heading-wide">
            <div><p className="eyebrow">{extra.zodiacKicker}</p><h2>{extra.zodiacTitle}</h2></div>
            <Link className="button secondary" href={`/${locale}/zodiac`}>{dict.common.allSigns}</Link>
          </div>
          <div className="sign-grid sign-grid-home">
            {zodiacSlugs.map((sign, index) => {
              const info = getZodiacInfo(locale, sign);
              return <Link className={`sign-card sign-card-${(index % 6) + 1}`} key={sign} href={`/${locale}/zodiac/${sign}`}><strong>{info.name}</strong><span>{info.dates}</span><b aria-hidden="true">↗</b></Link>;
            })}
          </div>
        </div>
      </section>

      {guides.length > 0 ? (
        <section className="section guides-section">
          <div className="shell">
            <div className="section-heading section-heading-wide">
              <div><p className="eyebrow">{extra.guidesKicker}</p><h2>{extra.guidesTitle}</h2></div>
              <Link className="button secondary" href={`/${locale}/guides`}>{dict.common.allGuides}</Link>
            </div>
            <div className="article-grid">
              {guides.map((guide) => <ArticleCard key={guide.frontmatter.slug} href={`/${locale}/guides/${guide.frontmatter.slug}`} title={guide.frontmatter.title} description={guide.frontmatter.description} meta={guide.frontmatter.publishedAt} />)}
            </div>
          </div>
        </section>
      ) : null}

      <section className="section final-section">
        <div className="shell final-cta">
          <div><p className="eyebrow">{brands[locale]}</p><h2>{dict.home.finalTitle}</h2><p>{dict.home.finalBody}</p></div>
          <StoreButtons fallback={dict.common.comingSoon} />
        </div>
      </section>
    </>
  );
}
