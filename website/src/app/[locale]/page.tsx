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
    seoTitle: 'Личный гороскоп, натальная карта и совместимость',
    seoDescription: 'Личный прогноз на сегодня, неделю, месяц и год, натальная карта, совместимость и гороскопы по знакам в приложении «Твой Гороскоп».',
    badge: 'Личный гороскоп по твоим данным',
    heroTitle: 'Не просто «что там у Овнов». Здесь всё про тебя.',
    heroBody: 'Посмотри, что происходит сегодня, разберись в отношениях, работе и деньгах, открой натальную карту или проверь совместимость. Без страшилок и готовых приговоров.',
    primary: 'Посмотреть, что внутри',
    secondary: 'Начать со знака',
    quick: ['Сегодня, неделя, месяц и год', 'Натальная карта и совместимость', 'Свои вопросы — про то, что правда волнует'],
    featuresKicker: 'Что есть в приложении',
    featuresTitle: 'Один вопрос — один нормальный ответ.',
    featuresBody: 'Не надо учить астрологические термины. Выбираешь, что волнует, и сразу идёшь туда: день, отношения, работа, деньги, карта или совместимость.',
    personalKicker: 'Личный прогноз',
    personalTitle: 'Что сегодня важно именно тебе',
    personalBody: 'Сначала коротко — о главном. Потом можно пройтись по любви, настроению, дому, друзьям, работе и деньгам. Без одинаковых советов на все случаи жизни.',
    personalBullets: ['Сегодня — главное без длинного вступления', 'Неделя и месяц — чтобы видеть дальше одного дня', 'Год — чтобы не потерять большой сюжет'],
    personalLink: 'Посмотреть личный прогноз',
    natalKicker: 'Натальная карта',
    natalTitle: 'Почему ты снова реагируешь именно так',
    natalBody: 'Карта помогает заметить сильные стороны, привычные реакции и истории, которые повторяются. Не решает за тебя, кем быть и что делать. Просто показывает то, что изнутри обычно не видно.',
    natalLink: 'Разобрать свою карту',
    compatibilityKicker: 'Совместимость',
    compatibilityTitle: 'Почему вас тянет друг к другу — и почему вы спорите об одном и том же',
    compatibilityBody: 'Посмотри, как вы общаетесь, чего ждёте друг от друга и где чаще всего начинаются сложности. Это не вердикт отношениям. Это способ лучше понять, что между вами происходит.',
    compatibilityLink: 'Посмотреть совместимость',
    questionsKicker: 'Свои вопросы',
    questionsTitle: 'Спроси прямо. Про то, что не отпускает.',
    questionsBody: 'Работа, деньги, отношения, переезд, новая профессия или большое решение. Выбираешь вопрос — получаешь разбор с учётом своей карты и текущего периода.',
    questionsLink: 'Посмотреть вопросы',
    stepsKicker: 'Как начать',
    stepsTitle: 'Заходи так, как удобно тебе',
    steps: [
      ['01', 'Хочешь быстро?', 'Выбери знак и сразу читай общий гороскоп. Без длинной анкеты.'],
      ['02', 'Хочешь точнее?', 'Добавь дату, время и город рождения — откроется личный разбор.'],
      ['03', 'Дальше выбирай тему', 'Сегодня, неделя, отношения, работа, деньги, карта, совместимость или свой вопрос.'],
    ],
    zodiacKicker: 'Гороскопы по знакам',
    zodiacTitle: 'Хочешь быстро? Просто выбери знак.',
    zodiacBody: 'Открой общий прогноз и посмотри, что там на сегодня, неделю или месяц. Личный разбор можно добавить позже.',
    guidesKicker: 'Разборы и статьи',
    guidesTitle: 'Тексты, которые можно дочитать без зевка.',
    finalTitle: 'Начни с того, что сейчас не даёт покоя.',
    finalBody: 'Любовь, работа, деньги, совместимость или просто твой знак — нужный раздел уже рядом.',
    previewDate: 'ВОСКРЕСЕНЬЕ · 26 ИЮЛЯ',
    previewTitle: 'Сегодня лучше сказать прямо, чем снова ждать, что тебя поймут без слов.',
    previewBody: 'Сначала — главная тема дня. Дальше можно сразу перейти к любви, работе, деньгам или другой важной для тебя теме.',
    previewTopic: 'Один честный разговор сейчас полезнее десяти намёков.',
    heroAlt: 'Человек смотрит личный гороскоп в телефоне за ярким рабочим столом',
    natalAlt: 'Человек разбирает заметки о своих сильных сторонах и привычных реакциях',
    compatibilityAlt: 'Два человека спокойно разговаривают за столом',
    questionsAlt: 'Человек работает за ноутбуком и записывает важный вопрос',
  },
  en: {
    seoTitle: 'Personal horoscope, natal chart, and compatibility',
    seoDescription: 'Personal forecasts for today, week, month, and year, plus natal chart, compatibility, questions, and zodiac horoscopes in Your Horoscope.',
    badge: 'A personal horoscope built around you',
    heroTitle: 'Not just “what is happening for Aries.” This one is about you.',
    heroBody: 'Check your day, sort through relationships, work, and money, explore your natal chart, or look at compatibility. No scare tactics and no verdicts about your future.',
    primary: 'See what is inside',
    secondary: 'Start with your sign',
    quick: ['Today, week, month, and year', 'Natal chart and compatibility', 'Your own questions about real life'],
    featuresKicker: 'Inside the app',
    featuresTitle: 'One question. One useful answer.',
    featuresBody: 'No astrology homework required. Pick what is on your mind and go straight there: your day, relationships, work, money, chart, or compatibility.',
    personalKicker: 'Personal forecast',
    personalTitle: 'What matters for you today',
    personalBody: 'Start with the main point. Then move through love, mood, home, friends, work, and money. No one-size-fits-all advice.',
    personalBullets: ['Today — the main point first', 'Week and month — a wider view', 'Year — the bigger story'],
    personalLink: 'See the personal forecast',
    natalKicker: 'Natal chart',
    natalTitle: 'Why do you keep reacting this way?',
    natalBody: 'Your chart can help you notice strengths, familiar reactions, and stories that keep repeating. It does not decide who you are. It shows what can be hard to see from the inside.',
    natalLink: 'Explore your chart',
    compatibilityKicker: 'Compatibility',
    compatibilityTitle: 'Why you click — and why the same argument keeps coming back',
    compatibilityBody: 'See how you communicate, what you expect from each other, and where things usually get difficult. Not a relationship verdict — a clearer view of what is happening between you.',
    compatibilityLink: 'Explore compatibility',
    questionsKicker: 'Your questions',
    questionsTitle: 'Ask directly about what will not leave your mind.',
    questionsBody: 'Work, money, relationships, relocation, a new career, or a major decision. Choose a question and get a reading shaped by your chart and current period.',
    questionsLink: 'See the questions',
    stepsKicker: 'How to start',
    stepsTitle: 'Start the way that suits you',
    steps: [
      ['01', 'Want it quick?', 'Choose your sign and read a general horoscope right away.'],
      ['02', 'Want it personal?', 'Add your birth date, time, and city to open your personal reading.'],
      ['03', 'Then choose the topic', 'Today, week, relationships, work, money, chart, compatibility, or your own question.'],
    ],
    zodiacKicker: 'Zodiac horoscopes',
    zodiacTitle: 'Want it quick? Just choose your sign.',
    zodiacBody: 'Open a general forecast for today, the week, or the month. You can add a personal reading later.',
    guidesKicker: 'Guides and articles',
    guidesTitle: 'Useful reading that does not feel like homework.',
    finalTitle: 'Start with whatever is on your mind right now.',
    finalBody: 'Love, work, money, compatibility, or simply your sign — the right section is already here.',
    previewDate: 'SUNDAY · JULY 26',
    previewTitle: 'Say it clearly today instead of hoping they will read your mind.',
    previewBody: 'The main theme comes first. Then jump straight to love, work, money, or whatever matters most to you.',
    previewTopic: 'One honest conversation is worth more than ten hints right now.',
    heroAlt: 'Person checking a personal horoscope on a phone in a bright workspace',
    natalAlt: 'Person reviewing notes about strengths and familiar reactions',
    compatibilityAlt: 'Two people having a calm conversation at a table',
    questionsAlt: 'Person working on a laptop and writing down an important question',
  },
  es: {
    seoTitle: 'Horóscopo personal, carta natal y compatibilidad',
    seoDescription: 'Pronóstico personal para hoy, semana, mes y año, carta natal, compatibilidad, preguntas y horóscopos por signo en Tu Horóscopo.',
    badge: 'Un horóscopo personal hecho para ti',
    heroTitle: 'No solo “qué pasa con Aries”. Aquí hablamos de ti.',
    heroBody: 'Mira tu día, aclara relaciones, trabajo y dinero, explora tu carta natal o revisa compatibilidad. Sin alarmismo ni sentencias sobre tu futuro.',
    primary: 'Ver qué hay dentro',
    secondary: 'Empezar por mi signo',
    quick: ['Hoy, semana, mes y año', 'Carta natal y compatibilidad', 'Tus propias preguntas sobre la vida real'],
    featuresKicker: 'Dentro de la app',
    featuresTitle: 'Una pregunta. Una respuesta útil.',
    featuresBody: 'No necesitas aprender términos de astrología. Elige lo que te preocupa y ve directo: día, relaciones, trabajo, dinero, carta o compatibilidad.',
    personalKicker: 'Pronóstico personal',
    personalTitle: 'Lo importante para ti hoy',
    personalBody: 'Primero, la idea principal. Después: amor, ánimo, hogar, amistades, trabajo y dinero. Sin consejos genéricos para todo el mundo.',
    personalBullets: ['Hoy — lo importante primero', 'Semana y mes — una mirada más amplia', 'Año — la historia completa'],
    personalLink: 'Ver el pronóstico personal',
    natalKicker: 'Carta natal',
    natalTitle: '¿Por qué vuelves a reaccionar así?',
    natalBody: 'Tu carta puede ayudarte a ver fortalezas, reacciones habituales e historias que se repiten. No decide quién eres. Muestra lo que desde dentro suele costar ver.',
    natalLink: 'Explorar tu carta',
    compatibilityKicker: 'Compatibilidad',
    compatibilityTitle: 'Por qué conectáis — y por qué vuelve siempre la misma discusión',
    compatibilityBody: 'Mira cómo os comunicáis, qué esperáis y dónde suelen empezar las dificultades. No es un veredicto: es una forma más clara de entender qué pasa entre vosotros.',
    compatibilityLink: 'Ver compatibilidad',
    questionsKicker: 'Tus preguntas',
    questionsTitle: 'Pregunta directamente por eso que no te deja en paz.',
    questionsBody: 'Trabajo, dinero, relaciones, mudanza, nueva profesión o una decisión importante. Elige una pregunta y recibe una lectura basada en tu carta y el momento actual.',
    questionsLink: 'Ver las preguntas',
    stepsKicker: 'Cómo empezar',
    stepsTitle: 'Empieza como te resulte más cómodo',
    steps: [
      ['01', '¿Lo quieres rápido?', 'Elige tu signo y lee el horóscopo general al momento.'],
      ['02', '¿Lo quieres personal?', 'Añade fecha, hora y ciudad de nacimiento para abrir tu lectura personal.'],
      ['03', 'Después, elige el tema', 'Hoy, semana, relaciones, trabajo, dinero, carta, compatibilidad o tu propia pregunta.'],
    ],
    zodiacKicker: 'Horóscopos por signo',
    zodiacTitle: '¿Lo quieres rápido? Elige tu signo.',
    zodiacBody: 'Abre el pronóstico general de hoy, la semana o el mes. Puedes añadir la lectura personal más tarde.',
    guidesKicker: 'Guías y artículos',
    guidesTitle: 'Lecturas útiles que no parecen deberes.',
    finalTitle: 'Empieza por lo que ahora mismo no te deja tranquilo.',
    finalBody: 'Amor, trabajo, dinero, compatibilidad o simplemente tu signo: la sección adecuada ya está aquí.',
    previewDate: 'DOMINGO · 26 DE JULIO',
    previewTitle: 'Hoy conviene hablar claro en vez de esperar que te lean la mente.',
    previewBody: 'Primero aparece el tema principal. Después puedes ir directo a amor, trabajo, dinero o lo que más te importa.',
    previewTopic: 'Ahora mismo, una conversación honesta vale más que diez indirectas.',
    heroAlt: 'Persona consultando un horóscopo personal en el teléfono en un espacio de trabajo luminoso',
    natalAlt: 'Persona revisando notas sobre sus fortalezas y reacciones habituales',
    compatibilityAlt: 'Dos personas conversando con calma en una mesa',
    questionsAlt: 'Persona trabajando con un portátil y anotando una pregunta importante',
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const copy = pageCopy[locale];
  return pageMetadata({ locale, title: copy.seoTitle, description: copy.seoDescription });
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
              <Link className="button button-ghost" href={`/${locale}/zodiac`}>{copy.secondary}</Link>
            </div>
            <ul className="quick-proof">
              {copy.quick.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
          <div className="hero-image-wrap">
            <img src="/site/lifestyle-hero.svg" alt={copy.heroAlt} width="1200" height="900" fetchPriority="high" />
            <div className="hero-float-card hero-float-top"><strong>{copy.personalKicker}</strong><span>{copy.personalBullets[0]}</span></div>
            <div className="hero-float-card hero-float-bottom"><strong>{copy.compatibilityKicker}</strong><span>{copy.compatibilityTitle}</span></div>
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
