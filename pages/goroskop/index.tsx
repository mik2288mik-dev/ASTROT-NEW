import Link from 'next/link';
import { PublicSeoPage } from '../../components/public-site/PublicSeoPage';
import { ReleaseAction } from '../../components/public-site/PublicSiteShell';
import { PUBLIC_SEO_SIGNS } from '../../lib/publicSeoContent';

const path = '/goroskop';

const faq = [
  {
    question: 'Гороскоп по знаку и личный прогноз это одно и то же?',
    answer: 'Нет. Гороскоп по знаку общий. Личный прогноз учитывает дату, время и место рождения.',
  },
  {
    question: 'Что можно узнать про свой знак?',
    answer: 'Коротко о характере знака, его сильных сторонах, привычных реакциях и общении с другими людьми.',
  },
  {
    question: 'Нужно ли знать время рождения?',
    answer: 'Для гороскопа по солнечному знаку достаточно даты рождения. Время и место нужны, если хочется построить полную натальную карту.',
  },
] as const;

export default function HoroscopeHubPage() {
  return (
    <PublicSeoPage
      path={path}
      title="Гороскоп на сегодня для всех знаков зодиака"
      description="Выберите знак зодиака и откройте гороскоп на сегодня в NEBO. Овен, Телец, Близнецы и остальные знаки, а также личный прогноз."
      eyebrow="Гороскоп на сегодня"
      heading="Гороскоп на сегодня для всех знаков зодиака"
      lead={<p>Выбери свой знак и открой гороскоп на сегодня. Для более личного прогноза можно добавить дату, время и место рождения.</p>}
      breadcrumbs={[{ name: 'Гороскоп по знакам', path }]}
      faq={faq}
      schemaType="CollectionPage"
      relatedLinks={[
        { href: '/lichnyy-goroskop', label: 'Личный гороскоп' },
        { href: '/natalnaya-karta', label: 'Натальная карта' },
        { href: '/sovmestimost/znakov', label: 'Совместимость знаков' },
      ]}
    >
      <section>
        <h2>Выбери свой знак зодиака</h2>
        <ul>
          {PUBLIC_SEO_SIGNS.map((sign) => (
            <li key={sign.key}>
              <Link href={`/goroskop/${sign.slug}`}>{sign.name}</Link>
              {' — '}{sign.shortAnswer}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Знак зодиака это только начало</h2>
        <p>Солнечный знак даёт общее описание. У людей одного знака многое может быть совсем по-разному.</p>
        <p>Если хочется больше деталей, <Link href="/natalnaya-karta">натальная карта</Link> показывает планеты, дома и связи между ними. <Link href="/lichnyy-goroskop">Личный прогноз</Link> учитывает твои данные рождения.</p>
        <p><Link href="/znak-zodiaka-po-date-rozhdeniya">Найти знак зодиака по дате рождения</Link> можно в отдельной таблице.</p>
      </section>

      <section>
        <h2>Гороскоп на каждый день</h2>
        <p>Общий ежедневный гороскоп по знаку доступен бесплатно в NEBO.</p>
        <ReleaseAction />
      </section>
    </PublicSeoPage>
  );
}
