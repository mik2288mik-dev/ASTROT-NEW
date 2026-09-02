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
  const description = `${planet.name} в ${house.name}: что означает положение в натальной карте, какие вопросы связывают с ${house.number}-м домом и как проверить свою карту.`;
  const shortAnswer = `${planet.name} связывают с темой «${planet.meaning}», а ${house.number}-й дом — с темами «${house.meaning}». Такое положение читают как пересечение этих двух частей карты; знак планеты и аспекты дополнительно меняют контекст.`;

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
        { question: `Как узнать дом ${planet.genitive.toLowerCase()}?`, answer: 'Нужно рассчитать натальную карту по дате, точному времени и месту рождения. Без времени рождения дома обычно нельзя определить надёжно.' },
        { question: 'Дом и знак планеты — это одно и то же?', answer: 'Нет. Знак описывает способ выражения темы планеты, а дом — область жизненных вопросов. В полной карте учитывают оба параметра вместе.' },
      ]}
      relatedLinks={related.map((item) => ({ href: item.path, label: `${item.planet.name} в ${item.house.name}` }))}
    >
      <section>
        <h2>Что показывает {planet.name}</h2>
        <p>В астрологической интерпретации {planet.name} связывают с тем, {planet.question}. Это символический способ читать карту, а не утверждение о физическом влиянии небесного тела на человека.</p>
      </section>

      <section>
        <h2>Что показывает {house.number}-й дом</h2>
        <p>{house.number}-й дом связывают с такими вопросами, как {house.meaning}. Дом определяется не только датой, но и временем и местом рождения.</p>
      </section>

      <section>
        <h2>Как читать сочетание</h2>
        <p>{shortAnswer}</p>
        <p>Для полного чтения дополнительно смотрят знак, в котором находится {planet.name}, аспекты с другими планетами и положение управителя дома. Поэтому одинаковый дом одной планеты не делает две карты одинаковыми.</p>
      </section>

      <section>
        <h2>Проверить свою карту</h2>
        <p>Чтобы узнать дом {planet.genitive.toLowerCase()}, нужны дата, время и место рождения. Если время неизвестно, лучше не выдавать дом как точный результат.</p>
        <p><Link href="/natalnaya-karta">Рассчитать натальную карту</Link></p>
        <ReleaseAction />
      </section>
    </PublicSeoPage>
  );
}
