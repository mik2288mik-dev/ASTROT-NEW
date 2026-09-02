import type { GetStaticPaths, GetStaticProps, InferGetStaticPropsType } from 'next';
import Link from 'next/link';
import { PublicSeoPage } from '../../../components/public-site/PublicSeoPage';
import { PUBLIC_SEO_HOUSES, findPublicSeoHouseBySlug, type PublicSeoHouse } from '../../../lib/publicSeoHouses';

type Props = { house: PublicSeoHouse };
type Params = { house: string };

export const getStaticPaths: GetStaticPaths<Params> = async () => ({
  paths: PUBLIC_SEO_HOUSES.map((house) => ({ params: { house: house.slug } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps<Props, Params> = async ({ params }) => {
  const house = findPublicSeoHouseBySlug(params?.house || '');
  if (!house) return { notFound: true };
  return { props: { house } };
};

export default function HousePage({ house }: InferGetStaticPropsType<typeof getStaticProps>) {
  const previous = PUBLIC_SEO_HOUSES[(house.house + 10) % 12];
  const next = PUBLIC_SEO_HOUSES[house.house % 12];
  return (
    <PublicSeoPage
      path={house.path}
      title={`${house.title} в натальной карте — значение`}
      description={`${house.title}: что означает этот дом в натальной карте, какие вопросы к нему относят и как его читать вместе со знаком и планетами.`}
      eyebrow={`Дома · ${house.house} из 12`}
      heading={`${house.title} в натальной карте`}
      lead={<p>{house.summary}</p>}
      breadcrumbs={[
        { name: 'Натальная карта', path: '/natalnaya-karta' },
        { name: 'Дома', path: '/natalnaya-karta/doma' },
        { name: house.title, path: house.path },
      ]}
      faq={[
        { question: `Что означает ${house.house} дом?`, answer: house.shortAnswer },
        { question: 'Можно ли читать дом отдельно?', answer: 'Для первого знакомства — да, но в полной карте учитывают знак на границе дома, планеты внутри него и аспекты. Одно положение не описывает человека целиком.' },
      ]}
      relatedLinks={[
        { href: previous.path, label: previous.title },
        { href: next.path, label: next.title },
        { href: '/natalnaya-karta/planety-v-domah', label: 'Планеты в домах' },
        { href: '/natalnaya-karta', label: 'Рассчитать натальную карту' },
      ]}
    >
      <section><h2>Короткий ответ</h2><p>{house.shortAnswer}</p></section>
      {house.sections.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </section>
      ))}
      <section>
        <h2>Что смотреть дальше</h2>
        <p>Если в этом доме есть планета, её значение читается вместе с домом. Открой <Link href="/natalnaya-karta/planety-v-domah">каталог планет в домах</Link> или рассчитай собственную карту.</p>
      </section>
    </PublicSeoPage>
  );
}
