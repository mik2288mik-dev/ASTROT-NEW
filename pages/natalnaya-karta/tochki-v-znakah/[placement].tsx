import type { GetStaticPaths, GetStaticProps, InferGetStaticPropsType } from 'next';
import Link from 'next/link';
import { PublicSeoPage } from '../../../components/public-site/PublicSeoPage';
import { ReleaseAction } from '../../../components/public-site/PublicSiteShell';
import {
  PUBLIC_SEO_POINT_SIGN_PLACEMENTS,
  findPublicSeoPointSignPlacement,
  relatedPointSignPlacements,
  type PublicSeoPointSignPlacement,
} from '../../../lib/publicSeoExpansion';

type Props = { placement: PublicSeoPointSignPlacement };
type Params = { placement: string };

export const getStaticPaths: GetStaticPaths<Params> = async () => ({ paths: PUBLIC_SEO_POINT_SIGN_PLACEMENTS.map((item) => ({ params: { placement: item.slug } })), fallback: false });
export const getStaticProps: GetStaticProps<Props, Params> = async ({ params }) => {
  const placement = findPublicSeoPointSignPlacement(params?.placement || '');
  return placement ? { props: { placement } } : { notFound: true };
};

export default function PointInSignPage({ placement }: InferGetStaticPropsType<typeof getStaticProps>) {
  const { point, sign, path } = placement;
  const title = `${point.name} в ${sign.prepositional} в натальной карте: значение`;
  const answer = `${point.name} связывают с тем, ${point.question}. В ${sign.prepositional} эта функция выражается через привычные качества знака ${sign.name}.`;
  return (
    <PublicSeoPage
      path={path}
      title={title}
      description={`${point.name} в ${sign.prepositional}: базовое значение положения, роль знака и что ещё проверить в натальной карте.`}
      eyebrow="Натальная карта · точка в знаке"
      heading={`${point.name} в ${sign.prepositional}`}
      lead={<p>{answer}</p>}
      breadcrumbs={[{ name: 'Натальная карта', path: '/natalnaya-karta' }, { name: 'Точки в знаках', path: '/natalnaya-karta/tochki-v-znakah' }, { name: `${point.name} в ${sign.prepositional}`, path }]}
      faq={[
        { question: `Что означает ${point.name} в ${sign.prepositional}?`, answer },
        { question: `Это важнее Солнца или Луны?`, answer: 'Нет. Это отдельный слой карты. Основные планеты, дома, аспекты и углы карты нужно читать вместе.' },
        { question: 'Как узнать это положение у себя?', answer: 'Построй натальную карту по дате рождения; для полной карты лучше указать также точное время и место.' },
      ]}
      relatedLinks={relatedPointSignPlacements(placement).map((item) => ({ href: item.path, label: `${item.point.name} в ${item.sign.prepositional}` }))}
    >
      <section><h2>Что показывает {point.name}</h2><p>{point.meaning}.</p></section>
      <section><h2>Что добавляет знак {sign.name}</h2><p>{sign.summary}</p><p>{sign.shortAnswer}</p><p><Link href={`/goroskop/${sign.slug}`}>Подробнее про знак {sign.name}</Link></p></section>
      <section><h2>Как читать вместе</h2><p>{answer} Затем проверь дом {point.genitive.toLowerCase()} и аспекты к этой точке: именно они уточняют, где и с чем эта функция связана сильнее всего.</p></section>
      <section><h2>Проверить в своей карте</h2><ReleaseAction /></section>
    </PublicSeoPage>
  );
}
