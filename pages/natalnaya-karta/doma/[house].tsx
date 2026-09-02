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
      description={`${house.title}: что обычно связывают с этим домом натальной карты и что смотреть дальше.`}
      eyebrow={`Натальная карта · ${house.title}`}
      heading={`${house.title} в натальной карте`}
      lead={<p>{house.summary}</p>}
      breadcrumbs={[
        { name: 'Натальная карта', path: '/natalnaya-karta' },
        { name: 'Дома', path: '/natalnaya-karta/doma' },
        { name: house.title, path: house.path },
      ]}
      faq={[
        { question: `Что означает ${house.house} дом?`, answer: house.shortAnswer },
        { question: 'Можно ли судить о человеке только по этому дому?', answer: 'Нет. Это лишь одна часть карты. Для более полной картины смотрят также знак и планеты в этом доме.' },
      ]}
      relatedLinks={[
        { href: previous.path, label: previous.title },
        { href: next.path, label: next.title },
        { href: '/natalnaya-karta/planety-v-domah', label: 'Планеты в домах' },
        { href: '/natalnaya-karta', label: 'Натальная карта' },
      ]}
    >
      <section><h2>Коротко</h2><p>{house.shortAnswer}</p></section>
      {house.sections.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </section>
      ))}
      <section>
        <h2>Что посмотреть дальше</h2>
        <p>Если в этом доме есть планета, открой <Link href="/natalnaya-karta/planety-v-domah">планеты в домах</Link> и посмотри, что она добавляет к общей картине.</p>
      </section>
    </PublicSeoPage>
  );
}
