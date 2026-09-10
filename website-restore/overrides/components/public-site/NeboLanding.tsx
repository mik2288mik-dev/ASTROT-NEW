import Image from 'next/image';
import Link from 'next/link';
import { MeouForecastScrollStory } from './MeouForecastScrollStory';
import { ReleaseAction } from './PublicSiteShell';
import s from '../../styles/NeboLanding.module.css';

const features = [
  {
    title: 'Личный прогноз',
    text: 'Короткий текст на сегодня, а также прогноз на неделю и месяц. Без одинакового вступления для всех.',
    href: '/lichnyy-goroskop',
    image: '/home/cards/today-hero.webp',
    alt: 'Экран личного прогноза NEBO',
    className: s.featureWide,
  },
  {
    title: 'Натальная карта',
    text: 'Дата, время и место рождения — и можно смотреть карту целиком или разбирать её по частям.',
    href: '/natalnaya-karta',
    image: '/home/cards/natal-map.webp',
    alt: 'Экран натальной карты NEBO',
    className: s.featureTall,
  },
  {
    title: 'Совместимость',
    text: 'Сравни двух людей: что совпадает легко, а где вы можете по-разному реагировать на одно и то же.',
    href: '/sovmestimost',
    image: '/home/cards/compatibility.webp',
    alt: 'Экран совместимости NEBO',
    className: s.featureSmall,
  },
  {
    title: 'Гороскопы по знакам',
    text: 'Быстрый общий прогноз без регистрации — для всех двенадцати знаков.',
    href: '/goroskop',
    image: '/home/cards/horoscope-main.webp',
    alt: 'Экран гороскопов NEBO',
    className: s.featureSmall,
  },
] as const;

const faq = [
  ['Нужно ли знать точное время рождения?', 'Для общего гороскопа — нет. Для натальной карты точное время важно прежде всего для домов и части дополнительных точек.'],
  ['Можно начать бесплатно?', 'Да. Базовая карта, общий гороскоп и часть функций доступны без подписки.'],
  ['Чем личный прогноз отличается от гороскопа по знаку?', 'Гороскоп по знаку общий. Личный прогноз использует сохранённые данные рождения и поэтому может учитывать больше информации.'],
  ['Можно сравнить двух людей?', 'Да. Можно начать с совместимости знаков, а для более подробного сравнения добавить данные рождения обоих людей.'],
] as const;

export function NeboLanding() {
  return (
    <main id="main-content" className={s.page}>
      <section className={s.hero} aria-labelledby="hero-heading">
        <Image
          className={s.heroBackground}
          src="/space/hero.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          aria-hidden="true"
        />
        <div className={s.heroShade} aria-hidden="true" />
        <div className={s.heroInner}>
          <div className={s.heroCopy}>
            <p className={s.kicker}>NEBO · приложение для Android</p>
            <h1 id="hero-heading">Личный прогноз.<br />Натальная карта.<br /><em>Совместимость.</em></h1>
            <p className={s.heroLead}>Один спокойный сервис, чтобы читать прогноз, построить карту рождения и сравнить двух людей. Без мистического спектакля и длинных вступлений.</p>
            <div className={s.heroActions}>
              <ReleaseAction />
              <Link className={s.secondaryButton} href="/natalnaya-karta">Посмотреть натальную карту</Link>
            </div>
            <div className={s.heroFacts} aria-label="Коротко о NEBO">
              <span>Бесплатный старт</span>
              <span>Android</span>
              <span>Данные рождения — по желанию</span>
            </div>
          </div>

          <div className={s.productStage} aria-label="Экраны приложения NEBO">
            <div className={`${s.productCard} ${s.productCardPrimary}`}>
              <Image src="/home/cards/today-hero.webp" alt="Личный прогноз в NEBO" fill priority sizes="(max-width: 800px) 74vw, 30vw" />
            </div>
            <div className={`${s.productCard} ${s.productCardBack}`}>
              <Image src="/home/cards/natal-map.webp" alt="Натальная карта в NEBO" fill sizes="(max-width: 800px) 58vw, 22vw" />
            </div>
            <div className={`${s.productCard} ${s.productCardFront}`}>
              <Image src="/home/cards/compatibility.webp" alt="Совместимость в NEBO" fill sizes="(max-width: 800px) 52vw, 20vw" />
            </div>
          </div>
        </div>
        <a className={s.scrollCue} href="#inside" aria-label="Перейти к возможностям NEBO"><span />Листай</a>
      </section>

      <section className={s.intro} id="inside" aria-labelledby="inside-heading">
        <div className={s.sectionInner}>
          <p className={s.kicker}>Что внутри</p>
          <div className={s.introHeading}>
            <h2 id="inside-heading">Не энциклопедия ради энциклопедии. Сначала то, за чем ты пришёл.</h2>
            <p>На главных экранах — прогноз, карта и совместимость. Справочник находится рядом, когда хочется посмотреть детали.</p>
          </div>

          <div className={s.featureGrid}>
            {features.map((feature) => (
              <Link href={feature.href} className={`${s.featureCard} ${feature.className}`} key={feature.title}>
                <div className={s.featureMedia}>
                  <Image src={feature.image} alt={feature.alt} fill sizes="(max-width: 800px) 100vw, 50vw" />
                </div>
                <div className={s.featureCopy}>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                  <span>Открыть <b aria-hidden="true">↗</b></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className={s.editorialSection} aria-labelledby="natal-heading">
        <Image className={s.sectionBackground} src="/space/nebula.webp" alt="" fill sizes="100vw" aria-hidden="true" />
        <div className={s.sectionShade} aria-hidden="true" />
        <div className={`${s.sectionInner} ${s.editorialGrid}`}>
          <div className={s.editorialCopy}>
            <p className={s.kicker}>Натальная карта по дате рождения</p>
            <h2 id="natal-heading">Смотри всю карту или открывай только то, что интересно сейчас.</h2>
            <p>Натальная карта строится по дате, времени и месту рождения. На сайте можно отдельно посмотреть дома, планеты в знаках и планеты в домах. Основная информация доступна прямо на странице — без обязательной регистрации и лишних переходов.</p>
            <p>Если точное время рождения неизвестно, часть карты всё равно можно посмотреть. Для домов и некоторых положений точность времени уже важна.</p>
          </div>
          <nav className={s.editorialLinks} aria-label="Разделы натальной карты">
            <Link href="/natalnaya-karta"><span>01</span>Натальная карта по дате рождения</Link>
            <Link href="/natalnaya-karta/doma"><span>02</span>12 домов натальной карты</Link>
            <Link href="/natalnaya-karta/planety-v-znakah"><span>03</span>Планеты в знаках</Link>
            <Link href="/natalnaya-karta/planety-v-domah"><span>04</span>Планеты в домах</Link>
          </nav>
        </div>
      </section>

      <section className={s.forecastSection} id="forecast-example" aria-labelledby="forecast-heading">
        <div className={s.sectionInner}>
          <div className={s.forecastHeading}>
            <p className={s.kicker}>Как звучит личный прогноз</p>
            <h2 id="forecast-heading">Два человека. Два разных текста.</h2>
            <p>Не обещание будущего и не текст «для всех». Нормальный короткий прогноз, который можно прочитать за минуту.</p>
          </div>
          <MeouForecastScrollStory />
        </div>
      </section>

      <section className={`${s.editorialSection} ${s.compatSection}`} aria-labelledby="compat-heading">
        <Image className={s.sectionBackground} src="/space/blackhole.webp" alt="" fill sizes="100vw" aria-hidden="true" />
        <div className={s.sectionShade} aria-hidden="true" />
        <div className={`${s.sectionInner} ${s.editorialGrid} ${s.editorialReverse}`}>
          <div className={s.editorialCopy}>
            <p className={s.kicker}>Совместимость</p>
            <h2 id="compat-heading">Без случайного «87% любви».</h2>
            <p>Совместимость знаков даёт быстрый общий ответ. Если добавить данные рождения обоих людей, можно сравнить две карты и посмотреть, где вам проще понимать друг друга, а где реакции расходятся.</p>
            <div className={s.inlineActions}>
              <Link className={s.lightButton} href="/sovmestimost">Сравнить по данным рождения</Link>
              <Link className={s.textButton} href="/sovmestimost/znakov">Совместимость знаков</Link>
            </div>
          </div>
          <div className={s.compatProduct}>
            <Image src="/home/cards/compatibility-cover.webp" alt="Совместимость в приложении NEBO" fill sizes="(max-width: 800px) 92vw, 38vw" />
          </div>
        </div>
      </section>

      <section className={s.exploreSection} aria-labelledby="explore-heading">
        <div className={s.sectionInner}>
          <div className={s.exploreHeader}>
            <div><p className={s.kicker}>Справочник NEBO</p><h2 id="explore-heading">Ищи конкретный ответ, а не блуждай по блогу.</h2></div>
            <p>Здесь собраны отдельные страницы по гороскопам, натальной карте, домам, планетам и совместимости.</p>
          </div>
          <div className={s.exploreGrid}>
            <Link href="/goroskop"><span>Гороскопы</span><strong>Сегодня для всех знаков</strong><b>↗</b></Link>
            <Link href="/natalnaya-karta/doma"><span>Натальная карта</span><strong>12 домов</strong><b>↗</b></Link>
            <Link href="/natalnaya-karta/planety-v-znakah"><span>Натальная карта</span><strong>Планеты в знаках</strong><b>↗</b></Link>
            <Link href="/natalnaya-karta/planety-v-domah"><span>Натальная карта</span><strong>Планеты в домах</strong><b>↗</b></Link>
            <Link href="/sovmestimost/znakov"><span>Совместимость</span><strong>Пары знаков</strong><b>↗</b></Link>
            <Link href="/lichnyy-goroskop"><span>Прогноз</span><strong>Личный гороскоп</strong><b>↗</b></Link>
          </div>
        </div>
      </section>

      <section className={s.howSection} aria-labelledby="how-heading">
        <div className={s.sectionInner}>
          <p className={s.kicker}>Как начать</p>
          <h2 id="how-heading">Три шага. Без анкеты на двадцать экранов.</h2>
          <ol className={s.steps}>
            <li><span>01</span><h3>Открой NEBO</h3><p>Можно начать с гороскопа без заполнения данных рождения.</p></li>
            <li><span>02</span><h3>Добавь данные, если хочешь</h3><p>Дата, время и место рождения нужны для натальной карты и более личного результата.</p></li>
            <li><span>03</span><h3>Выбирай, что посмотреть</h3><p>Сегодня, карта, совместимость или отдельный вопрос из справочника.</p></li>
          </ol>
        </div>
      </section>

      <section className={s.faqSection} aria-labelledby="faq-heading">
        <div className={`${s.sectionInner} ${s.faqGrid}`}>
          <div className={s.faqIntro}><p className={s.kicker}>Вопросы</p><h2 id="faq-heading">Коротко о главном.</h2></div>
          <div className={s.faqList}>
            {faq.map(([question, answer], index) => (
              <details key={question} open={index === 0}>
                <summary>{question}<span aria-hidden="true">+</span></summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className={s.finalCta} aria-labelledby="final-heading">
        <Image className={s.sectionBackground} src="/space/field.webp" alt="" fill sizes="100vw" aria-hidden="true" />
        <div className={s.finalShade} aria-hidden="true" />
        <div className={s.finalInner}>
          <p className={s.kicker}>NEBO для Android</p>
          <h2 id="final-heading">Открой то, что интересно тебе.</h2>
          <p>Личный прогноз, натальная карта, совместимость и большой справочник — в одном месте.</p>
          <div className={s.heroActions}><ReleaseAction /><Link className={s.secondaryButton} href="/goroskop">Начать с гороскопа</Link></div>
        </div>
      </section>
    </main>
  );
}
