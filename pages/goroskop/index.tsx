import Link from 'next/link';
import { PublicSeoPage } from '../../components/public-site/PublicSeoPage';
import { ReleaseAction } from '../../components/public-site/PublicSiteShell';
import { PUBLIC_SEO_SIGNS } from '../../lib/publicSeoContent';

const path = '/goroskop';

const faq = [
  {
    question: 'Гороскоп по знаку и личный гороскоп — одно и то же?',
    answer: 'Нет. Гороскоп по знаку общий. Личный прогноз NEBO учитывает сохранённую натальную карту.',
  },
  {
    question: 'Что можно узнать про свой знак?',
    answer: 'Коротко — как обычно описывают этот знак, его сильные стороны, привычные реакции и особенности общения.',
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
      title="Гороскоп по знакам зодиака"
      description="Гороскоп для всех знаков зодиака в NEBO: Овен, Телец, Близнецы и остальные знаки, плюс личный прогноз по натальной карте."
      eyebrow="Знаки зодиака"
      heading="Гороскоп для всех знаков зодиака"
      lead={<p>Выбери свой знак, посмотри его краткое описание и открой ежедневный гороскоп. Если хочется текста именно про тебя — есть личный прогноз по натальной карте.</p>}
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
        <h2>Выбери знак</h2>
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
        <h2>Знак — это только часть картины</h2>
        <p>Солнечный знак даёт общее описание. У людей одного знака многое может быть совсем по-разному.</p>
        <p>Если хочется больше деталей, <Link href="/natalnaya-karta">натальная карта</Link> показывает планеты, дома и связи между ними, а <Link href="/lichnyy-goroskop">личный прогноз</Link> учитывает твою сохранённую карту.</p>
      </section>

      <section>
        <h2>Гороскоп на каждый день</h2>
        <p>Общий ежедневный гороскоп по знаку доступен бесплатно в NEBO.</p>
        <ReleaseAction />
      </section>
    </PublicSeoPage>
  );
}
