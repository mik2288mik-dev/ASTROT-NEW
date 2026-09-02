import type { GetStaticPaths, GetStaticProps, InferGetStaticPropsType } from 'next';
import Link from 'next/link';
import { PublicSeoPage } from '../../../components/public-site/PublicSeoPage';
import { ReleaseAction } from '../../../components/public-site/PublicSiteShell';
import {
  PUBLIC_SEO_PLANET_HOUSE_PLACEMENTS,
  findPlanetHousePlacement,
  relatedPlanetHousePlacements,
  type PublicSeoPlanetHousePlacement,
} from '../../../lib/publicSeoPlacements';

type Props = { placement: PublicSeoPlanetHousePlacement };
type Params = { placement: string };

export const getStaticPaths: GetStaticPaths<Params> = async () => ({
  paths: PUBLIC_SEO_PLANET_HOUSE_PLACEMENTS.map((item) => ({ params: { placement: item.slug } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps<Props, Params> = async ({ params }) => {
  const placement = findPlanetHousePlacement(params?.placement || '');
  if (!placement) return { notFound: true };
  return { props: { placement } };
};

export default function PlanetInHousePage({ placement }: InferGetStaticPropsType<typeof getStaticProps>) {
  const { planet, house, path } = placement;
  const related = relatedPlanetHousePlacements(placement);
  const title = `${planet.name} в ${house.name} натальной карты: значение`;
  const description = `${planet.name} в ${house.name}: что обычно означает такое положение и как узнать свой дом в натальной карте.`;
  const shortAnswer = `${planet.name} связывают с тем, ${planet.question}. ${house.number}-й дом показывает, где эта часть карты чаще становится заметной: ${house.meaning}.`;

  return (
    <PublicSeoPage
      path={path}
      title={title}
      description={description}
      eyebrow="Натальная карта · планета в доме"
      heading={`${planet.name} в ${house.name}`}
      lead={<p>{shortAnswer}</p>}
      breadcrumbs={[
        { name: 'Натальная карта', path: '/natalnaya-karta' },
        { name: 'Планеты в домах', path: '/natalnaya-karta/planety-v-domah' },
        { name: `${planet.name} в ${house.name}`, path },
      ]}
      faq={[
        { question: `Что означает ${planet.name} в ${house.name}?`, answer: shortAnswer },
        { question: `Как узнать дом ${planet.genitive.toLowerCase()}?`, answer: 'Нужны дата, точное время и место рождения. Без времени дома карты нельзя определить надёжно.' },
        { question: 'Дом и знак планеты — это одно и то же?', answer: 'Нет. Знак и дом показывают разные части карты, поэтому их смотрят вместе.' },
      ]}
      relatedLinks={related.map((item) => ({ href: item.path, label: `${item.planet.name} в ${item.house.name}` }))}
    >
      <section>
        <h2>За что отвечает {planet.name}</h2>
        <p>{planet.name} обычно связывают с тем, {planet.question}.</p>
      </section>

      <section>
        <h2>Что показывает {house.number}-й дом</h2>
        <p>{house.number}-й дом связывают с такими вопросами: {house.meaning}. Чтобы определить дома карты, нужны время и место рождения.</p>
      </section>

      <section>
        <h2>Что получается вместе</h2>
        <p>{shortAnswer}</p>
        <p>Чтобы увидеть картину точнее, посмотри ещё знак {planet.genitive.toLowerCase()} и его связи с другими планетами. Одно одинаковое положение не делает двух людей одинаковыми.</p>
      </section>

      <section>
        <h2>Проверить у себя</h2>
        <p>Чтобы узнать дом {planet.genitive.toLowerCase()}, укажи дату, точное время и место рождения.</p>
        <p><Link href="/natalnaya-karta">Открыть натальную карту</Link></p>
        <ReleaseAction />
      </section>
    </PublicSeoPage>
  );
}
