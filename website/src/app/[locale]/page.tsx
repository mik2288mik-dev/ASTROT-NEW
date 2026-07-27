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

const homeCopy = {
  ru: {
    status: 'Личный прогноз, натальная карта и совместимость',
    heroNote: 'Одно приложение для тех, кто хочет понять себя и ближайший период без фатализма и общих фраз.',
    primary: 'Посмотреть возможности',
    secondary: 'Читать разборы',
    showcaseLabel: 'Персональный прогноз',
    showcaseDate: 'ВОСКРЕСЕНЬЕ · 26 ИЮЛЯ',
    showcaseTitle: 'Сегодня лучше говорить прямо, а не надеяться, что все догадаются сами.',
    showcaseBody: 'День не требует рывка. Он требует одного понятного решения, которое ты давно откладываешь.',
    love: 'Любовь',
    work: 'Дела и деньги',
    loveText: 'Разговор даст больше, чем очередная попытка прочитать мысли другого человека.',
    workText: 'Хороший момент закрыть один зависший вопрос и не распыляться на пять новых.',
    productsLabel: 'Возможности',
    productsTitle: 'Не набор функций. Нормальные ответы на разные жизненные вопросы.',
    productsBody: 'Каждый раздел работает как отдельный полезный инструмент, но внутри приложения они собираются в одну понятную картину.',
    personalLabel: 'Сегодня · Неделя · Месяц · Год',
    personalTitle: 'Один личный прогноз, который развивается вместе с периодом.',
    personalBody: 'Начни с сегодняшнего дня, а потом посмотри, как та же тема раскрывается на неделе, в месяце и в году.',
    natalLabel: 'Натальная карта',
    natalTitle: 'Не ярлык. Карта привычек, реакций и сильных сторон.',
    natalBody: 'Показываем не “кто ты навсегда”, а как ты обычно действуешь, где повторяешь один сценарий и на что реально можешь опереться.',
    compatibilityLabel: 'Совместимость',
    compatibilityTitle: 'Не процент ради красивой цифры.',
    compatibilityBody: 'Разбираем притяжение, общение, сложные места и то, что помогает людям действительно договариваться.',
    questionsLabel: 'Персональные вопросы',
    questionsTitle: 'Можно спросить именно то, что сейчас не даёт покоя.',
    questionsBody: 'Ответ строится по натальной карте, периоду и уже рассчитанному контексту — без чатовой воды и случайных советов.',
    zodiacLabel: 'Гороскоп по знаку',
    zodiacTitle: 'Быстрый вход без лишних шагов.',
    zodiacBody: 'Выбираешь знак и сразу читаешь прогноз. Персональные данные можно добавить позже.',
    guidesLabel: 'Разборы и статьи',
    guidesTitle: 'Материалы, которые отвечают на вопрос, а не растягивают вступление.',
    allSigns: 'Все знаки',
    allGuides: 'Все материалы',
    read: 'Подробнее',
    finalLabel: 'Твой Гороскоп',
  },
  en: {
    status: 'Personal forecasts, natal chart and compatibility',
    heroNote: 'One app for understanding yourself and the period ahead without fatalism or generic filler.',
    primary: 'Explore the app',
    secondary: 'Read guides',
    showcaseLabel: 'Personal forecast',
    showcaseDate: 'SUNDAY · JULY 26',
    showcaseTitle: 'Today works better when you say the real thing instead of waiting to be understood.',
    showcaseBody: 'The day does not ask for a dramatic push. It asks for one clear decision you have postponed long enough.',
    love: 'Love',
    work: 'Work and money',
    loveText: 'A direct conversation will do more than another attempt to read someone’s mind.',
    workText: 'A good moment to close one delayed issue before opening five new ones.',
    productsLabel: 'What the app does',
    productsTitle: 'Not a pile of features. Useful answers to different life questions.',
    productsBody: 'Each area works as a focused tool, while the full app connects them into one clear picture.',
    personalLabel: 'Today · Week · Month · Year',
    personalTitle: 'One personal forecast that develops with the timeframe.',
    personalBody: 'Start with today, then see how the same theme unfolds across the week, month and year.',
    natalLabel: 'Natal chart',
    natalTitle: 'Not a label. A map of patterns, reactions and strengths.',
    natalBody: 'See how you tend to act, where the same scenario repeats, and what you can genuinely rely on.',
    compatibilityLabel: 'Compatibility',
    compatibilityTitle: 'Not a percentage made for a pretty result.',
    compatibilityBody: 'Understand attraction, communication, friction and what actually helps two people meet halfway.',
    questionsLabel: 'Personal questions',
    questionsTitle: 'Ask what is genuinely on your mind right now.',
    questionsBody: 'Answers use your chart, the selected period and calculated context instead of generic chat advice.',
    zodiacLabel: 'Zodiac horoscope',
    zodiacTitle: 'A quick start without extra steps.',
    zodiacBody: 'Choose a sign and read the forecast. Personal details can be added later.',
    guidesLabel: 'Guides and articles',
    guidesTitle: 'Content that answers the question instead of stretching the introduction.',
    allSigns: 'All signs',
    allGuides: 'All guides',
    read: 'Read more',
    finalLabel: 'Your Horoscope',
  },
  es: {
    status: 'Pronóstico personal, carta natal y compatibilidad',
    heroNote: 'Una app para entenderte y mirar el período que viene sin fatalismo ni frases genéricas.',
    primary: 'Ver la app',
    secondary: 'Leer guías',
    showcaseLabel: 'Pronóstico personal',
    showcaseDate: 'DOMINGO · 26 DE JULIO',
    showcaseTitle: 'Hoy funciona mejor hablar claro que esperar que los demás adivinen.',
    showcaseBody: 'El día no pide un gran salto. Pide una decisión concreta que llevas demasiado tiempo aplazando.',
    love: 'Amor',
    work: 'Trabajo y dinero',
    loveText: 'Una conversación directa servirá más que intentar leer la mente de otra persona.',
    workText: 'Buen momento para cerrar un asunto pendiente antes de abrir cinco más.',
    productsLabel: 'Qué ofrece la app',
    productsTitle: 'No es una lista de funciones. Son respuestas útiles para preguntas distintas.',
    productsBody: 'Cada área funciona como una herramienta concreta y juntas forman una imagen clara.',
    personalLabel: 'Hoy · Semana · Mes · Año',
    personalTitle: 'Un pronóstico personal que cambia con el período.',
    personalBody: 'Empieza por hoy y mira cómo la misma historia se desarrolla durante la semana, el mes y el año.',
    natalLabel: 'Carta natal',
    natalTitle: 'No es una etiqueta. Es un mapa de patrones, reacciones y fortalezas.',
    natalBody: 'Muestra cómo sueles actuar, dónde repites un escenario y en qué puedes apoyarte de verdad.',
    compatibilityLabel: 'Compatibilidad',
    compatibilityTitle: 'No un porcentaje pensado para quedar bonito.',
    compatibilityBody: 'Analiza atracción, comunicación, fricciones y lo que ayuda a dos personas a entenderse.',
    questionsLabel: 'Preguntas personales',
    questionsTitle: 'Pregunta lo que de verdad te preocupa ahora.',
    questionsBody: 'La respuesta usa tu carta, el período y el contexto calculado, no consejos genéricos de chat.',
    zodiacLabel: 'Horóscopo por signo',
    zodiacTitle: 'Una entrada rápida sin pasos innecesarios.',
    zodiacBody: 'Elige tu signo y lee el pronóstico. Los datos personales se pueden añadir después.',
    guidesLabel: 'Guías y artículos',
    guidesTitle: 'Contenido que responde a la pregunta sin alargar la introducción.',
    allSigns: 'Todos los signos',
    allGuides: 'Todas las guías',
    read: 'Leer más',
    finalLabel: 'Tu Horóscopo',
  },
} as const;

export default async function LocaleHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  const copy = homeCopy[locale];
  const guides = (await getGuides(locale)).slice(0, 3);
  const appJsonLd = softwareApplicationJsonLd(locale);

  return (
    <>
      <JsonLd data={organizationJsonLd(locale)} />
      <JsonLd data={websiteJsonLd(locale)} />
      {appJsonLd ? <JsonLd data={appJsonLd} /> : null}

      <main className="home-page">
        <section className="home-hero shell">
          <div className="hero-status"><span />{copy.status}</div>
          <h1>{dict.hero.title}</h1>
          <p className="home-hero-lead">{copy.heroNote}</p>
          <div className="home-hero-actions">
            <Link className="pill-button pill-button-primary" href={`/${locale}#products`}>{copy.primary}</Link>
            <Link className="pill-button" href={`/${locale}/guides`}>{copy.secondary}</Link>
          </div>
        </section>

        <section className="shell hero-showcase" aria-label={`${brands[locale]} product preview`}>
          <div className="showcase-glow showcase-glow-one" />
          <div className="showcase-glow showcase-glow-two" />
          <div className="showcase-window">
            <div className="showcase-window-bar"><span /><span /><span /><b>{copy.showcaseLabel}</b></div>
            <div className="showcase-content">
              <div className="showcase-main-copy">
                <p className="showcase-date">{copy.showcaseDate}</p>
                <h2>{copy.showcaseTitle}</h2>
                <p>{copy.showcaseBody}</p>
              </div>
              <div className="showcase-insight-grid">
                <article><span>{copy.love}</span><p>{copy.loveText}</p></article>
                <article><span>{copy.work}</span><p>{copy.workText}</p></article>
              </div>
            </div>
          </div>
        </section>

        <section className="shell section-intro" id="products">
          <p className="section-kicker">{copy.productsLabel}</p>
          <h2>{copy.productsTitle}</h2>
          <p>{copy.productsBody}</p>
        </section>

        <section className="shell case-list">
          <article className="case-study case-study-wide">
            <div className="case-copy">
              <p className="section-kicker">{copy.personalLabel}</p>
              <h2>{copy.personalTitle}</h2>
              <p>{copy.personalBody}</p>
              <Link href={`/${locale}/personal-horoscope`}>{copy.read} <span>↗</span></Link>
            </div>
            <div className="case-visual period-visual" aria-hidden="true">
              <div className="period-nav"><span className="active">{locale === 'ru' ? 'Сегодня' : locale === 'es' ? 'Hoy' : 'Today'}</span><span>{locale === 'ru' ? 'Неделя' : locale === 'es' ? 'Semana' : 'Week'}</span><span>{locale === 'ru' ? 'Месяц' : locale === 'es' ? 'Mes' : 'Month'}</span><span>{locale === 'ru' ? 'Год' : locale === 'es' ? 'Año' : 'Year'}</span></div>
              <div className="period-preview-card"><small>{copy.showcaseDate}</small><strong>{copy.showcaseTitle}</strong><i /><i /><i /></div>
            </div>
          </article>

          <div className="case-study-grid">
            <article className="case-study">
              <div className="case-copy">
                <p className="section-kicker">{copy.natalLabel}</p>
                <h2>{copy.natalTitle}</h2>
                <p>{copy.natalBody}</p>
                <Link href={`/${locale}/natal-chart`}>{copy.read} <span>↗</span></Link>
              </div>
              <div className="case-visual chart-visual" aria-hidden="true"><div className="chart-core" /><div className="chart-ring ring-a" /><div className="chart-ring ring-b" /><div className="chart-ring ring-c" /><b className="chart-node node-a" /><b className="chart-node node-b" /><b className="chart-node node-c" /></div>
            </article>

            <article className="case-study">
              <div className="case-copy">
                <p className="section-kicker">{copy.compatibilityLabel}</p>
                <h2>{copy.compatibilityTitle}</h2>
                <p>{copy.compatibilityBody}</p>
                <Link href={`/${locale}/compatibility`}>{copy.read} <span>↗</span></Link>
              </div>
              <div className="case-visual compatibility-visual" aria-hidden="true"><div className="profile-disc disc-a">A</div><div className="profile-disc disc-b">B</div><div className="match-line"><span /></div><strong>87%</strong></div>
            </article>
          </div>

          <article className="case-study case-study-wide case-study-reverse">
            <div className="case-copy">
              <p className="section-kicker">{copy.questionsLabel}</p>
              <h2>{copy.questionsTitle}</h2>
              <p>{copy.questionsBody}</p>
              <Link href={`/${locale}/questions`}>{copy.read} <span>↗</span></Link>
            </div>
            <div className="case-visual questions-visual" aria-hidden="true">
              <div className="question-row">{locale === 'ru' ? 'Стоит ли менять работу?' : locale === 'es' ? '¿Debería cambiar de trabajo?' : 'Should I change jobs?'}</div>
              <div className="question-row">{locale === 'ru' ? 'Что сейчас важнее в отношениях?' : locale === 'es' ? '¿Qué importa ahora en la relación?' : 'What matters most in my relationship now?'}</div>
              <div className="question-row muted">{locale === 'ru' ? 'Когда лучше решиться на переезд?' : locale === 'es' ? '¿Cuándo conviene mudarse?' : 'When is a better time to move?'}</div>
            </div>
          </article>
        </section>

        <section className="shell zodiac-feature">
          <div className="zodiac-copy">
            <p className="section-kicker">{copy.zodiacLabel}</p>
            <h2>{copy.zodiacTitle}</h2>
            <p>{copy.zodiacBody}</p>
            <Link className="pill-button" href={`/${locale}/zodiac`}>{copy.allSigns}</Link>
          </div>
          <div className="zodiac-list">
            {zodiacSlugs.map((sign) => {
              const info = getZodiacInfo(locale, sign);
              return <Link key={sign} href={`/${locale}/zodiac/${sign}`}><span>{info.name}</span><small>{info.dates}</small></Link>;
            })}
          </div>
        </section>

        {guides.length > 0 ? (
          <section className="shell guides-feature">
            <div className="section-intro section-intro-left">
              <p className="section-kicker">{copy.guidesLabel}</p>
              <h2>{copy.guidesTitle}</h2>
              <Link className="pill-button" href={`/${locale}/guides`}>{copy.allGuides}</Link>
            </div>
            <div className="editorial-list">
              {guides.map((guide) => <ArticleCard key={guide.frontmatter.slug} href={`/${locale}/guides/${guide.frontmatter.slug}`} title={guide.frontmatter.title} description={guide.frontmatter.description} meta={guide.frontmatter.publishedAt} />)}
            </div>
          </section>
        ) : null}

        <section className="shell closing-panel">
          <p className="section-kicker">{copy.finalLabel}</p>
          <h2>{dict.home.finalTitle}</h2>
          <p>{dict.home.finalBody}</p>
          <StoreButtons fallback={dict.common.comingSoon} />
        </section>
      </main>
    </>
  );
}
