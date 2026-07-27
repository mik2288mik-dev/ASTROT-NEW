import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArticleCard } from '@/components/ArticleCard';
import { JsonLd } from '@/components/JsonLd';
import { StoreButtons } from '@/components/StoreButtons';
import { getGuides } from '@/lib/content';
import { getDictionary } from '@/lib/i18n';
import { pageMetadata, organizationJsonLd, softwareApplicationJsonLd, websiteJsonLd } from '@/lib/seo';
import { isLocale } from '@/lib/site';
import { zodiacSlugs, getZodiacInfo } from '@/lib/zodiac';

const copy = {
  ru: {
    badge: 'Твой Гороскоп',
    heroTitle: 'Личный гороскоп, натальная карта и совместимость',
    heroBody: 'Смотри прогноз на сегодня, неделю, месяц и год. Начни со своего знака или добавь данные рождения — приложение соберёт разбор под тебя.',
    primary: 'Посмотреть возможности',
    secondary: 'Выбрать знак',
    proof: ['Сегодня · Неделя · Месяц · Год', 'Натальная карта', 'Совместимость'],
    photoLabel: 'Личный прогноз',
    photoNote: 'Главное на сегодня — сразу. Остальное по темам.',
    insideEyebrow: 'Что внутри',
    insideTitle: 'Выбери, что важно сейчас',
    insideBody: 'Можно быстро посмотреть гороскоп по знаку, а можно пойти глубже — в личный прогноз, натальную карту, совместимость и вопросы.',
    features: [
      ['Личный прогноз', 'Прогноз на сегодня, неделю, месяц и год с учётом твоих данных.', 'personal-horoscope'],
      ['Натальная карта', 'Понятный разбор характера, сильных сторон и повторяющихся сценариев.', 'natal-chart'],
      ['Совместимость', 'Быстрая версия по знакам или подробный разбор двух натальных карт.', 'compatibility'],
      ['Свои вопросы', 'Работа, деньги, отношения, переезд и другие темы, которые не отпускают.', 'questions'],
    ],
    readMore: 'Подробнее',
    personalEyebrow: 'Личный прогноз',
    personalTitle: 'Сегодня, неделя, месяц и год — в одном месте',
    personalBody: 'Главная тема периода показывается сразу. Дальше — любовь, настроение, дом, друзья, работа и деньги. Читай подряд или переходи к нужному разделу.',
    personalLink: 'Посмотреть личный прогноз',
    previewDate: 'ВОСКРЕСЕНЬЕ · 26 ИЮЛЯ',
    previewTitle: 'Сегодня разговор решит больше, чем ещё одна попытка всё угадать',
    previewBody: 'Это пример подачи: сначала главное, потом короткие выводы по темам.',
    topicLove: ['Любовь', 'Скажи прямо, чего хочешь'],
    topicWork: ['Работа', 'Закрой один зависший вопрос'],
    topicMoney: ['Деньги', 'Не покупай на эмоциях'],
    natalEyebrow: 'Натальная карта',
    natalTitle: 'Натальная карта с понятной расшифровкой',
    natalBody: 'Не только знак зодиака. Карта помогает увидеть сочетание характера, эмоций, привычных реакций, отношений с работой, деньгами и близкими.',
    natalLink: 'Посмотреть натальную карту',
    compatibilityEyebrow: 'Совместимость',
    compatibilityTitle: 'Совместимость по знакам и натальным картам',
    compatibilityBody: 'По знакам — быстро. По двум картам — подробнее: общение, притяжение, ценности и причины конфликтов. Без вердиктов про «судьбу навсегда».',
    compatibilityLink: 'Проверить совместимость',
    questionsEyebrow: 'Персональные вопросы',
    questionsTitle: 'Есть вопрос, который не отпускает?',
    questionsBody: 'Работа, деньги, отношения, переезд, новая профессия или сложное решение. Ответ связывает твой вопрос с натальной картой и тем, что происходит сейчас.',
    questionsLink: 'Посмотреть вопросы',
    stepsEyebrow: 'Как начать',
    stepsTitle: 'Без длинной анкеты на старте',
    steps: [
      ['01', 'Начни со знака', 'Выбери свой знак и сразу посмотри общий прогноз.'],
      ['02', 'Добавь данные рождения', 'Дата, время и город нужны только для личных разборов.'],
      ['03', 'Открой то, что важно', 'День, неделя, карта, совместимость и свои вопросы будут внутри.'],
    ],
    zodiacEyebrow: 'Гороскопы по знакам',
    zodiacTitle: 'Хочется просто посмотреть гороскоп? Начни со знака',
    zodiacBody: 'Быстрый прогноз без регистрации. Личный разбор можно добавить позже.',
    guidesEyebrow: 'Полезные материалы',
    guidesTitle: 'Натальная карта, совместимость и астрология — нормальным языком',
    finalTitle: 'Начни со своего знака или получи личный разбор',
    finalBody: 'Один быстрый вход — и дальше выбирай, что тебе нужно сейчас.',
    altHero: 'Женщина в светлом современном интерьере',
    altNotebook: 'Открытый блокнот и ручка на рабочем столе',
    altNatal: 'Человек делает записи в блокноте',
    altCompatibility: 'Друзья разговаривают вместе за столом',
    altQuestions: 'Команда обсуждает рабочие вопросы за столом',
  },
  en: {
    badge: 'Your Horoscope',
    heroTitle: 'Personal horoscope, natal chart, and compatibility',
    heroBody: 'See your forecast for today, the week, month, and year. Start with your sign or add birth details for a reading built around you.',
    primary: 'Explore the app',
    secondary: 'Choose your sign',
    proof: ['Today · Week · Month · Year', 'Natal chart', 'Compatibility'],
    photoLabel: 'Personal forecast',
    photoNote: 'The main point first. Everything else by topic.',
    insideEyebrow: 'Inside the app',
    insideTitle: 'Choose what matters now',
    insideBody: 'Check your sign for a quick forecast or go deeper with a personal forecast, natal chart, compatibility, and personal questions.',
    features: [
      ['Personal forecast', 'Today, week, month, and year based on your birth details.', 'personal-horoscope'],
      ['Natal chart', 'A clear look at personality, strengths, and repeating patterns.', 'natal-chart'],
      ['Compatibility', 'A quick sign match or a deeper comparison of two natal charts.', 'compatibility'],
      ['Your questions', 'Work, money, relationships, relocation, and the topics on your mind.', 'questions'],
    ],
    readMore: 'Learn more',
    personalEyebrow: 'Personal forecast',
    personalTitle: 'Today, week, month, and year in one place',
    personalBody: 'See the main theme first, then move through love, mood, home, friends, work, and money. Read it all or jump to what you need.',
    personalLink: 'Explore personal forecasts',
    previewDate: 'SUNDAY · JULY 26',
    previewTitle: 'A clear conversation will do more today than another round of guessing',
    previewBody: 'An example of the format: the main point first, then short notes by topic.',
    topicLove: ['Love', 'Say what you actually want'],
    topicWork: ['Work', 'Close one unfinished task'],
    topicMoney: ['Money', 'Do not buy on impulse'],
    natalEyebrow: 'Natal chart',
    natalTitle: 'A natal chart explained clearly',
    natalBody: 'More than a zodiac sign. See how personality, emotions, familiar reactions, work, money, and relationships fit together.',
    natalLink: 'Explore the natal chart',
    compatibilityEyebrow: 'Compatibility',
    compatibilityTitle: 'Compatibility by signs and natal charts',
    compatibilityBody: 'Signs for a quick overview. Two charts for communication, attraction, values, and the reasons behind recurring conflict.',
    compatibilityLink: 'Check compatibility',
    questionsEyebrow: 'Personal questions',
    questionsTitle: 'Got a question you cannot shake?',
    questionsBody: 'Work, money, relationships, relocation, a new career, or a difficult decision. The answer connects your question with your chart and current moment.',
    questionsLink: 'Explore questions',
    stepsEyebrow: 'How to start',
    stepsTitle: 'No long form at the beginning',
    steps: [
      ['01', 'Start with your sign', 'Choose your sign and open the general forecast right away.'],
      ['02', 'Add birth details', 'Date, time, and city are only needed for personal readings.'],
      ['03', 'Open what matters', 'Your day, week, chart, compatibility, and questions are all inside.'],
    ],
    zodiacEyebrow: 'Zodiac horoscopes',
    zodiacTitle: 'Just checking your horoscope? Start with your sign',
    zodiacBody: 'A quick forecast without registration. Add a personal reading later.',
    guidesEyebrow: 'Useful guides',
    guidesTitle: 'Natal charts, compatibility, and astrology in plain language',
    finalTitle: 'Start with your sign or get a personal reading',
    finalBody: 'One quick entry point, then choose what matters to you now.',
    altHero: 'Woman in a bright modern interior',
    altNotebook: 'Open notebook and pen on a desk',
    altNatal: 'Person writing notes in a notebook',
    altCompatibility: 'Friends talking together at a table',
    altQuestions: 'Team discussing work around a table',
  },
  es: {
    badge: 'Tu Horóscopo',
    heroTitle: 'Horóscopo personal, carta natal y compatibilidad',
    heroBody: 'Mira tu pronóstico de hoy, semana, mes y año. Empieza por tu signo o añade tus datos de nacimiento para una lectura personal.',
    primary: 'Ver la app',
    secondary: 'Elegir signo',
    proof: ['Hoy · Semana · Mes · Año', 'Carta natal', 'Compatibilidad'],
    photoLabel: 'Pronóstico personal',
    photoNote: 'Lo principal primero. Después, cada tema.',
    insideEyebrow: 'Dentro de la app',
    insideTitle: 'Elige lo que importa ahora',
    insideBody: 'Consulta tu signo para algo rápido o entra en detalle con un pronóstico personal, carta natal, compatibilidad y preguntas.',
    features: [
      ['Pronóstico personal', 'Hoy, semana, mes y año según tus datos de nacimiento.', 'personal-horoscope'],
      ['Carta natal', 'Una lectura clara de personalidad, fortalezas y patrones repetidos.', 'natal-chart'],
      ['Compatibilidad', 'Una versión rápida por signos o una comparación de dos cartas natales.', 'compatibility'],
      ['Tus preguntas', 'Trabajo, dinero, relaciones, mudanzas y los temas que tienes en la cabeza.', 'questions'],
    ],
    readMore: 'Ver más',
    personalEyebrow: 'Pronóstico personal',
    personalTitle: 'Hoy, semana, mes y año en un solo lugar',
    personalBody: 'Primero aparece el tema principal. Después, amor, ánimo, hogar, amistades, trabajo y dinero. Lee todo o salta a lo que necesitas.',
    personalLink: 'Ver el pronóstico personal',
    previewDate: 'DOMINGO · 26 DE JULIO',
    previewTitle: 'Hoy una conversación clara servirá más que volver a adivinar',
    previewBody: 'Un ejemplo del formato: primero lo principal, después notas breves por tema.',
    topicLove: ['Amor', 'Di claramente lo que quieres'],
    topicWork: ['Trabajo', 'Cierra una tarea pendiente'],
    topicMoney: ['Dinero', 'No compres por impulso'],
    natalEyebrow: 'Carta natal',
    natalTitle: 'Una carta natal explicada con claridad',
    natalBody: 'Mucho más que un signo. Mira cómo encajan personalidad, emociones, reacciones, trabajo, dinero y relaciones.',
    natalLink: 'Ver la carta natal',
    compatibilityEyebrow: 'Compatibilidad',
    compatibilityTitle: 'Compatibilidad por signos y cartas natales',
    compatibilityBody: 'Por signos para una visión rápida. Con dos cartas para entender comunicación, atracción, valores y conflictos repetidos.',
    compatibilityLink: 'Comprobar compatibilidad',
    questionsEyebrow: 'Preguntas personales',
    questionsTitle: '¿Hay una pregunta que no te deja en paz?',
    questionsBody: 'Trabajo, dinero, relaciones, mudanzas, una nueva profesión o una decisión difícil. La respuesta conecta tu pregunta con tu carta y el momento actual.',
    questionsLink: 'Ver preguntas',
    stepsEyebrow: 'Cómo empezar',
    stepsTitle: 'Sin un formulario largo al principio',
    steps: [
      ['01', 'Empieza por tu signo', 'Elige tu signo y abre el pronóstico general.'],
      ['02', 'Añade tus datos', 'Fecha, hora y ciudad solo hacen falta para lecturas personales.'],
      ['03', 'Abre lo que importa', 'Tu día, semana, carta, compatibilidad y preguntas estarán dentro.'],
    ],
    zodiacEyebrow: 'Horóscopos por signo',
    zodiacTitle: '¿Solo quieres mirar tu horóscopo? Empieza por tu signo',
    zodiacBody: 'Un pronóstico rápido sin registro. La lectura personal puede esperar.',
    guidesEyebrow: 'Guías útiles',
    guidesTitle: 'Carta natal, compatibilidad y astrología en un lenguaje claro',
    finalTitle: 'Empieza por tu signo o recibe una lectura personal',
    finalBody: 'Una entrada rápida y después eliges lo que importa ahora.',
    altHero: 'Mujer en un interior moderno y luminoso',
    altNotebook: 'Cuaderno abierto y bolígrafo sobre una mesa',
    altNatal: 'Persona escribiendo notas en un cuaderno',
    altCompatibility: 'Amigos conversando alrededor de una mesa',
    altQuestions: 'Equipo hablando de trabajo alrededor de una mesa',
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const page = copy[locale];
  return pageMetadata({ locale, title: page.heroTitle, description: page.heroBody });
}

export default async function LocaleHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const page = copy[locale];
  const dict = getDictionary(locale);
  const guides = (await getGuides(locale)).slice(0, 3);
  const appJsonLd = softwareApplicationJsonLd(locale);

  return (
    <div className="home-v2">
      <JsonLd data={organizationJsonLd(locale)} />
      <JsonLd data={websiteJsonLd(locale)} />
      {appJsonLd ? <JsonLd data={appJsonLd} /> : null}

      <section className="home-hero">
        <div className="home-shell home-hero-grid">
          <div>
            <p className="home-kicker">{page.badge}</p>
            <h1>{page.heroTitle}</h1>
            <p className="home-hero-lead">{page.heroBody}</p>
            <div className="home-actions">
              <Link className="home-button home-button-primary" href={`/${locale}#inside`}>{page.primary}</Link>
              <Link className="home-button home-button-secondary" href={`/${locale}/zodiac`}>{page.secondary}</Link>
            </div>
            <ul className="home-proof">{page.proof.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <div className="home-photo-collage">
            <img className="home-photo-main" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=85" alt={page.altHero} width="1200" height="1400" fetchPriority="high" />
            <img className="home-photo-small" src="https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=700&q=85" alt={page.altNotebook} width="700" height="520" />
            <div className="home-photo-label"><strong>{page.photoLabel}</strong><span>{page.photoNote}</span></div>
          </div>
        </div>
      </section>

      <section className="home-section home-section-soft" id="inside">
        <div className="home-shell">
          <div className="home-section-head center">
            <p className="home-eyebrow">{page.insideEyebrow}</p>
            <h2>{page.insideTitle}</h2>
            <p>{page.insideBody}</p>
          </div>
          <div className="home-feature-grid">
            {page.features.map(([title, body, slug]) => (
              <article className="home-feature-card" key={slug}>
                <div><h3>{title}</h3><p>{body}</p></div>
                <Link href={`/${locale}/${slug}`}>{page.readMore} →</Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="home-shell home-product-grid">
          <div className="home-feature-copy">
            <p className="home-eyebrow">{page.personalEyebrow}</p>
            <h2>{page.personalTitle}</h2>
            <p>{page.personalBody}</p>
            <Link className="home-text-link" href={`/${locale}/personal-horoscope`}>{page.personalLink} →</Link>
          </div>
          <div className="home-preview" aria-label={page.personalEyebrow}>
            <div className="home-preview-tabs"><span className="active">{locale === 'ru' ? 'Сегодня' : locale === 'es' ? 'Hoy' : 'Today'}</span><span>{locale === 'ru' ? 'Неделя' : locale === 'es' ? 'Semana' : 'Week'}</span><span>{locale === 'ru' ? 'Месяц' : locale === 'es' ? 'Mes' : 'Month'}</span><span>{locale === 'ru' ? 'Год' : locale === 'es' ? 'Año' : 'Year'}</span></div>
            <div className="home-preview-date">{page.previewDate}</div>
            <h3>{page.previewTitle}</h3>
            <p>{page.previewBody}</p>
            <div className="home-preview-topics">
              {[page.topicLove, page.topicWork, page.topicMoney].map(([title, body]) => <div className="home-preview-topic" key={title}><span>{title}</span><strong>{body}</strong></div>)}
            </div>
          </div>
        </div>
      </section>

      <section className="home-section home-section-peach">
        <div className="home-shell home-product-grid reverse">
          <div className="home-feature-copy">
            <p className="home-eyebrow">{page.natalEyebrow}</p>
            <h2>{page.natalTitle}</h2>
            <p>{page.natalBody}</p>
            <Link className="home-text-link" href={`/${locale}/natal-chart`}>{page.natalLink} →</Link>
          </div>
          <div className="home-feature-media">
            <img src="https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=85" alt={page.altNatal} width="1200" height="900" loading="lazy" />
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="home-shell home-product-grid">
          <div className="home-feature-copy">
            <p className="home-eyebrow">{page.compatibilityEyebrow}</p>
            <h2>{page.compatibilityTitle}</h2>
            <p>{page.compatibilityBody}</p>
            <Link className="home-text-link" href={`/${locale}/compatibility`}>{page.compatibilityLink} →</Link>
          </div>
          <div className="home-feature-media">
            <img src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=85" alt={page.altCompatibility} width="1200" height="900" loading="lazy" />
          </div>
        </div>
      </section>

      <section className="home-section home-section-mint">
        <div className="home-shell home-product-grid reverse">
          <div className="home-feature-copy">
            <p className="home-eyebrow">{page.questionsEyebrow}</p>
            <h2>{page.questionsTitle}</h2>
            <p>{page.questionsBody}</p>
            <Link className="home-text-link" href={`/${locale}/questions`}>{page.questionsLink} →</Link>
          </div>
          <div className="home-feature-media">
            <img src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1200&q=85" alt={page.altQuestions} width="1200" height="900" loading="lazy" />
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="home-shell">
          <div className="home-section-head">
            <p className="home-eyebrow">{page.stepsEyebrow}</p>
            <h2>{page.stepsTitle}</h2>
          </div>
          <div className="home-step-grid">
            {page.steps.map(([number, title, body]) => <article className="home-step" key={number}><b>{number}</b><h3>{title}</h3><p>{body}</p></article>)}
          </div>
        </div>
      </section>

      <section className="home-section home-section-soft">
        <div className="home-shell">
          <div className="home-section-head">
            <p className="home-eyebrow">{page.zodiacEyebrow}</p>
            <h2>{page.zodiacTitle}</h2>
            <p>{page.zodiacBody}</p>
          </div>
          <div className="home-zodiac-grid">
            {zodiacSlugs.map((sign) => {
              const info = getZodiacInfo(locale, sign);
              return <Link className="home-zodiac-card" key={sign} href={`/${locale}/zodiac/${sign}`}><strong>{info.name}</strong><span>{info.dates}</span></Link>;
            })}
          </div>
        </div>
      </section>

      {guides.length > 0 ? (
        <section className="home-section">
          <div className="home-shell">
            <div className="home-section-head">
              <p className="home-eyebrow">{page.guidesEyebrow}</p>
              <h2>{page.guidesTitle}</h2>
            </div>
            <div className="article-grid">
              {guides.map((guide) => <ArticleCard key={guide.frontmatter.slug} href={`/${locale}/guides/${guide.frontmatter.slug}`} title={guide.frontmatter.title} description={guide.frontmatter.description} meta={guide.frontmatter.publishedAt} />)}
            </div>
          </div>
        </section>
      ) : null}

      <section className="home-section">
        <div className="home-shell home-final">
          <div><h2>{page.finalTitle}</h2><p>{page.finalBody}</p></div>
          <StoreButtons fallback={dict.common.comingSoon} />
        </div>
      </section>
    </div>
  );
}
