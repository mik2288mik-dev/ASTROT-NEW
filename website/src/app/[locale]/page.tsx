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

const pageCopy = {
  ru: {
    badge: 'Твой день, твои вопросы, твоя карта',
    heroTitle: 'Что у тебя сейчас — и куда всё движется.',
    heroBody: 'Сегодня, отношения, работа, деньги, натальная карта и совместимость. Не общий текст на всех, а разбор именно про тебя.',
    primary: 'Показать приложение',
    secondary: 'Почитать разборы',
    quick: ['Начни со своего знака', 'Добавь данные — получишь личный разбор', 'Сегодня · Неделя · Месяц · Год'],
    featuresKicker: 'Что можно узнать',
    featuresTitle: 'Не просто «что ждёт сегодня». Здесь можно разобраться, что происходит именно у тебя.',
    featuresBody: 'Открой день, посмотри отношения, разберись с работой и деньгами, проверь совместимость или задай свой вопрос. Всё собрано в одном приложении.',
    personalKicker: 'Личный прогноз',
    personalTitle: 'Твой день — без общих фраз.',
    personalBody: 'Сначала главное: на что сегодня обратить внимание. Потом — любовь, настроение, дом, друзья, работа и деньги. Читай подряд или сразу прыгай к нужной теме.',
    personalBullets: ['Главная мысль дня — в начале', 'Только темы, которые сегодня действительно важны', 'Можно открыть неделю, месяц и год'],
    personalLink: 'Посмотреть личный прогноз',
    natalKicker: 'Натальная карта',
    natalTitle: 'Почему ты снова делаешь именно так?',
    natalBody: 'Натальная карта помогает увидеть сильные стороны, привычные реакции и повторяющиеся истории. Не ставит диагноз и не решает за тебя — просто показывает то, что со стороны часто не видно.',
    natalLink: 'Разобрать свою карту',
    compatibilityKicker: 'Совместимость',
    compatibilityTitle: 'Где вас тянет друг к другу, а где всё начинает бесить.',
    compatibilityBody: 'Совместимость показывает, как вы общаетесь, чего ждёте друг от друга и на чём чаще всего спотыкаетесь. Не обещает вечную любовь — зато помогает понять, что между вами на самом деле.',
    compatibilityLink: 'Посмотреть, как вы совпадаете',
    questionsKicker: 'Свои вопросы',
    questionsTitle: 'Есть вопрос, который не отпускает?',
    questionsBody: 'Спроси про работу, деньги, отношения, переезд, профессию или большое решение. Ответ будет опираться на твою карту и текущий период, а не на универсальный совет из интернета.',
    questionsLink: 'Посмотреть вопросы',
    stepsKicker: 'Как начать',
    stepsTitle: 'Можно начать за минуту.',
    steps: [
      ['01', 'Выбери, с чего зайти', 'Хочешь быстро — открой гороскоп по знаку. Хочешь точнее — начни с личного разбора.'],
      ['02', 'Добавь дату рождения', 'Для личного прогноза понадобятся дата, время и город рождения.'],
      ['03', 'Смотри то, что важно сейчас', 'День, неделя, отношения, работа, деньги, карта и свои вопросы будут ждать внутри.'],
    ],
    zodiacKicker: 'Гороскопы по знакам',
    zodiacTitle: 'Хочется просто глянуть гороскоп? Начинай со знака.',
    zodiacBody: 'Выбери знак и посмотри общий прогноз. Личный разбор можно добавить позже.',
    guidesKicker: 'Полезные разборы',
    guidesTitle: 'Тексты, после которых хоть что-то становится понятнее.',
    finalTitle: 'Зайди с того, что волнует тебя сегодня.',
    finalBody: 'Любовь, деньги, работа, совместимость или просто свой знак — выбирай, с чего начать.',
    previewDate: 'ВОСКРЕСЕНЬЕ · 26 ИЮЛЯ',
    previewTitle: 'Сегодня лучше сказать прямо, чем ещё раз додумывать за другого.',
    previewBody: 'Сначала — главная тема дня. Дальше любовь, работа, деньги и всё, что сегодня действительно влияет на тебя.',
    previewTopic: 'Один честный разговор сейчас полезнее десяти намёков.',
    heroAlt: 'Человек смотрит личный прогноз в телефоне за ярким рабочим столом',
    natalAlt: 'Человек разбирает заметки о своих сильных сторонах и привычках',
    compatibilityAlt: 'Два человека спокойно разговаривают за столом',
    questionsAlt: 'Человек работает за ноутбуком и записывает важный вопрос',
  },
  en: {
    badge: 'Your day, your questions, your chart',
    heroTitle: 'See what is happening now — and where it is going.',
    heroBody: 'Your day, relationships, work, money, natal chart, and compatibility. Not one generic text for everyone, but a reading built around you.',
    primary: 'Explore the app',
    secondary: 'Read the guides',
    quick: ['Start with your zodiac sign', 'Add birth details for a personal reading', 'Today · Week · Month · Year'],
    featuresKicker: 'What you can explore',
    featuresTitle: 'More than “what will happen today.” See what is actually going on for you.',
    featuresBody: 'Check your day, look at relationships, sort through work and money, explore compatibility, or ask your own question — all in one app.',
    personalKicker: 'Personal forecast',
    personalTitle: 'Your day, without generic filler.',
    personalBody: 'Start with the main thing to notice today. Then move through love, mood, home, friends, work, and money. Read it all or jump straight to the part you need.',
    personalBullets: ['The main point comes first', 'Only the topics that matter today', 'Week, month, and year are there when you need them'],
    personalLink: 'See the personal forecast',
    natalKicker: 'Natal chart',
    natalTitle: 'Why do you keep reacting this way?',
    natalBody: 'A natal chart helps you notice strengths, familiar reactions, and stories that keep repeating. It does not diagnose you or make choices for you — it shows what is easy to miss from the inside.',
    natalLink: 'Explore your chart',
    compatibilityKicker: 'Compatibility',
    compatibilityTitle: 'Where you click — and where you start getting on each other’s nerves.',
    compatibilityBody: 'Compatibility looks at how you communicate, what you expect from each other, and where things usually go wrong. No promise of forever — just a clearer picture of what is really happening between you.',
    compatibilityLink: 'See how you work together',
    questionsKicker: 'Your questions',
    questionsTitle: 'Got a question you cannot shake?',
    questionsBody: 'Ask about work, money, relationships, relocation, career, or a big decision. The answer uses your chart and current period instead of serving generic internet advice.',
    questionsLink: 'See the questions',
    stepsKicker: 'Getting started',
    stepsTitle: 'You can start in a minute.',
    steps: [
      ['01', 'Choose your starting point', 'Want it quick? Open your zodiac sign. Want it personal? Start with your reading.'],
      ['02', 'Add your birth details', 'A personal forecast needs your birth date, time, and city.'],
      ['03', 'Open what matters now', 'Your day, week, relationships, work, money, chart, and questions are all inside.'],
    ],
    zodiacKicker: 'Zodiac horoscopes',
    zodiacTitle: 'Just want to check your horoscope? Start with your sign.',
    zodiacBody: 'Choose your sign and read the general forecast. You can add a personal reading later.',
    guidesKicker: 'Useful guides',
    guidesTitle: 'Articles that leave you with something clearer than before.',
    finalTitle: 'Start with whatever is on your mind today.',
    finalBody: 'Love, money, work, compatibility, or simply your sign — pick where to begin.',
    previewDate: 'SUNDAY · JULY 26',
    previewTitle: 'Say it clearly today instead of guessing what the other person meant.',
    previewBody: 'The main theme comes first. Then love, work, money, and everything that genuinely matters today.',
    previewTopic: 'One honest conversation is worth more than ten hints right now.',
    heroAlt: 'Person checking a personal forecast on a phone in a bright workspace',
    natalAlt: 'Person reviewing notes about strengths and familiar habits',
    compatibilityAlt: 'Two people having a calm conversation at a table',
    questionsAlt: 'Person working on a laptop and writing down an important question',
  },
  es: {
    badge: 'Tu día, tus preguntas, tu carta',
    heroTitle: 'Mira qué está pasando ahora y hacia dónde va.',
    heroBody: 'Tu día, relaciones, trabajo, dinero, carta natal y compatibilidad. No un texto genérico para todos, sino una lectura pensada para ti.',
    primary: 'Ver la app',
    secondary: 'Leer las guías',
    quick: ['Empieza por tu signo', 'Añade tus datos para una lectura personal', 'Hoy · Semana · Mes · Año'],
    featuresKicker: 'Qué puedes descubrir',
    featuresTitle: 'Mucho más que “qué pasará hoy”. Entiende qué está ocurriendo de verdad contigo.',
    featuresBody: 'Mira tu día, revisa relaciones, aclara trabajo y dinero, comprueba compatibilidad o haz tu propia pregunta. Todo está en la misma app.',
    personalKicker: 'Pronóstico personal',
    personalTitle: 'Tu día, sin frases genéricas.',
    personalBody: 'Primero, lo más importante de hoy. Después: amor, ánimo, hogar, amistades, trabajo y dinero. Léelo todo o salta directamente al tema que necesitas.',
    personalBullets: ['La idea principal aparece primero', 'Solo los temas que importan hoy', 'Semana, mes y año cuando los necesites'],
    personalLink: 'Ver el pronóstico personal',
    natalKicker: 'Carta natal',
    natalTitle: '¿Por qué vuelves a reaccionar así?',
    natalBody: 'La carta natal ayuda a ver fortalezas, reacciones habituales e historias que se repiten. No te diagnostica ni decide por ti: muestra lo que desde dentro suele costar ver.',
    natalLink: 'Explorar tu carta',
    compatibilityKicker: 'Compatibilidad',
    compatibilityTitle: 'Dónde encajáis y dónde empezáis a sacaros de quicio.',
    compatibilityBody: 'La compatibilidad muestra cómo habláis, qué esperáis y en qué punto suelen aparecer los problemas. No promete amor eterno, pero sí ayuda a entender qué pasa de verdad entre vosotros.',
    compatibilityLink: 'Ver cómo encajáis',
    questionsKicker: 'Tus preguntas',
    questionsTitle: '¿Hay una pregunta que no te deja en paz?',
    questionsBody: 'Pregunta por trabajo, dinero, relaciones, mudanzas, profesión o una decisión importante. La respuesta usa tu carta y el momento actual, no un consejo genérico de internet.',
    questionsLink: 'Ver las preguntas',
    stepsKicker: 'Cómo empezar',
    stepsTitle: 'Puedes empezar en un minuto.',
    steps: [
      ['01', 'Elige por dónde entrar', '¿Quieres algo rápido? Abre tu signo. ¿Quieres algo personal? Empieza por tu lectura.'],
      ['02', 'Añade tus datos de nacimiento', 'Para el pronóstico personal hacen falta fecha, hora y ciudad de nacimiento.'],
      ['03', 'Abre lo que importa ahora', 'Tu día, semana, relaciones, trabajo, dinero, carta y preguntas estarán dentro.'],
    ],
    zodiacKicker: 'Horóscopos por signo',
    zodiacTitle: '¿Solo quieres mirar el horóscopo? Empieza por tu signo.',
    zodiacBody: 'Elige tu signo y lee el pronóstico general. La lectura personal puede esperar.',
    guidesKicker: 'Guías útiles',
    guidesTitle: 'Textos que dejan algo más claro que antes.',
    finalTitle: 'Empieza por lo que te preocupa hoy.',
    finalBody: 'Amor, dinero, trabajo, compatibilidad o simplemente tu signo: elige por dónde entrar.',
    previewDate: 'DOMINGO · 26 DE JULIO',
    previewTitle: 'Hoy conviene hablar claro en vez de volver a adivinar qué quiso decir la otra persona.',
    previewBody: 'Primero aparece el tema principal. Después: amor, trabajo, dinero y todo lo que de verdad importa hoy.',
    previewTopic: 'Ahora mismo, una conversación honesta vale más que diez indirectas.',
    heroAlt: 'Persona consultando un pronóstico personal en el teléfono en un espacio de trabajo luminoso',
    natalAlt: 'Persona revisando notas sobre sus fortalezas y hábitos',
    compatibilityAlt: 'Dos personas conversando con calma en una mesa',
    questionsAlt: 'Persona trabajando con un portátil y anotando una pregunta importante',
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const copy = pageCopy[locale];
  return pageMetadata({ locale, title: copy.heroTitle, description: copy.heroBody });
}

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
            <img src="/site/lifestyle-hero.svg" alt={copy.heroAlt} width="1200" height="900" fetchPriority="high" />
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
            <div className="preview-date">{copy.previewDate}</div>
            <h3>{copy.previewTitle}</h3>
            <p>{copy.previewBody}</p>
            <div className="preview-topic"><span>{locale === 'ru' ? 'Любовь' : locale === 'es' ? 'Amor' : 'Love'}</span><strong>{copy.previewTopic}</strong></div>
          </div>
        </div>
      </section>

      <section className="section product-row-section section-peach">
        <div className="shell product-row">
          <div className="product-visual"><img src="/site/lifestyle-natal.svg" alt={copy.natalAlt} width="1200" height="900" loading="lazy" /></div>
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
          <div className="product-visual"><img src="/site/lifestyle-compatibility.svg" alt={copy.compatibilityAlt} width="1200" height="900" loading="lazy" /></div>
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
          <div className="product-visual"><img src="/site/lifestyle-work.svg" alt={copy.questionsAlt} width="1200" height="900" loading="lazy" /></div>
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
