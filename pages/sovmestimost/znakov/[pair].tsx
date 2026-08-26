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

type PairPageProps = {
  pair: PublicSeoPair;
  content: PublicSeoPairContent;
};

type PairPageParams = {
  pair: string;
};

export const getStaticPaths: GetStaticPaths<PairPageParams> = async () => ({
  paths: PUBLIC_SEO_PAIRS.map((pair) => ({ params: { pair: pair.slug } })),
  fallback: 'blocking',
});

export const getStaticProps: GetStaticProps<PairPageProps, PairPageParams> = async ({ params }) => {
  const parsed = parsePublicSeoPairSlug(params?.pair || '');
  if (!parsed) return { notFound: true };

  if (!parsed.isCanonical) {
    return {
      redirect: {
        destination: parsed.canonicalPair.path,
        permanent: true,
      },
    };
  }

  return {
    props: {
      pair: parsed.canonicalPair,
      content: buildPublicSeoPairContent(parsed.canonicalPair),
    },
  };
};

export default function SignCompatibilityPairPage({
  pair,
  content,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const names = pairNames(pair);
  const relatedPairs = [
    ...relatedPairsForSign(pair.first, pair.slug),
    ...relatedPairsForSign(pair.second, pair.slug),
  ].filter((candidate, index, all) => (
    all.findIndex((item) => item.slug === candidate.slug) === index
  )).slice(0, 8);
  const signLinks = pair.first.key === pair.second.key
    ? [{ href: `/goroskop/${pair.first.slug}`, label: `Гороскоп для ${pair.first.genitive}` }]
    : [
        { href: `/goroskop/${pair.first.slug}`, label: `Гороскоп для ${pair.first.genitive}` },
        { href: `/goroskop/${pair.second.slug}`, label: `Гороскоп для ${pair.second.genitive}` },
      ];
  const faq = [
    {
      question: `Совместимы ли ${names}?`,
      answer: 'Общий разбор показывает точки контакта и разницу темпа. Для конкретных отношений нужны данные двух натальных карт и сами поступки людей.',
    },
    {
      question: `Меняется ли смысл, если поставить ${pair.second.name} первым?`,
      answer: 'Смысл не меняется. Оба варианта — одна пара, поэтому страница у неё тоже одна.',
    },
    {
      question: 'Как получить более полный разбор?',
      answer: 'Сохранить две натальные карты по дате, времени и месту рождения и открыть совместимость по рассчитанным картам в NEBO Premium.',
    },
  ];

  return (
    <PublicSeoPage
      path={pair.path}
      title={`${names}: совместимость знаков зодиака`}
      description={`Совместимость ${pairNamesGenitive(pair)}: что сближает два знака, где расходится темп и как говорить яснее. Общий бесплатный разбор NEBO.`}
      eyebrow="Совместимость солнечных знаков"
      heading={`${names}: совместимость знаков зодиака`}
      lead={<p>Общий разбор двух солнечных знаков: что может притягивать, где начинаются разногласия и как говорить яснее.</p>}
      breadcrumbs={[
        { name: 'Совместимость', path: '/sovmestimost' },
        { name: 'Совместимость знаков', path: '/sovmestimost/znakov' },
        { name: names, path: pair.path },
      ]}
      faq={faq}
      relatedLinks={[
        { href: '/sovmestimost', label: 'Полная совместимость по двум картам' },
        ...signLinks,
      ]}
    >
      <section>
        <h2>Что вас сближает</h2>
        <p>{content.compatibility.attraction}</p>
      </section>

      <section>
        <h2>Где расходится темп</h2>
        <p>{content.compatibility.difficulty}</p>
      </section>

      <section>
        <h2>Как говорить яснее</h2>
        <p>{content.compatibility.communication}</p>
      </section>

      <section>
        <h2>Каждый знак отдельно</h2>
        <h3>{content.firstSnapshot.headline}</h3>
        <p>{content.firstSnapshot.body}</p>
        {content.secondSnapshot ? (
          <>
            <h3>{content.secondSnapshot.headline}</h3>
            <p>{content.secondSnapshot.body}</p>
          </>
        ) : (
          <p>Одинаковый солнечный знак усиливает узнавание, но не делает двух людей копиями. Остальные положения карт всё равно различаются.</p>
        )}
      </section>

      <section>
        <h2>Что важно учесть</h2>
        <p>{content.compatibility.limitation}</p>
        <p>Повторяющиеся поступки и прямой разговор дают больше фактов, чем попытка угадать человека по одному знаку.</p>
      </section>

      <section>
        <h2>Ещё пары с этими знаками</h2>
        <ul>
          {relatedPairs.map((relatedPair) => (
            <li key={relatedPair.slug}>
              <Link href={relatedPair.path}>{pairNames(relatedPair)}</Link>
            </li>
          ))}
        </ul>
        <p><Link href="/sovmestimost/znakov">Открыть каталог всех 78 пар</Link></p>
      </section>

      <section>
        <h2>Полный разбор по двум картам</h2>
        <p>Полная совместимость использует рассчитанные натальные карты обоих людей. Этот формат доступен в NEBO Premium.</p>
        <ReleaseAction />
      </section>
    </PublicSeoPage>
  );
}
