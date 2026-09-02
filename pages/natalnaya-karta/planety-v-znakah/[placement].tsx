import type { GetStaticPaths, GetStaticProps, InferGetStaticPropsType } from 'next';
import Link from 'next/link';
import { PublicSeoPage } from '../../../components/public-site/PublicSeoPage';
import { ReleaseAction } from '../../../components/public-site/PublicSiteShell';
import {
  PUBLIC_SEO_PLANET_SIGN_PLACEMENTS,
  findPlanetSignPlacement,
  relatedPlanetSignPlacements,
  type PublicSeoPlanetSignPlacement,
} from '../../../lib/publicSeoPlacements';

type Props = { placement: PublicSeoPlanetSignPlacement };
type Params = { placement: string };

export const getStaticPaths: GetStaticPaths<Params> = async () => ({
  paths: PUBLIC_SEO_PLANET_SIGN_PLACEMENTS.map((item) => ({ params: { placement: item.slug } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps<Props, Params> = async ({ params }) => {
  const placement = findPlanetSignPlacement(params?.placement || '');
  if (!placement) return { notFound: true };
  return { props: { placement } };
};

export default function PlanetInSignPage({ placement }: InferGetStaticPropsType<typeof getStaticProps>) {
  const { planet, sign, path } = placement;
  const related = relatedPlanetSignPlacements(placement);
  const title = `${planet.name} в ${sign.prepositional} в натальной карте: значение`;
  const description = `${planet.name} в ${sign.prepositional}: что означает это положение в натальной карте, как соединяются темы ${planet.genitive.toLowerCase()} и знака ${sign.name}, и как проверить своё положение.`;
  const shortAnswer = `${planet.name} связывают с темой «${planet.meaning}», а знак ${sign.name} описывает способ её выражения. Поэтому это положение читают как сочетание значения ${planet.genitive.toLowerCase()} с характерными чертами знака ${sign.name}; окончательный вывод зависит и от дома, аспектов и остальных частей карты.`;

  return (
    <PublicSeoPage
      path={path}
      title={title}
      description={description}
      eyebrow="Натальная карта · планета в знаке"
      heading={`${planet.name} в ${sign.prepositional}`}
      lead={<p>{shortAnswer}</p>}
      breadcrumbs={[
        { name: 'Натальная карта', path: '/natalnaya-karta' },
        { name: 'Планеты в знаках', path: '/natalnaya-karta/planety-v-znakah' },
        { name: `${planet.name} в ${sign.prepositional}`, path },
      ]}
      faq={[
        { question: `Что означает ${planet.name} в ${sign.prepositional}?`, answer: shortAnswer },
        { question: `Как узнать, находится ли ${planet.name} в ${sign.prepositional} у меня?`, answer: 'Нужно рассчитать натальную карту по дате рождения. Для домов также важны точное время и место рождения.' },
        { question: 'Можно ли делать вывод по одному положению?', answer: 'Нет. Одно положение показывает только одну часть карты. Его обычно читают вместе с домом планеты, аспектами и другими рассчитанными точками.' },
      ]}
      relatedLinks={related.map((item) => ({ href: item.path, label: `${item.planet.name} в ${item.sign.prepositional}` }))}
    >
      <section>
        <h2>Что показывает {planet.name}</h2>
        <p>В астрологической интерпретации {planet.name} связывают с тем, {planet.question}. Это символический язык чтения карты, а не утверждение о физическом влиянии планеты на характер.</p>
      </section>

      <section>
        <h2>Что добавляет знак {sign.name}</h2>
        <p>{sign.summary}</p>
        <p>{sign.shortAnswer}</p>
        <p><Link href={`/goroskop/${sign.slug}`}>Подробнее о знаке {sign.name}</Link></p>
      </section>

      <section>
        <h2>Как читать сочетание</h2>
        <p>{shortAnswer}</p>
        <p>Если это положение действительно есть в вашей карте, дальше имеет смысл посмотреть, в каком доме находится {planet.name} и какие аспекты оно образует. Именно контекст отличает две карты с одинаковым знаком одной планеты.</p>
      </section>

      <section>
        <h2>Проверить свою карту</h2>
        <p>Положение планет рассчитывается по дате рождения. Полная натальная карта также учитывает время и место рождения, чтобы определить дома и углы карты.</p>
        <p><Link href="/natalnaya-karta">Рассчитать натальную карту</Link></p>
        <ReleaseAction />
      </section>
    </PublicSeoPage>
  );
}
