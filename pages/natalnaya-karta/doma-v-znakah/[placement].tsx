import type { GetStaticPaths, GetStaticProps, InferGetStaticPropsType } from 'next';
import Link from 'next/link';
import { PublicSeoPage } from '../../../components/public-site/PublicSeoPage';
import { ReleaseAction } from '../../../components/public-site/PublicSiteShell';
import {
  PUBLIC_SEO_HOUSE_SIGN_PLACEMENTS,
  findPublicSeoHouseSignPlacement,
  relatedHouseSignPlacements,
  type PublicSeoHouseSignPlacement,
} from '../../../lib/publicSeoExpansion';

type Props = { placement: PublicSeoHouseSignPlacement };
type Params = { placement: string };

export const getStaticPaths: GetStaticPaths<Params> = async () => ({ paths: PUBLIC_SEO_HOUSE_SIGN_PLACEMENTS.map((item) => ({ params: { placement: item.slug } })), fallback: false });
export const getStaticProps: GetStaticProps<Props, Params> = async ({ params }) => {
  const placement = findPublicSeoHouseSignPlacement(params?.placement || '');
  return placement ? { props: { placement } } : { notFound: true };
};

export default function HouseInSignPage({ placement }: InferGetStaticPropsType<typeof getStaticProps>) {
  const { house, sign, path } = placement;
  const heading = `${house.house} дом в ${sign.prepositional}`;
  const title = `${heading} в натальной карте: значение`;
  const answer = `${house.house} дом связан с темой: ${house.summary.toLowerCase()} Знак ${sign.name} показывает привычный способ действовать в этой части карты.`;
  return (
    <PublicSeoPage
      path={path}
      title={title}
      description={`${heading}: что означает знак на доме, за что отвечает ${house.house} дом и как читать сочетание в натальной карте.`}
      eyebrow="Натальная карта · дом в знаке"
      heading={heading}
      lead={<p>{answer}</p>}
      breadcrumbs={[{ name: 'Натальная карта', path: '/natalnaya-karta' }, { name: 'Дома в знаках', path: '/natalnaya-karta/doma-v-znakah' }, { name: heading, path }]}
      faq={[
        { question: `Что означает ${heading}?`, answer },
        { question: 'Нужно ли точное время рождения?', answer: 'Да. Положение домов и их границ зависит от времени и места рождения.' },
        { question: 'Почему в одном доме может быть несколько знаков?', answer: 'Дом занимает участок круга и может захватывать больше одного знака. Для названия обычно используют знак на начале дома, а полную картину смотрят по всей сетке.' },
      ]}
      relatedLinks={relatedHouseSignPlacements(placement).map((item) => ({ href: item.path, label: `${item.house.house} дом в ${item.sign.prepositional}` }))}
    >
      <section><h2>За что отвечает {house.house} дом</h2><p>{house.summary}</p><p>{house.shortAnswer}</p><p><Link href={`/natalnaya-karta/doma/${house.slug}`}>Подробнее про {house.house} дом</Link></p></section>
      <section><h2>Что добавляет {sign.name}</h2><p>{sign.summary}</p><p>{sign.shortAnswer}</p><p><Link href={`/goroskop/${sign.slug}`}>Подробнее про знак {sign.name}</Link></p></section>
      <section><h2>Что получается вместе</h2><p>{answer} Дальше нужно проверить управителя дома, планеты внутри него и аспекты — они уточняют итог.</p></section>
      <section><h2>Проверить в своей карте</h2><ReleaseAction /></section>
    </PublicSeoPage>
  );
}
