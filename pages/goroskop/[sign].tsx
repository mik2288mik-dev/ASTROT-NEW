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

type SignPageProps = {
  sign: PublicSeoSign;
};

type SignPageParams = {
  sign: string;
};

export const getStaticPaths: GetStaticPaths<SignPageParams> = async () => ({
  paths: PUBLIC_SEO_SIGNS.map((sign) => ({ params: { sign: sign.slug } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps<SignPageProps, SignPageParams> = async ({ params }) => {
  const sign = findPublicSeoSignBySlug(params?.sign || '');
  if (!sign) return { notFound: true };
  return { props: { sign } };
};

export default function SignHoroscopePage({
  sign,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const path = `/goroskop/${sign.slug}`;
  const relatedPairs = relatedPairsForSign(sign).slice(0, 6);
  const faq = [
    {
      question: `Это гороскоп для ${sign.genitive} на сегодня?`,
      answer: `На этой странице собраны постоянные темы знака ${sign.name}. Ежедневный гороскоп для ${sign.genitive} читается внутри MEOU.`,
    },
    {
      question: `Что значит знак ${sign.name} в натальной карте?`,
      answer: sign.shortAnswer,
    },
    {
      question: 'Нужно ли точное время рождения?',
      answer: 'Для общего гороскопа по солнечному знаку точное время не нужно. Для полной натальной карты время и место рождения добавляют дома, углы и другие рассчитанные положения.',
    },
  ];

  return (
    <PublicSeoPage
      path={path}
      title={`Гороскоп для ${sign.genitive}: знак и личный прогноз`}
      description={`${sign.name}: как читать общий гороскоп, что описывает знак и чем он отличается от личного прогноза MEOU по натальной карте.`}
      eyebrow={`Гороскоп · ${sign.name}`}
      heading={`Гороскоп для ${sign.genitive}: знак и личный прогноз`}
      lead={<p>{sign.summary}</p>}
      breadcrumbs={[
        { name: 'Гороскоп по знакам', path: '/goroskop' },
        { name: sign.name, path },
      ]}
      faq={faq}
      relatedLinks={[
        { href: '/lichnyy-goroskop', label: 'Личный гороскоп по сохранённой карте' },
        { href: '/natalnaya-karta', label: 'Рассчитать натальную карту' },
        { href: '/sovmestimost/znakov', label: 'Все пары знаков' },
      ]}
    >
      <section>
        <h2>Короткий ответ</h2>
        <p>{sign.shortAnswer}</p>
      </section>

      {sign.sections.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>
      ))}

      <section>
        <h2>Что показывает общий гороскоп</h2>
        <p>Ежедневный гороскоп для {sign.genitive} опирается на один солнечный знак. Это быстрый общий формат, а не персональное заключение о человеке.</p>
        <p><Link href="/natalnaya-karta">Натальная карта</Link> учитывает несколько рассчитанных положений, дома и аспекты. <Link href="/lichnyy-goroskop">Личный прогноз</Link> получает данные сохранённой карты и выбранный период.</p>
      </section>

      <section>
        <h2>{sign.name} в совместимости</h2>
        <p>Сравнение двух солнечных знаков показывает общую динамику. Вот несколько пар с участием знака {sign.name}:</p>
        <ul>
          {relatedPairs.map((pair) => (
            <li key={pair.slug}>
              <Link href={pair.path}>{pair.first.name} и {pair.second.name}</Link>
            </li>
          ))}
        </ul>
        <p><Link href="/sovmestimost/znakov">Открыть все 78 пар знаков</Link></p>
      </section>

      <section>
        <h2>Где читать ежедневный прогноз</h2>
        <p>Общий ежедневный гороскоп доступен бесплатно. Личный текст использует данные сохранённой натальной карты и предыдущие прогнозы.</p>
        <ReleaseAction />
      </section>
    </PublicSeoPage>
  );
}
