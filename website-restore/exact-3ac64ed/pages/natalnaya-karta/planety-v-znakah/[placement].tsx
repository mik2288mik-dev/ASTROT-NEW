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
  const description = `${planet.name} в ${sign.prepositional}: что обычно означает такое положение в натальной карте и как проверить его у себя.`;
  const shortAnswer = `${planet.name} связывают с тем, ${planet.question}, а знак ${sign.name} добавляет к этому свои привычные черты. Это только одна часть карты — дом, другие планеты и связи между ними тоже важны.`;

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
        { question: `Как узнать, где у меня ${planet.name}?`, answer: 'Построй натальную карту по дате рождения. Для домов дополнительно нужны время и место рождения.' },
        { question: 'Можно ли судить о человеке по одному положению?', answer: 'Нет. Это только одна часть натальной карты, поэтому её лучше смотреть вместе с остальными.' },
      ]}
      relatedLinks={related.map((item) => ({ href: item.path, label: `${item.planet.name} в ${item.sign.prepositional}` }))}
    >
      <section>
        <h2>За что отвечает {planet.name}</h2>
        <p>{planet.name} обычно связывают с тем, {planet.question}.</p>
      </section>

      <section>
        <h2>Что добавляет {sign.name}</h2>
        <p>{sign.summary}</p>
        <p>{sign.shortAnswer}</p>
        <p><Link href={`/goroskop/${sign.slug}`}>Подробнее про знак {sign.name}</Link></p>
      </section>

      <section>
        <h2>Что получается вместе</h2>
        <p>{shortAnswer}</p>
        <p>Если такое положение есть в твоей карте, дальше полезно посмотреть дом {planet.genitive.toLowerCase()} и его связи с другими планетами. Поэтому у двух людей с одинаковым положением итоговая картина всё равно может быть разной.</p>
      </section>

      <section>
        <h2>Проверить у себя</h2>
        <p>Положение планет можно определить по дате рождения. Для полной карты лучше также указать точное время и место.</p>
        <p><Link href="/natalnaya-karta">Открыть натальную карту</Link></p>
        <ReleaseAction />
      </section>
    </PublicSeoPage>
  );
}
