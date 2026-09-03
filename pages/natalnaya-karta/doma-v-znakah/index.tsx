import Link from 'next/link';
import { PublicSeoPage } from '../../../components/public-site/PublicSeoPage';
import { PUBLIC_SEO_HOUSE_SIGN_PLACEMENTS } from '../../../lib/publicSeoExpansion';
import { PUBLIC_SEO_HOUSES } from '../../../lib/publicSeoHouses';
import { PUBLIC_SEO_SIGNS } from '../../../lib/publicSeoContent';

export default function HousesInSignsHubPage() {
  return (
    <PublicSeoPage
      path="/natalnaya-karta/doma-v-znakah"
      title="Дома в знаках натальной карты: 12 домов во всех знаках"
      description="Что означает знак на каждом доме натальной карты: 144 сочетания двенадцати домов и двенадцати знаков с отдельными страницами."
      eyebrow="Натальная карта · дома в знаках"
      heading="Дома в знаках"
      lead={<p>Дом показывает часть жизни, знак — привычный способ действовать в ней. Поэтому сочетание дома и знака даёт более точный ответ, чем каждый из них отдельно.</p>}
      breadcrumbs={[{ name: 'Натальная карта', path: '/natalnaya-karta' }, { name: 'Дома в знаках', path: '/natalnaya-karta/doma-v-znakah' }]}
      schemaType="CollectionPage"
      faq={[
        { question: 'Что значит дом в знаке?', answer: 'Дом отвечает за конкретную часть жизни, а знак описывает способ, которым человек обычно действует в этой части карты.' },
        { question: 'Это то же самое, что планета в знаке?', answer: 'Нет. Планета описывает функцию, дом — область проявления, а знак на доме показывает стиль этой области.' },
        { question: 'Нужно ли точное время рождения?', answer: 'Да. Сетка домов зависит от времени и места рождения.' },
      ]}
    >
      <section><h2>Все сочетания</h2><p>{PUBLIC_SEO_SIGNS.map((sign) => sign.name).join(', ')}.</p></section>
      {PUBLIC_SEO_HOUSES.map((house) => (
        <section key={house.house}>
          <h2>{house.house} дом во всех знаках</h2>
          <p>{house.summary}</p>
          <ul>{PUBLIC_SEO_HOUSE_SIGN_PLACEMENTS.filter((item) => item.house.house === house.house).map((item) => <li key={item.slug}><Link href={item.path}>{item.house.house} дом в {item.sign.prepositional}</Link></li>)}</ul>
        </section>
      ))}
    </PublicSeoPage>
  );
}
