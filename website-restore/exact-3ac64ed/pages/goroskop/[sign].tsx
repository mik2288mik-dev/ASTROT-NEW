import type { GetStaticPaths, GetStaticProps, InferGetStaticPropsType } from 'next';
import Link from 'next/link';
import { PublicSeoPage } from '../../components/public-site/PublicSeoPage';
import { ReleaseAction } from '../../components/public-site/PublicSiteShell';
import {
  PUBLIC_SEO_SIGNS,
  findPublicSeoSignBySlug,
  relatedPairsForSign,
  type PublicSeoSign,
} from '../../lib/publicSeoContent';

type SignPageProps = { sign: PublicSeoSign };
type SignPageParams = { sign: string };

export const getStaticPaths: GetStaticPaths<SignPageParams> = async () => ({
  paths: PUBLIC_SEO_SIGNS.map((sign) => ({ params: { sign: sign.slug } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps<SignPageProps, SignPageParams> = async ({ params }) => {
  const sign = findPublicSeoSignBySlug(params?.sign || '');
  if (!sign) return { notFound: true };
  return { props: { sign } };
};

export default function SignHoroscopePage({ sign }: InferGetStaticPropsType<typeof getStaticProps>) {
  const path = `/goroskop/${sign.slug}`;
  const relatedPairs = relatedPairsForSign(sign).slice(0, 6);
  const faq = [
    {
      question: `Здесь есть гороскоп для ${sign.genitive} на сегодня?`,
      answer: `Здесь можно узнать главное про знак ${sign.name}. Ежедневный гороскоп для ${sign.genitive} доступен в NEBO.`,
    },
    {
      question: `Что значит знак ${sign.name} в натальной карте?`,
      answer: sign.shortAnswer,
    },
    {
      question: 'Нужно ли точное время рождения?',
      answer: 'Для общего гороскопа по знаку точное время не нужно. Для полной натальной карты лучше знать время и место рождения.',
    },
  ];

  return (
    <PublicSeoPage
      path={path}
      title={`Гороскоп для ${sign.genitive} на сегодня`}
      description={`Гороскоп для ${sign.genitive} на сегодня в NEBO. Кратко о знаке ${sign.name}, его сильных сторонах, общении и личном прогнозе.`}
      eyebrow={`Гороскоп на сегодня · ${sign.name}`}
      heading={`Гороскоп для ${sign.genitive} на сегодня`}
      lead={<p>{sign.summary}</p>}
      breadcrumbs={[
        { name: 'Гороскоп по знакам', path: '/goroskop' },
        { name: sign.name, path },
      ]}
      faq={faq}
      relatedLinks={[
        { href: '/lichnyy-goroskop', label: 'Личный гороскоп' },
        { href: '/natalnaya-karta', label: 'Натальная карта' },
        { href: '/sovmestimost/znakov', label: 'Совместимость знаков' },
      ]}
    >
      <section>
        <h2>Коротко</h2>
        <p>{sign.shortAnswer}</p>
      </section>

      {sign.sections.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </section>
      ))}

      <section>
        <h2>Общий и личный гороскоп</h2>
        <p>Ежедневный гороскоп для {sign.genitive} опирается на солнечный знак, поэтому остаётся общим для многих людей.</p>
        <p><Link href="/natalnaya-karta">Натальная карта</Link> показывает намного больше деталей. <Link href="/lichnyy-goroskop">Личный прогноз</Link> учитывает дату, время и место рождения.</p>
      </section>

      <section>
        <h2>{sign.name} и другие знаки</h2>
        <p>Посмотри несколько сочетаний со знаком {sign.name}:</p>
        <ul>
          {relatedPairs.map((pair) => (
            <li key={pair.slug}><Link href={pair.path}>{pair.first.name} и {pair.second.name}</Link></li>
          ))}
        </ul>
        <p><Link href="/sovmestimost/znakov">Посмотреть совместимость знаков</Link></p>
      </section>

      <section>
        <h2>Гороскоп на сегодня</h2>
        <p>Общий ежедневный гороскоп доступен бесплатно в NEBO.</p>
        <ReleaseAction />
      </section>
    </PublicSeoPage>
  );
}
