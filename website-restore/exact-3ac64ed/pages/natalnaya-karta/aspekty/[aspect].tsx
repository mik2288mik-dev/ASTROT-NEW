import type { GetStaticPaths, GetStaticProps, InferGetStaticPropsType } from 'next';
import Link from 'next/link';
import { PublicSeoPage } from '../../../components/public-site/PublicSeoPage';
import { ReleaseAction } from '../../../components/public-site/PublicSiteShell';
import {
  PUBLIC_SEO_ASPECT_PLACEMENTS,
  findPublicSeoAspectPlacement,
  relatedPublicSeoAspects,
  type PublicSeoAspectPlacement,
} from '../../../lib/publicSeoExpansion';

type Props = { placement: PublicSeoAspectPlacement };
type Params = { aspect: string };

export const getStaticPaths: GetStaticPaths<Params> = async () => ({
  paths: PUBLIC_SEO_ASPECT_PLACEMENTS.map((item) => ({ params: { aspect: item.slug } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps<Props, Params> = async ({ params }) => {
  const placement = findPublicSeoAspectPlacement(params?.aspect || '');
  if (!placement) return { notFound: true };
  return { props: { placement } };
};

export default function AspectPage({ placement }: InferGetStaticPropsType<typeof getStaticProps>) {
  const { first, second, aspect, path } = placement;
  const heading = `${first.name} — ${aspect.name} — ${second.name}`;
  const title = `${first.name} ${aspect.name} ${second.name} в натальной карте: значение`;
  const description = `${first.name} ${aspect.name} ${second.name}: как читать связь двух объектов в натальной карте, что она показывает и почему её нельзя оценивать отдельно.`;
  const answer = `${first.name} отвечает за ${first.meaning}, а ${second.name} — за ${second.meaning}. ${aspect.name[0].toUpperCase()}${aspect.name.slice(1)} ${aspect.action}.`;
  const related = relatedPublicSeoAspects(placement);

  return (
    <PublicSeoPage
      path={path}
      title={title}
      description={description}
      eyebrow="Натальная карта · аспект"
      heading={heading}
      lead={<p>{answer}</p>}
      breadcrumbs={[
        { name: 'Натальная карта', path: '/natalnaya-karta' },
        { name: 'Аспекты', path: '/natalnaya-karta/aspekty' },
        { name: heading, path },
      ]}
      faq={[
        { question: `Что означает ${first.name} ${aspect.name} ${second.name}?`, answer },
        { question: `Этот аспект считается хорошим или плохим?`, answer: 'Сам по себе — ни тем, ни другим. Важнее понять, насколько легко две функции согласуются и как человек использует эту связку в реальных решениях.' },
        { question: 'Нужен ли точный час рождения?', answer: 'Для аспектов между планетами дата обычно важнее времени, но для Луны, углов карты и точной полной карты время рождения желательно знать.' },
      ]}
      relatedLinks={related.map((item) => ({ href: item.path, label: `${item.first.name} — ${item.aspect.name} — ${item.second.name}` }))}
    >
      <section>
        <h2>Что здесь связывается</h2>
        <p><strong>{first.name}</strong>: {first.meaning}. На практике это вопрос о том, {first.question}.</p>
        <p><strong>{second.name}</strong>: {second.meaning}. Здесь смотрят, {second.question}.</p>
      </section>
      <section>
        <h2>Как работает {aspect.name}</h2>
        <p>{aspect.action}.</p>
        <p>{aspect.reading}</p>
      </section>
      <section>
        <h2>Что смотреть рядом</h2>
        <p>Проверь знаки и дома обоих объектов, а затем остальные аспекты к ним. Один и тот же аспект у двух людей может ощущаться по-разному из-за остальной карты.</p>
        <p><Link href="/natalnaya-karta/aspekty">Все аспекты</Link></p>
      </section>
      <section>
        <h2>Проверить в своей карте</h2>
        <p>Построй карту по своим данным и сравни точный список аспектов с каталогом.</p>
        <ReleaseAction />
      </section>
    </PublicSeoPage>
  );
}
