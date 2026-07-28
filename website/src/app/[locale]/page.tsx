import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { StoreButtons } from '@/components/StoreButtons';
import { getDictionary } from '@/lib/i18n';
import { pageMetadata, organizationJsonLd, softwareApplicationJsonLd, websiteJsonLd } from '@/lib/seo';
import { isLocale } from '@/lib/site';
import { zodiacSlugs, getZodiacInfo } from '@/lib/zodiac';

const zodiacSymbols = ['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'] as const;

const copy = {
  ru: {
    badge: 'Твой Гороскоп',
    heroLine: 'Гороскоп — общий.',
    heroAccent: 'Этот разбор про тебя.',
    heroBody: 'Дата, время и место рождения — и приложение собирает личный прогноз, натальную карту и совместимость. Без страшилок, приговоров и космической воды.',
    primary: 'Посмотреть, что внутри',
    secondary: 'Начать со знака',
    chips: ['Личный прогноз', 'Натальная карта', 'Совместимость', 'Свои вопросы'],
    phoneKicker: 'ЛИЧНЫЙ РАЗБОР',
    phoneTitle: 'Не гадай, что имелось в виду. Спроси прямо.',
    phoneBody: 'Разговор, который ты откладываешь, не станет проще от ещё одной недели молчания.',
    phoneCards: [
      ['Любовь', 'Хватит намёков'],
      ['Работа', 'Закрой один хвост'],
      ['Деньги', 'Не покупай на эмоциях'],
    ],
    insideEyebrow: 'Что внутри',
    insideTitle: 'Всё нужное. Без астрологического квеста.',
    insideBody: 'Выбираешь тему — сразу получаешь понятный разбор. Термины и расчёты остаются под капотом.',
    features: [
      ['Личный прогноз', 'Главное — сразу. Потом любовь, работа, деньги и всё остальное.', 'personal-horoscope'],
      ['Натальная карта', 'Не «ты сложный человек», а что именно у тебя работает так.', 'natal-chart'],
      ['Совместимость', 'Где вас тянет друг к другу, а где оба жмёте не на ту кнопку.', 'compatibility'],
      ['Свои вопросы', 'Про отношения, деньги, переезд и решения, которые не дают покоя.', 'questions'],
    ],
    voiceEyebrow: 'Как мы говорим',
    voiceTitle: 'Без «энергии дня». По-человечески.',
    voiceBody: 'Как добрый дерзкий друг: скажет правду, не напугает и не станет решать за тебя.',
    quote: 'Ты не обязан отвечать сразу. Но делать вид, что вопроса нет, — тоже план так себе.',
    toneTags: ['Честно', 'Без фатализма', 'С пользой'],
    zodiacEyebrow: 'Можно начать проще',
    zodiacTitle: 'Сначала знак. Личный разбор — когда захочешь.',
    zodiacBody: 'Быстрый вход без анкеты и лишних обещаний.',
    finalTitle: 'Ну что, посмотрим, что там у тебя?',
    finalBody: 'Начни со знака или добавь данные рождения для персонального разбора.',
    quoteFooter: 'Без занудства',
    me: 'Я',
  },
  en: {
    badge: 'Your Horoscope',
    heroLine: 'Horoscopes are general.',
    heroAccent: 'This reading is about you.',
    heroBody: 'Add your birth date, time, and place to get a personal forecast, natal chart, and compatibility reading — without fear, verdicts, or cosmic filler.',
    primary: 'See what is inside',
    secondary: 'Start with your sign',
    chips: ['Personal forecast', 'Natal chart', 'Compatibility', 'Your questions'],
    phoneKicker: 'PERSONAL READING',
    phoneTitle: 'Stop guessing what they meant. Ask directly.',
    phoneBody: 'The conversation you keep postponing will not get easier after another week of silence.',
    phoneCards: [
      ['Love', 'Enough with hints'],
      ['Work', 'Close one loose end'],
      ['Money', 'Do not shop your mood'],
    ],
    insideEyebrow: 'Inside the app',
    insideTitle: 'Everything useful. No astrology obstacle course.',
    insideBody: 'Pick a topic and get a clear reading. The terms and calculations stay under the hood.',
    features: [
      ['Personal forecast', 'The main point first. Then love, work, money, and everything else.', 'personal-horoscope'],
      ['Natal chart', 'Not “you are complicated,” but what actually works that way in you.', 'natal-chart'],
      ['Compatibility', 'Where you click — and where both of you keep pressing the wrong button.', 'compatibility'],
      ['Your questions', 'Relationships, money, moving, and decisions that will not leave you alone.', 'questions'],
    ],
    voiceEyebrow: 'How we talk',
    voiceTitle: 'No “energy of the day.” Just human.',
    voiceBody: 'Like a kind, bold friend: honest, supportive, and never fatalistic.',
    quote: 'You do not have to answer right away. Pretending the question is not there is still a pretty bad plan.',
    toneTags: ['Honest', 'No fatalism', 'Useful'],
    zodiacEyebrow: 'Start simple',
    zodiacTitle: 'Your sign first. A personal reading when you are ready.',
    zodiacBody: 'A quick entry without a long form or big promises.',
    finalTitle: 'So, shall we see what is going on with you?',
    finalBody: 'Start with your sign or add birth details for a personal reading.',
    quoteFooter: 'No fluff',
    me: 'Me',
  },
  es: {
    badge: 'Tu Horóscopo',
    heroLine: 'El horóscopo es general.',
    heroAccent: 'Esta lectura habla de ti.',
    heroBody: 'Añade fecha, hora y lugar de nacimiento para recibir un pronóstico personal, carta natal y compatibilidad, sin miedo, sentencias ni relleno cósmico.',
    primary: 'Ver qué hay dentro',
    secondary: 'Empezar por mi signo',
    chips: ['Pronóstico personal', 'Carta natal', 'Compatibilidad', 'Tus preguntas'],
    phoneKicker: 'LECTURA PERSONAL',
    phoneTitle: 'Deja de adivinar qué quiso decir. Pregunta.',
    phoneBody: 'La conversación que sigues posponiendo no será más fácil después de otra semana de silencio.',
    phoneCards: [
      ['Amor', 'Basta de indirectas'],
      ['Trabajo', 'Cierra un pendiente'],
      ['Dinero', 'No compres tu enfado'],
    ],
    insideEyebrow: 'Dentro de la app',
    insideTitle: 'Todo lo útil. Sin una carrera de obstáculos astrológica.',
    insideBody: 'Elige un tema y recibe una lectura clara. Los términos y cálculos se quedan bajo el capó.',
    features: [
      ['Pronóstico personal', 'Primero lo importante. Después amor, trabajo, dinero y lo demás.', 'personal-horoscope'],
      ['Carta natal', 'No “eres una persona complicada”, sino qué funciona así en ti.', 'natal-chart'],
      ['Compatibilidad', 'Dónde conectáis y dónde ambos pulsáis el botón equivocado.', 'compatibility'],
      ['Tus preguntas', 'Relaciones, dinero, mudanzas y decisiones que no te dejan en paz.', 'questions'],
    ],
    voiceEyebrow: 'Cómo hablamos',
    voiceTitle: 'Sin “energía del día”. Como personas.',
    voiceBody: 'Como un amigo amable y directo: sincero, cercano y nunca fatalista.',
    quote: 'No tienes que responder ahora. Pero fingir que la pregunta no existe también es un plan bastante malo.',
    toneTags: ['Sincero', 'Sin fatalismo', 'Útil'],
    zodiacEyebrow: 'Empieza fácil',
    zodiacTitle: 'Primero tu signo. La lectura personal, cuando quieras.',
    zodiacBody: 'Una entrada rápida sin formulario largo ni grandes promesas.',
    finalTitle: 'Entonces, ¿vemos qué pasa contigo?',
    finalBody: 'Empieza por tu signo o añade tus datos de nacimiento para una lectura personal.',
    quoteFooter: 'Sin relleno',
    me: 'Yo',
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const page = copy[locale];
  return pageMetadata({ locale, title: `${page.heroLine} ${page.heroAccent}`, description: page.heroBody });
}

export default async function LocaleHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const page = copy[locale];
  const dict = getDictionary(locale);
  const appJsonLd = softwareApplicationJsonLd(locale);

  return (
    <div className="home-v3">
      <JsonLd data={organizationJsonLd(locale)} />
      <JsonLd data={websiteJsonLd(locale)} />
      {appJsonLd ? <JsonLd data={appJsonLd} /> : null}

      <section className="v3-hero">
        <div className="v3-hero-glow v3-hero-glow-a" aria-hidden="true" />
        <div className="v3-hero-glow v3-hero-glow-b" aria-hidden="true" />
        <div className="v3-shell v3-hero-grid">
          <div className="v3-hero-copy">
            <p className="v3-kicker"><span aria-hidden="true" />{page.badge}</p>
            <h1><span>{page.heroLine}</span><strong>{page.heroAccent}</strong></h1>
            <p className="v3-hero-lead">{page.heroBody}</p>
            <div className="v3-actions">
              <Link className="v3-button v3-button-primary" href={`/${locale}#inside`}>{page.primary}</Link>
              <Link className="v3-button v3-button-ghost" href={`/${locale}/zodiac`}>{page.secondary}</Link>
            </div>
            <ul className="v3-chip-row">
              {page.chips.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>

          <div className="v3-device-stage" aria-label={page.phoneKicker}>
            <div className="v3-orbit v3-orbit-one" aria-hidden="true" />
            <div className="v3-orbit v3-orbit-two" aria-hidden="true" />
            <div className="v3-planet" aria-hidden="true" />
            <div className="v3-float-card v3-float-natal">
              <span>✦</span>
              <div><b>{page.chips[1]}</b><small>11 · 32 · 8</small></div>
            </div>
            <div className="v3-float-card v3-float-match">
              <span>82%</span>
              <div><b>{page.chips[2]}</b><small>♡</small></div>
            </div>

            <div className="v3-phone">
              <div className="v3-phone-speaker" aria-hidden="true" />
              <div className="v3-phone-screen">
                <div className="v3-phone-top">
                  <span>{page.badge}</span>
                  <span className="v3-phone-avatar">{page.me}</span>
                </div>
                <div className="v3-phone-hero-card">
                  <small>{page.phoneKicker}</small>
                  <h2>{page.phoneTitle}</h2>
                  <p>{page.phoneBody}</p>
                  <span className="v3-phone-arrow" aria-hidden="true">→</span>
                </div>
                <div className="v3-phone-cards">
                  {page.phoneCards.map(([title, body], index) => (
                    <div className={`v3-phone-card v3-phone-card-${index + 1}`} key={title}>
                      <span>{title}</span>
                      <strong>{body}</strong>
                    </div>
                  ))}
                </div>
                <div className="v3-phone-nav" aria-hidden="true">
                  <span className="active">●</span><span>○</span><span>◇</span><span>☰</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="v3-signal-strip" aria-hidden="true">
        {[...page.chips, ...page.chips].map((item, index) => <span key={`${item}-${index}`}>{item}<b>✦</b></span>)}
      </div>

      <section className="v3-section" id="inside">
        <div className="v3-shell">
          <div className="v3-section-head">
            <p className="v3-eyebrow">{page.insideEyebrow}</p>
            <h2>{page.insideTitle}</h2>
            <p>{page.insideBody}</p>
          </div>
          <div className="v3-bento">
            {page.features.map(([title, body, slug], index) => (
              <Link className={`v3-feature v3-feature-${index + 1}`} href={`/${locale}/${slug}`} key={slug}>
                <span className="v3-feature-number">0{index + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
                <span className="v3-feature-arrow">↗</span>
                {index === 0 ? <div className="v3-mini-stack" aria-hidden="true"><i /><i /><i /></div> : null}
                {index === 1 ? <div className="v3-mini-chart" aria-hidden="true"><i /><i /><i /></div> : null}
                {index === 2 ? <div className="v3-mini-match" aria-hidden="true"><i>♡</i><b>82%</b></div> : null}
                {index === 3 ? <div className="v3-mini-question" aria-hidden="true">?</div> : null}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="v3-voice">
        <div className="v3-shell v3-voice-grid">
          <div className="v3-voice-copy">
            <p className="v3-eyebrow">{page.voiceEyebrow}</p>
            <h2>{page.voiceTitle}</h2>
            <p>{page.voiceBody}</p>
            <div className="v3-tone-tags">{page.toneTags.map((tag) => <span key={tag}>{tag}</span>)}</div>
          </div>
          <blockquote className="v3-quote">
            <span className="v3-quote-mark">“</span>
            <p>{page.quote}</p>
            <div className="v3-quote-footer"><span>{page.badge}</span><span>{page.quoteFooter}</span></div>
          </blockquote>
        </div>
      </section>

      <section className="v3-section v3-zodiac-section">
        <div className="v3-shell">
          <div className="v3-section-head v3-section-head-split">
            <div>
              <p className="v3-eyebrow">{page.zodiacEyebrow}</p>
              <h2>{page.zodiacTitle}</h2>
            </div>
            <p>{page.zodiacBody}</p>
          </div>
          <div className="v3-zodiac-grid">
            {zodiacSlugs.map((sign, index) => {
              const info = getZodiacInfo(locale, sign);
              return (
                <Link className="v3-zodiac-card" key={sign} href={`/${locale}/zodiac/${sign}`}>
                  <span className="v3-zodiac-symbol">{zodiacSymbols[index]}</span>
                  <strong>{info.name}</strong>
                  <small>{info.dates}</small>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="v3-final-wrap">
        <div className="v3-shell v3-final">
          <div className="v3-final-planet" aria-hidden="true" />
          <div>
            <p className="v3-kicker"><span aria-hidden="true" />{page.badge}</p>
            <h2>{page.finalTitle}</h2>
            <p>{page.finalBody}</p>
          </div>
          <StoreButtons fallback={dict.common.comingSoon} />
        </div>
      </section>
    </div>
  );
}
