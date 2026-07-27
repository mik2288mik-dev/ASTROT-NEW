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
  const copy = pageCopy[locale];
  return pageMetadata({ locale, title: copy.heroTitle, description: copy.heroBody });
}

const pageCopy = {
  ru: {
    badge: 'Твой Гороскоп — приложение про тебя',
    heroTitle: 'Пойми свой период. Без тумана и страшилок.',
    heroBody: 'Личный прогноз, натальная карта, совместимость и гороскопы по знакам — в одном приложении. Честно, понятно и без фатализма.',
    primary: 'Посмотреть, что внутри',
    secondary: 'Читать разборы',
    quick: ['Можно начать со знака', 'Личный разбор по данным рождения', 'Русский · English · Español'],
    featuresKicker: 'Что внутри',
    featuresTitle: 'Не ещё один гороскоп. Нормальные ответы на разные жизненные вопросы.',
    featuresBody: 'Каждый раздел решает свою задачу, но вместе они дают понятную картину: что происходит сейчас, что повторяется и где стоит действовать аккуратнее.',
    personalKicker: 'Личный прогноз',
    personalTitle: 'Сегодня, неделя, месяц и год — в одной понятной ленте.',
    personalBody: 'Сначала общий вывод, потом любовь, настроение, дом, друзья, работа и деньги. Никаких случайных карточек, повторов и фраз, которые можно отправить кому угодно.',
    personalBullets: ['Общий вывод — сразу', 'Темы дня по реальному расчёту', 'Пояснения человеческим языком'],
    personalLink: 'Подробнее о личном прогнозе',
    natalKicker: 'Натальная карта',
    natalTitle: 'Натальная карта без ярлыков.',
    natalBody: 'Разбираем сильные стороны, привычные реакции и повторяющиеся сценарии. Не решаем за тебя, кем быть и что делать — показываем, на что ты реально можешь опереться.',
    natalLink: 'Как устроен разбор карты',
    compatibilityKicker: 'Совместимость',
    compatibilityTitle: 'Не красивый процент ради красивой цифры.',
    compatibilityBody: 'Показываем, где вам легко, где начинается спор и что помогает нормально разговаривать. Без сказки про «идеальную пару» и без приговора отношениям.',
    compatibilityLink: 'Посмотреть совместимость',
    questionsKicker: 'Персональные вопросы',
    questionsTitle: 'Спроси про то, что реально важно.',
    questionsBody: 'Работа, деньги, отношения, переезд, профессия, крупные решения — ответ строится по карте и выбранному периоду, а не выдаётся как случайный совет.',
    questionsLink: 'Какие вопросы можно задать',
    stepsKicker: 'Как начать',
    stepsTitle: 'Без анкеты на двадцать экранов.',
    steps: [
      ['01', 'Выбери вход', 'Начни с гороскопа по знаку или сразу перейди к личному разбору.'],
      ['02', 'Добавь данные, когда готов', 'Дата, время и место рождения нужны только для персональных расчётов.'],
      ['03', 'Читай и задавай вопросы', 'Приложение объясняет выводы понятным языком и показывает, откуда они взялись.'],
    ],
    zodiacKicker: 'Гороскопы по знакам',
    zodiacTitle: 'Быстрый вход без лишних форм.',
    zodiacBody: 'Выбери знак, прочитай общий прогноз и реши, нужен ли тебе более точный личный разбор.',
    guidesKicker: 'Полезные материалы',
    guidesTitle: 'Разборы, которые отвечают на вопрос, а не пересказывают Википедию.',
    finalTitle: 'Начни с того, что волнует тебя сейчас.',
    finalBody: 'Гороскоп по знаку — для быстрого входа. Личный прогноз — когда нужна точность под тебя.',
  },
  en: {
    badge: 'Your Horoscope — a personal app about you',
    heroTitle: 'Understand your moment. No fog, no scare tactics.',
    heroBody: 'Personal forecasts, natal chart, compatibility, and zodiac horoscopes in one app. Clear, honest, and never fatalistic.',
    primary: 'See what is inside',
    secondary: 'Read the guides',
    quick: ['Start with your zodiac sign', 'Personal reading from birth data', 'Русский · English · Español'],
    featuresKicker: 'Inside the app',
    featuresTitle: 'Not another horoscope. Useful answers for different parts of life.',
    featuresBody: 'Each section has a clear job, while together they show what is happening now, what keeps repeating, and where a careful choice matters.',
    personalKicker: 'Personal forecast',
    personalTitle: 'Today, week, month, and year in one clear reading.',
    personalBody: 'Start with the main conclusion, then move through love, mood, home, friends, work, and money. No random cards, repeated filler, or lines that could fit anyone.',
    personalBullets: ['The main conclusion first', 'Topics selected by the calculation', 'Plain-language explanations'],
    personalLink: 'Explore personal forecasts',
    natalKicker: 'Natal chart',
    natalTitle: 'A natal chart without labels.',
    natalBody: 'See strengths, familiar reactions, and repeating patterns. The app does not decide who you are; it shows what you can genuinely rely on.',
    natalLink: 'How the natal reading works',
    compatibilityKicker: 'Compatibility',
    compatibilityTitle: 'Not a pretty score for the sake of a pretty number.',
    compatibilityBody: 'See where communication is easy, where friction begins, and what helps two people actually understand each other — without “perfect match” claims.',
    compatibilityLink: 'Explore compatibility',
    questionsKicker: 'Personal questions',
    questionsTitle: 'Ask about what genuinely matters.',
    questionsBody: 'Work, money, relationships, relocation, profession, and major decisions — answers use your chart and selected period instead of producing generic advice.',
    questionsLink: 'See the question topics',
    stepsKicker: 'How to start',
    stepsTitle: 'No twenty-screen questionnaire.',
    steps: [
      ['01', 'Choose your entry point', 'Start with a zodiac horoscope or go straight to a personal reading.'],
      ['02', 'Add details when you are ready', 'Birth date, time, and place are requested only for personal calculations.'],
      ['03', 'Read and ask questions', 'The app explains conclusions in plain language and shows what supports them.'],
    ],
    zodiacKicker: 'Zodiac horoscopes',
    zodiacTitle: 'A quick start without extra forms.',
    zodiacBody: 'Choose your sign, read the general forecast, and decide whether you want a more precise personal reading.',
    guidesKicker: 'Useful reading',
    guidesTitle: 'Guides that answer the question instead of rewriting an encyclopedia.',
    finalTitle: 'Start with what matters to you right now.',
    finalBody: 'A zodiac horoscope for a quick start. A personal forecast when you want something built around you.',
  },
  es: {
    badge: 'Tu Horóscopo — una app personal sobre ti',
    heroTitle: 'Entiende tu momento. Sin niebla ni alarmismo.',
    heroBody: 'Pronóstico personal, carta natal, compatibilidad y horóscopos por signo en una sola app. Claro, honesto y sin fatalismo.',
    primary: 'Ver qué hay dentro',
    secondary: 'Leer las guías',
    quick: ['Empieza por tu signo', 'Lectura personal con datos de nacimiento', 'Русский · English · Español'],
    featuresKicker: 'Dentro de la app',
    featuresTitle: 'No es otro horóscopo. Son respuestas útiles para distintas partes de la vida.',
    featuresBody: 'Cada sección tiene una función clara y, juntas, muestran qué ocurre ahora, qué se repite y dónde conviene elegir con más cuidado.',
    personalKicker: 'Pronóstico personal',
    personalTitle: 'Hoy, semana, mes y año en una lectura clara.',
    personalBody: 'Primero la conclusión principal; después amor, ánimo, hogar, amistades, trabajo y dinero. Sin tarjetas aleatorias ni frases que podrían servirle a cualquiera.',
    personalBullets: ['La conclusión principal primero', 'Temas elegidos por el cálculo', 'Explicaciones en lenguaje claro'],
    personalLink: 'Ver el pronóstico personal',
    natalKicker: 'Carta natal',
    natalTitle: 'Una carta natal sin etiquetas.',
    natalBody: 'Muestra fortalezas, reacciones habituales y patrones repetidos. La app no decide quién eres: señala en qué puedes apoyarte de verdad.',
    natalLink: 'Cómo funciona la lectura natal',
    compatibilityKicker: 'Compatibilidad',
    compatibilityTitle: 'No un porcentaje bonito porque sí.',
    compatibilityBody: 'Muestra dónde es fácil entenderse, dónde aparece la fricción y qué ayuda a hablar de verdad, sin promesas de “pareja perfecta”.',
    compatibilityLink: 'Ver compatibilidad',
    questionsKicker: 'Preguntas personales',
    questionsTitle: 'Pregunta por lo que de verdad importa.',
    questionsBody: 'Trabajo, dinero, relaciones, mudanzas, profesión y decisiones importantes: la respuesta usa tu carta y el período elegido, no consejos genéricos.',
    questionsLink: 'Ver temas de preguntas',
    stepsKicker: 'Cómo empezar',
    stepsTitle: 'Sin un formulario de veinte pantallas.',
    steps: [
      ['01', 'Elige cómo entrar', 'Empieza por tu signo o pasa directamente a una lectura personal.'],
      ['02', 'Añade datos cuando quieras', 'Fecha, hora y lugar de nacimiento solo se piden para cálculos personales.'],
      ['03', 'Lee y pregunta', 'La app explica las conclusiones con claridad y muestra en qué se apoyan.'],
    ],
    zodiacKicker: 'Horóscopos por signo',
    zodiacTitle: 'Una entrada rápida sin formularios innecesarios.',
    zodiacBody: 'Elige tu signo, lee el pronóstico general y decide si quieres una lectura personal más precisa.',
    guidesKicker: 'Contenido útil',
    guidesTitle: 'Guías que responden la pregunta en lugar de reescribir una enciclopedia.',
    finalTitle: 'Empieza por lo que te importa ahora.',
    finalBody: 'Horóscopo por signo para entrar rápido. Pronóstico personal cuando quieres algo hecho para ti.',
  },
} as const;

export default async function LocaleHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const copy = pageCopy[locale];
  const guides = (await getGuides(locale)).slice(0, 3);
  const appJsonLd = softwareApplicationJsonLd(locale);

  return (
    <>
      <JsonLd data={organizationJsonLd(locale)} />
      <JsonLd data={websiteJsonLd(locale)} />
      {appJsonLd ? <JsonLd data={appJsonLd} /> : null}

      <section className="landing-hero">
        <div className="shell landing-hero-grid">
          <div className="landing-hero-copy">
            <p className="pill-label"><span />{copy.badge}</p>
            <h1>{copy.heroTitle}</h1>
            <p className="hero-lead">{copy.heroBody}</p>
            <div className="hero-actions">
              <Link className="button button-primary" href={`/${locale}#inside`}>{copy.primary}</Link>
              <Link className="button button-ghost" href={`/${locale}/guides`}>{copy.secondary}</Link>
            </div>
            <ul className="quick-proof">
              {copy.quick.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
          <div className="hero-image-wrap">
            <img src="/site/lifestyle-hero.svg" alt={locale === 'ru' ? 'Человек смотрит персональный прогноз в телефоне за ярким рабочим столом' : locale === 'es' ? 'Persona consultando un pronóstico personal en el teléfono en un espacio de trabajo luminoso' : 'Person checking a personal forecast on a phone in a bright workspace'} width="1200" height="900" fetchPriority="high" />
            <div className="hero-float-card hero-float-top"><strong>{copy.personalKicker}</strong><span>{copy.personalBullets[0]}</span></div>
            <div className="hero-float-card hero-float-bottom"><strong>{copy.compatibilityKicker}</strong><span>{copy.compatibilityBody}</span></div>
          </div>
        </div>
      </section>

      <section className="section section-soft" id="inside">
        <div className="shell">
          <div className="section-heading section-heading-centered">
            <p className="eyebrow">{copy.featuresKicker}</p>
            <h2>{copy.featuresTitle}</h2>
            <p>{copy.featuresBody}</p>
          </div>
          <div className="feature-shortcuts">
            <Link href={`/${locale}/personal-horoscope`}><span className="shortcut-dot blue" /><strong>{copy.personalKicker}</strong></Link>
            <Link href={`/${locale}/natal-chart`}><span className="shortcut-dot yellow" /><strong>{copy.natalKicker}</strong></Link>
            <Link href={`/${locale}/compatibility`}><span className="shortcut-dot coral" /><strong>{copy.compatibilityKicker}</strong></Link>
            <Link href={`/${locale}/questions`}><span className="shortcut-dot green" /><strong>{copy.questionsKicker}</strong></Link>
          </div>
        </div>
      </section>

      <section className="section product-row-section">
        <div className="shell product-row product-row-personal">
          <div className="product-copy">
            <p className="eyebrow">{copy.personalKicker}</p>
            <h2>{copy.personalTitle}</h2>
            <p>{copy.personalBody}</p>
            <ul className="check-list">{copy.personalBullets.map((item) => <li key={item}>{item}</li>)}</ul>
            <Link className="text-link" href={`/${locale}/personal-horoscope`}>{copy.personalLink} →</Link>
          </div>
          <div className="forecast-preview" aria-label={copy.personalKicker}>
            <div className="preview-tabs"><span className="active">{locale === 'ru' ? 'Сегодня' : locale === 'es' ? 'Hoy' : 'Today'}</span><span>{locale === 'ru' ? 'Неделя' : locale === 'es' ? 'Semana' : 'Week'}</span><span>{locale === 'ru' ? 'Месяц' : locale === 'es' ? 'Mes' : 'Month'}</span><span>{locale === 'ru' ? 'Год' : locale === 'es' ? 'Año' : 'Year'}</span></div>
            <div className="preview-date">{locale === 'ru' ? 'ВОСКРЕСЕНЬЕ · 26 ИЮЛЯ' : locale === 'es' ? 'DOMINGO · 26 DE JULIO' : 'SUNDAY · JULY 26'}</div>
            <h3>{locale === 'ru' ? 'Сегодня лучше договориться, чем снова гадать, что имелось в виду.' : locale === 'es' ? 'Hoy es mejor hablar claro que volver a adivinar lo que quiso decir la otra persona.' : 'Today, a clear conversation beats another round of guessing.'}</h3>
            <p>{locale === 'ru' ? 'Главная тема дня показывается сразу, а дальше можно спокойно пройтись по любви, работе, деньгам и другим важным разделам.' : locale === 'es' ? 'La idea principal aparece primero; después puedes revisar amor, trabajo, dinero y otros temas importantes.' : 'The main theme comes first, followed by love, work, money, and the other areas that matter.'}</p>
            <div className="preview-topic"><span>{locale === 'ru' ? 'Любовь' : locale === 'es' ? 'Amor' : 'Love'}</span><strong>{locale === 'ru' ? 'Меньше намёков. Больше нормального разговора.' : locale === 'es' ? 'Menos indirectas. Más conversación real.' : 'Fewer hints. More real conversation.'}</strong></div>
          </div>
        </div>
      </section>

      <section className="section product-row-section section-peach">
        <div className="shell product-row">
          <div className="product-visual"><img src="/site/lifestyle-natal.svg" alt={locale === 'ru' ? 'Человек разбирает заметки о своих сильных сторонах и привычных реакциях' : locale === 'es' ? 'Persona organizando notas sobre sus fortalezas y patrones habituales' : 'Person organizing notes about strengths and familiar patterns'} width="1200" height="900" loading="lazy" /></div>
          <div className="product-copy">
            <p className="eyebrow">{copy.natalKicker}</p>
            <h2>{copy.natalTitle}</h2>
            <p>{copy.natalBody}</p>
            <Link className="text-link" href={`/${locale}/natal-chart`}>{copy.natalLink} →</Link>
          </div>
        </div>
      </section>

      <section className="section product-row-section section-blue">
        <div className="shell product-row product-row-reverse">
          <div className="product-visual"><img src="/site/lifestyle-compatibility.svg" alt={locale === 'ru' ? 'Два человека спокойно разговаривают за столом' : locale === 'es' ? 'Dos personas conversando con calma en una mesa' : 'Two people having a calm conversation at a table'} width="1200" height="900" loading="lazy" /></div>
          <div className="product-copy">
            <p className="eyebrow">{copy.compatibilityKicker}</p>
            <h2>{copy.compatibilityTitle}</h2>
            <p>{copy.compatibilityBody}</p>
            <Link className="text-link" href={`/${locale}/compatibility`}>{copy.compatibilityLink} →</Link>
          </div>
        </div>
      </section>

      <section className="section product-row-section section-mint">
        <div className="shell product-row">
          <div className="product-visual"><img src="/site/lifestyle-work.svg" alt={locale === 'ru' ? 'Человек работает за ноутбуком и записывает важный вопрос' : locale === 'es' ? 'Persona trabajando con un portátil y anotando una pregunta importante' : 'Person working on a laptop and writing down an important question'} width="1200" height="900" loading="lazy" /></div>
          <div className="product-copy">
            <p className="eyebrow">{copy.questionsKicker}</p>
            <h2>{copy.questionsTitle}</h2>
            <p>{copy.questionsBody}</p>
            <Link className="text-link" href={`/${locale}/questions`}>{copy.questionsLink} →</Link>
          </div>
        </div>
      </section>

      <section className="section steps-section">
        <div className="shell">
          <div className="section-heading">
            <div><p className="eyebrow">{copy.stepsKicker}</p><h2>{copy.stepsTitle}</h2></div>
          </div>
          <div className="steps-grid">
            {copy.steps.map(([number, title, body]) => <article className="step-card" key={number}><span>{number}</span><h3>{title}</h3><p>{body}</p></article>)}
          </div>
        </div>
      </section>

      <section className="section zodiac-section">
        <div className="shell">
          <div className="section-heading section-heading-split">
            <div><p className="eyebrow">{copy.zodiacKicker}</p><h2>{copy.zodiacTitle}</h2><p>{copy.zodiacBody}</p></div>
            <Link className="button button-ghost" href={`/${locale}/zodiac`}>{dict.common.allSigns}</Link>
          </div>
          <div className="sign-grid sign-grid-home">
            {zodiacSlugs.map((sign) => {
              const info = getZodiacInfo(locale, sign);
              return <Link className="sign-card" key={sign} href={`/${locale}/zodiac/${sign}`}><strong>{info.name}</strong><span>{info.dates}</span><b aria-hidden="true">↗</b></Link>;
            })}
          </div>
        </div>
      </section>

      {guides.length > 0 ? <section className="section guides-section"><div className="shell"><div className="section-heading section-heading-split"><div><p className="eyebrow">{copy.guidesKicker}</p><h2>{copy.guidesTitle}</h2></div><Link className="button button-ghost" href={`/${locale}/guides`}>{dict.common.allGuides}</Link></div><div className="article-grid">{guides.map((guide) => <ArticleCard key={guide.frontmatter.slug} href={`/${locale}/guides/${guide.frontmatter.slug}`} title={guide.frontmatter.title} description={guide.frontmatter.description} meta={guide.frontmatter.publishedAt} />)}</div></div></section> : null}

      <section className="section final-section"><div className="shell final-cta"><div><p className="eyebrow">{brands[locale]}</p><h2>{copy.finalTitle}</h2><p>{copy.finalBody}</p></div><StoreButtons fallback={dict.common.comingSoon} /></div></section>
    </>
  );
}
