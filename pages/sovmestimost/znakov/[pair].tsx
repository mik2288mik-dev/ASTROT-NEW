import type { GetStaticPaths, GetStaticProps, InferGetStaticPropsType } from 'next';
import Link from 'next/link';
import { PublicSeoPage } from '../../../components/public-site/PublicSeoPage';
import { ReleaseAction } from '../../../components/public-site/PublicSiteShell';
import {
  PUBLIC_SEO_PAIRS,
  buildPublicSeoPairContent,
  pairNames,
  pairNamesGenitive,
  parsePublicSeoPairSlug,
  relatedPairsForSign,
  type PublicSeoPair,
  type PublicSeoPairContent,
} from '../../../lib/publicSeoContent';

type PairPageProps = { pair: PublicSeoPair; content: PublicSeoPairContent };
type PairPageParams = { pair: string };

export const getStaticPaths: GetStaticPaths<PairPageParams> = async () => ({
  paths: PUBLIC_SEO_PAIRS.map((pair) => ({ params: { pair: pair.slug } })),
  fallback: 'blocking',
});

export const getStaticProps: GetStaticProps<PairPageProps, PairPageParams> = async ({ params }) => {
  const parsed = parsePublicSeoPairSlug(params?.pair || '');
  if (!parsed) return { notFound: true };
  if (!parsed.isCanonical) {
    return { redirect: { destination: parsed.canonicalPair.path, permanent: true } };
  }
  return {
    props: {
      pair: parsed.canonicalPair,
      content: buildPublicSeoPairContent(parsed.canonicalPair),
    },
  };
};

export default function SignCompatibilityPairPage({ pair, content }: InferGetStaticPropsType<typeof getStaticProps>) {
  const names = pairNames(pair);
  const relatedPairs = [
    ...relatedPairsForSign(pair.first, pair.slug),
    ...relatedPairsForSign(pair.second, pair.slug),
  ].filter((candidate, index, all) => all.findIndex((item) => item.slug === candidate.slug) === index).slice(0, 8);
  const signLinks = pair.first.key === pair.second.key
    ? [{ href: `/goroskop/${pair.first.slug}`, label: `Гороскоп для ${pair.first.genitive}` }]
    : [
        { href: `/goroskop/${pair.first.slug}`, label: `Гороскоп для ${pair.first.genitive}` },
        { href: `/goroskop/${pair.second.slug}`, label: `Гороскоп для ${pair.second.genitive}` },
      ];
  const faq = [
    {
      question: `Совместимы ли ${names}?`,
      answer: 'По двум знакам можно увидеть общие совпадения и различия, но реальные отношения зависят от самих людей и их поступков.',
    },
    {
      question: 'Как получить более личное сравнение?',
      answer: 'Добавить дату, время и место рождения двух людей и открыть совместимость по двум натальным картам.',
    },
  ];

  return (
    <PublicSeoPage
      path={pair.path}
      title={`${names}: совместимость знаков зодиака`}
      description={`Совместимость ${pairNamesGenitive(pair)}: что сближает два знака, где чаще возникают разногласия и как им проще понимать друг друга.`}
      eyebrow="Совместимость знаков"
      heading={`${names}: совместимость`}
      lead={<p>Что между этими знаками обычно складывается легко, где начинаются разногласия и в чём они могут понимать друг друга по-разному.</p>}
      breadcrumbs={[
        { name: 'Совместимость', path: '/sovmestimost' },
        { name: 'Совместимость знаков', path: '/sovmestimost/znakov' },
        { name: names, path: pair.path },
      ]}
      faq={faq}
      relatedLinks={[
        { href: '/sovmestimost', label: 'Совместимость по дате рождения' },
        ...signLinks,
      ]}
    >
      <section><h2>Что вас сближает</h2><p>{content.compatibility.attraction}</p></section>
      <section><h2>Где может быть сложно</h2><p>{content.compatibility.difficulty}</p></section>
      <section><h2>Как проще договориться</h2><p>{content.compatibility.communication}</p></section>

      <section>
        <h2>Каждый знак отдельно</h2>
        <h3>{content.firstSnapshot.headline}</h3>
        <p>{content.firstSnapshot.body}</p>
        {content.secondSnapshot ? (
          <><h3>{content.secondSnapshot.headline}</h3><p>{content.secondSnapshot.body}</p></>
        ) : (
          <p>Один знак не делает двух людей одинаковыми. В полной натальной карте у каждого остаётся много других отличий.</p>
        )}
      </section>

      <section>
        <h2>Не делай вывод по одному знаку</h2>
        <p>{content.compatibility.limitation}</p>
        <p>То, как человек реально разговаривает и поступает, всегда важнее общего описания его знака.</p>
      </section>

      <section>
        <h2>Другие сочетания</h2>
        <ul>
          {relatedPairs.map((relatedPair) => <li key={relatedPair.slug}><Link href={relatedPair.path}>{pairNames(relatedPair)}</Link></li>)}
        </ul>
        <p><Link href="/sovmestimost/znakov">Посмотреть все знаки</Link></p>
      </section>

      <section>
        <h2>Сравнить вас по данным рождения</h2>
        <p>Добавь две натальные карты — NEBO покажет больше деталей, чем сравнение только по знакам.</p>
        <ReleaseAction />
      </section>
    </PublicSeoPage>
  );
}
