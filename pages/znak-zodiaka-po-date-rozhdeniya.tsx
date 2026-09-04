import Link from 'next/link';
import { PublicSeoPage } from '../components/public-site/PublicSeoPage';
import { ReleaseAction } from '../components/public-site/PublicSiteShell';

const path = '/znak-zodiaka-po-date-rozhdeniya';

const signs = [
  { name: 'Овен', dates: '21 марта – 19 апреля', slug: 'oven' },
  { name: 'Телец', dates: '20 апреля – 20 мая', slug: 'telec' },
  { name: 'Близнецы', dates: '21 мая – 20 июня', slug: 'bliznecy' },
  { name: 'Рак', dates: '21 июня – 22 июля', slug: 'rak' },
  { name: 'Лев', dates: '23 июля – 22 августа', slug: 'lev' },
  { name: 'Дева', dates: '23 августа – 22 сентября', slug: 'deva' },
  { name: 'Весы', dates: '23 сентября – 22 октября', slug: 'vesy' },
  { name: 'Скорпион', dates: '23 октября – 21 ноября', slug: 'skorpion' },
  { name: 'Стрелец', dates: '22 ноября – 21 декабря', slug: 'strelec' },
  { name: 'Козерог', dates: '22 декабря – 19 января', slug: 'kozerog' },
  { name: 'Водолей', dates: '20 января – 18 февраля', slug: 'vodoley' },
  { name: 'Рыбы', dates: '19 февраля – 20 марта', slug: 'ryby' },
] as const;

const faq = [
  {
    question: 'Как определить знак зодиака по дате рождения?',
    answer: 'Найдите день и месяц рождения в таблице. Если дата приходится на границу двух знаков, результат лучше проверить по году, времени и месту рождения.',
  },
  {
    question: 'Почему на разных сайтах даты знаков отличаются?',
    answer: 'Солнце переходит из одного знака в другой в конкретный момент, а не ровно в полночь. Для пограничной даты важны год, время и место рождения.',
  },
  {
    question: 'Знак зодиака и асцендент это одно и то же?',
    answer: 'Нет. Знак зодиака обычно определяют по положению Солнца. Асцендент зависит от точного времени и места рождения.',
  },
] as const;

export default function ZodiacSignByBirthDatePage() {
  return (
    <PublicSeoPage
      path={path}
      title="Знак зодиака по дате рождения: таблица дат"
      description="Определите знак зодиака по дате рождения. Таблица дат для Овна, Тельца, Близнецов и остальных знаков, плюс проверка пограничных дат."
      eyebrow="Знаки зодиака"
      heading="Знак зодиака по дате рождения"
      lead={<p>Найди свой знак по дню и месяцу рождения. Если дата находится на границе двух знаков, проверь её по точному времени и месту.</p>}
      breadcrumbs={[{ name: 'Знак по дате рождения', path }]}
      faq={faq}
      schemaType="CollectionPage"
      relatedLinks={[
        { href: '/goroskop', label: 'Гороскоп на сегодня' },
        { href: '/natalnaya-karta/ascendent', label: 'Асцендент' },
        { href: '/natalnaya-karta/lunnyy-znak', label: 'Лунный знак' },
        { href: '/sovmestimost/znakov', label: 'Совместимость знаков' },
      ]}
    >
      <section>
        <h2>Даты всех знаков зодиака</h2>
        <dl>
          {signs.map((sign) => (
            <div key={sign.slug}>
              <dt><Link href={`/goroskop/${sign.slug}`}>{sign.name}</Link></dt>
              <dd>{sign.dates}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2>Если день рождения на границе знаков</h2>
        <p>Таблица подходит для быстрой проверки. Но переход Солнца в новый знак каждый год происходит в своё время. Человек, родившийся утром и вечером в один день, иногда может получить разные результаты.</p>
        <p>Для точного ответа нужны год, время и место рождения. NEBO использует эти данные при построении <Link href="/natalnaya-karta">натальной карты</Link>.</p>
      </section>

      <section>
        <h2>Что показывает солнечный знак</h2>
        <p>Когда говорят «мой знак зодиака», обычно имеют в виду знак, в котором находилось Солнце. Он описывает общий способ проявлять себя, выбирать направление и отстаивать свою позицию.</p>
        <p>Это важная часть карты, но не вся карта. Луна, асцендент, дома и другие планеты добавляют детали.</p>
      </section>

      <section>
        <h2>Открой гороскоп для своего знака</h2>
        <p>После выбора знака можно перейти к его описанию и открыть гороскоп на сегодня в NEBO.</p>
        <ReleaseAction />
      </section>
    </PublicSeoPage>
  );
}
