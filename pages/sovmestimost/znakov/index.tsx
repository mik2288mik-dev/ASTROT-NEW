import Link from 'next/link';
import { PublicSeoPage } from '../../../components/public-site/PublicSeoPage';
import {
  PUBLIC_SEO_PAIRS,
  PUBLIC_SEO_SIGNS,
} from '../../../lib/publicSeoContent';

const path = '/sovmestimost/znakov';

const faq = [
  {
    question: 'Почему пар 78, а не 144?',
    answer: 'Потому что порядок знаков не меняет пару. Двенадцать сочетаний одного знака с собой и 66 сочетаний разных знаков дают 78 уникальных страниц.',
  },
  {
    question: 'Совместимость знаков бесплатная?',
    answer: 'Да. Общий разбор по двум солнечным знакам входит в бесплатный доступ MEOU.',
  },
  {
    question: 'Это точный разбор конкретных отношений?',
    answer: 'Два солнечных знака дают общий разбор. Для сравнения двух натальных карт нужны дата, время и место рождения обоих людей.',
  },
] as const;

export default function SignCompatibilityIndexPage() {
  return (
    <PublicSeoPage
      path={path}
      title="Совместимость знаков зодиака: 78 уникальных пар"
      description="Совместимость 12 знаков зодиака: 78 уникальных пар без дублей Овен–Телец и Телец–Овен. Бесплатный общий разбор в MEOU."
      eyebrow="Совместимость по знакам"
      heading="Совместимость знаков зодиака: 78 пар"
      lead={<p>Выбери два солнечных знака и прочитай, что их сближает, где расходится темп и как им говорить яснее. Это общий разбор по знакам.</p>}
      breadcrumbs={[
        { name: 'Совместимость', path: '/sovmestimost' },
        { name: 'Совместимость знаков', path },
      ]}
      faq={faq}
      schemaType="CollectionPage"
      relatedLinks={[
        { href: '/sovmestimost', label: 'Совместимость по двум картам' },
        { href: '/natalnaya-karta', label: 'Натальная карта' },
        { href: '/goroskop', label: 'Гороскоп по знакам' },
      ]}
    >
      <section>
        <h2>Как устроен каталог</h2>
        <p>«Овен и Телец» и «Телец и Овен» ведут к одному материалу. Порядок нужен только для списка: смысл пары от перестановки не меняется.</p>
        <p>Тексты собраны из профилей двенадцати знаков и описаний их общей динамики. Проценты совместимости и биографии людей здесь не придумываются.</p>
      </section>

      {PUBLIC_SEO_SIGNS.map((sign) => {
        const pairs = PUBLIC_SEO_PAIRS.filter((pair) => pair.first.key === sign.key);
        return (
          <section key={sign.key} aria-labelledby={`pairs-${sign.slug}`}>
            <h2 id={`pairs-${sign.slug}`}>{sign.name}</h2>
            <ul>
              {pairs.map((pair) => (
                <li key={pair.slug}>
                  <Link href={pair.path}>{pair.first.name} и {pair.second.name}</Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <section>
        <h2>Чем сравнение знаков отличается от сравнения карт</h2>
        <p>Солнечные знаки дают только общий первый слой. <Link href="/sovmestimost">Совместимость по двум натальным картам</Link> использует сохранённые расчётные данные обоих людей и доступна в Premium.</p>
      </section>
    </PublicSeoPage>
  );
}
