import Link from 'next/link';
import { PublicSeoPage } from '../../../components/public-site/PublicSeoPage';
import { PUBLIC_SEO_PAIRS, PUBLIC_SEO_SIGNS } from '../../../lib/publicSeoContent';

const path = '/sovmestimost/znakov';

const faq = [
  {
    question: 'Совместимость знаков бесплатная?',
    answer: 'Да. Можно выбрать два солнечных знака и прочитать общий разбор бесплатно.',
  },
  {
    question: 'Это точный разбор конкретных отношений?',
    answer: 'Нет. Два знака дают только общий взгляд. Для более личного сравнения нужны данные рождения обоих людей.',
  },
  {
    question: 'Имеет ли значение, какой знак выбрать первым?',
    answer: 'Нет. Овен и Телец — та же пара, что Телец и Овен.',
  },
] as const;

export default function SignCompatibilityIndexPage() {
  return (
    <PublicSeoPage
      path={path}
      title="Совместимость знаков зодиака"
      description="Совместимость знаков зодиака в NEBO: выберите два знака и посмотрите, что их сближает, где возникают разногласия и как они общаются."
      eyebrow="Совместимость по знакам"
      heading="Совместимость знаков зодиака"
      lead={<p>Выбери два знака и посмотри, что между ними обычно складывается легко, а где характеры могут цепляться.</p>}
      breadcrumbs={[
        { name: 'Совместимость', path: '/sovmestimost' },
        { name: 'Совместимость знаков', path },
      ]}
      faq={faq}
      schemaType="CollectionPage"
      relatedLinks={[
        { href: '/sovmestimost', label: 'Совместимость по дате рождения' },
        { href: '/natalnaya-karta', label: 'Натальная карта' },
        { href: '/goroskop', label: 'Гороскоп по знакам' },
      ]}
    >
      <section>
        <h2>Выбери первый знак</h2>
        <p>Ниже собраны все сочетания. Открой нужную пару и сразу читай сравнение.</p>
      </section>

      {PUBLIC_SEO_SIGNS.map((sign) => {
        const pairs = PUBLIC_SEO_PAIRS.filter((pair) => pair.first.key === sign.key);
        return (
          <section key={sign.key} aria-labelledby={`pairs-${sign.slug}`}>
            <h2 id={`pairs-${sign.slug}`}>{sign.name}</h2>
            <ul>
              {pairs.map((pair) => (
                <li key={pair.slug}><Link href={pair.path}>{pair.first.name} и {pair.second.name}</Link></li>
              ))}
            </ul>
          </section>
        );
      })}

      <section>
        <h2>Хочется точнее?</h2>
        <p>Солнечные знаки дают только общее сравнение. <Link href="/sovmestimost">Совместимость по дате рождения</Link> учитывает две натальные карты и показывает больше деталей.</p>
      </section>
    </PublicSeoPage>
  );
}
