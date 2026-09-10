import type { GetStaticPaths, GetStaticProps, InferGetStaticPropsType } from 'next';
import { PublicSeoPage } from '../../../components/public-site/PublicSeoPage';
import { ReleaseAction } from '../../../components/public-site/PublicSiteShell';
import {
  PUBLIC_SEO_POINT_HOUSE_PLACEMENTS,
  findPublicSeoPointHousePlacement,
  relatedPointHousePlacements,
  type PublicSeoPointHousePlacement,
} from '../../../lib/publicSeoExpansion';

type Props = { placement: PublicSeoPointHousePlacement };
type Params = { placement: string };

export const getStaticPaths: GetStaticPaths<Params> = async () => ({ paths: PUBLIC_SEO_POINT_HOUSE_PLACEMENTS.map((item) => ({ params: { placement: item.slug } })), fallback: false });
export const getStaticProps: GetStaticProps<Props, Params> = async ({ params }) => {
  const placement = findPublicSeoPointHousePlacement(params?.placement || '');
  return placement ? { props: { placement } } : { notFound: true };
};

export default function PointInHousePage({ placement }: InferGetStaticPropsType<typeof getStaticProps>) {
  const { point, house, path } = placement;
  const houseLabel = `${house.house} доме`;
  const title = `${point.name} в ${houseLabel} натальной карты: значение`;
  const answer = `${point.name} связывают с тем, ${point.question}. ${house.house} дом показывает, в какой части жизни эта функция становится заметнее: ${house.summary.toLowerCase()}`;
  return (
    <PublicSeoPage
      path={path}
      title={title}
      description={`${point.name} в ${houseLabel}: что показывает такое положение, за что отвечает дом и что ещё смотреть в натальной карте.`}
      eyebrow="Натальная карта · точка в доме"
      heading={`${point.name} в ${houseLabel}`}
      lead={<p>{answer}</p>}
      breadcrumbs={[{ name: 'Натальная карта', path: '/natalnaya-karta' }, { name: 'Точки в домах', path: '/natalnaya-karta/tochki-v-domah' }, { name: `${point.name} в ${houseLabel}`, path }]}
      faq={[
        { question: `Что означает ${point.name} в ${houseLabel}?`, answer },
        { question: 'Нужно ли точное время рождения?', answer: 'Да. Дома сильно зависят от времени и места рождения, поэтому без точного времени положение по домам может быть неверным.' },
        { question: 'Можно ли делать вывод только по этому положению?', answer: 'Нет. Знак точки, её аспекты и остальная карта уточняют значение.' },
      ]}
      relatedLinks={relatedPointHousePlacements(placement).map((item) => ({ href: item.path, label: `${item.point.name} в ${item.house.house} доме` }))}
    >
      <section><h2>Что показывает {point.name}</h2><p>{point.meaning}.</p></section>
      <section><h2>За что отвечает {house.house} дом</h2><p>{house.summary}</p><p>{house.shortAnswer}</p></section>
      <section><h2>Как читать вместе</h2><p>{answer}. Затем проверь знак {point.genitive.toLowerCase()} и аспекты к этой точке.</p></section>
      <section><h2>Проверить в своей карте</h2><ReleaseAction /></section>
    </PublicSeoPage>
  );
}
